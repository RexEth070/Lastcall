-- ============================================================================
-- LASTCALL Phase 2: Initial Schema, Constraints, RLS & Private Evidence Bucket
-- Run once in Supabase Dashboard -> SQL Editor (or `supabase db push`).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1. PROFILES ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'LASTCALL User',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile whenever an auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1), 'LASTCALL User'),
    COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. SUBSCRIPTIONS -----------------------------------------------------------
-- Money is stored strictly as integer minor units (e.g. cents/kobo) + 3-char ISO currency.
-- Never stores passwords, card numbers, session cookies, or OTPs.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL CHECK (char_length(trim(service_name)) BETWEEN 1 AND 120),
  plan_name TEXT NOT NULL DEFAULT 'Standard' CHECK (char_length(trim(plan_name)) BETWEEN 1 AND 120),
  account_label TEXT NOT NULL CHECK (char_length(trim(account_label)) BETWEEN 1 AND 160),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  cadence TEXT NOT NULL CHECK (cadence IN ('monthly', 'quarterly', 'annual', 'trial')),
  next_renewal_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC' CHECK (char_length(trim(timezone)) BETWEEN 1 AND 80),
  policy_type TEXT NOT NULL DEFAULT 'unknown' CHECK (policy_type IN ('immediate', 'end_of_period', 'notice_period', 'unknown')),
  notice_period_days INTEGER NOT NULL DEFAULT 0 CHECK (notice_period_days BETWEEN 0 AND 365),
  safety_buffer_hours INTEGER NOT NULL DEFAULT 48 CHECK (safety_buffer_hours BETWEEN 0 AND 336),
  cancellation_policy_text TEXT NOT NULL DEFAULT '',
  policy_confidence TEXT NOT NULL DEFAULT 'unknown' CHECK (policy_confidence IN ('verified', 'user_provided', 'unknown')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN (
      'active',
      'action_authorised',
      'agent_working',
      'verification_failed',
      'needs_human_action',
      'verified_cancelled',
      'unverified_unknown'
    )
  ),
  is_controlled_demo_portal BOOLEAN NOT NULL DEFAULT FALSE,
  portal_url TEXT,
  manual_fallback_url TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_renewal
  ON public.subscriptions (user_id, next_renewal_at)
  WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. AUTHORISATIONS ----------------------------------------------------------
-- Scoped to one user, one subscription, one action; expires and can be revoked.
CREATE TABLE IF NOT EXISTS public.authorisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('cancel_subscription')),
  scope_summary TEXT NOT NULL CHECK (char_length(trim(scope_summary)) >= 10),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  confirmation_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > approved_at)
);

CREATE INDEX IF NOT EXISTS idx_authorisations_user_sub
  ON public.authorisations (user_id, subscription_id, approved_at DESC);

DROP TRIGGER IF EXISTS trg_authorisations_updated_at ON public.authorisations;
CREATE TRIGGER trg_authorisations_updated_at
  BEFORE UPDATE ON public.authorisations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. CANCELLATION JOBS -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cancellation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  authorisation_id UUID NOT NULL REFERENCES public.authorisations(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (char_length(trim(idempotency_key)) BETWEEN 8 AND 128),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'authorised' CHECK (
    status IN (
      'pending_approval',
      'authorised',
      'agent_running',
      'kane_verifying',
      'recovery_required',
      'agent_recovery',
      'verified_cancelled',
      'needs_human_action',
      'verification_unavailable',
      'stopped_by_user'
    )
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 2 CHECK (max_attempts BETWEEN 1 AND 2),
  stop_requested_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_jobs_user_status
  ON public.cancellation_jobs (user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_cancellation_jobs_updated_at ON public.cancellation_jobs;
CREATE TRIGGER trg_cancellation_jobs_updated_at
  BEFORE UPDATE ON public.cancellation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. CANCELLATION ATTEMPTS ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cancellation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.cancellation_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  browser_result TEXT,
  kane_verdict TEXT CHECK (kane_verdict IS NULL OR kane_verdict IN ('PASS', 'FAIL', 'UNAVAILABLE')),
  kane_run_id TEXT,
  kane_share_url TEXT,
  evidence_path TEXT,
  feedback_json JSONB,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_cancellation_attempts_job
  ON public.cancellation_attempts (job_id, attempt_number);

DROP TRIGGER IF EXISTS trg_cancellation_attempts_updated_at ON public.cancellation_attempts;
CREATE TRIGGER trg_cancellation_attempts_updated_at
  BEFORE UPDATE ON public.cancellation_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. EVIDENCE ITEMS ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.cancellation_attempts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('screenshot', 'report', 'ndjson_log', 'share_link')),
  storage_path TEXT NOT NULL CHECK (char_length(trim(storage_path)) >= 1),
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  redacted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_attempt
  ON public.evidence_items (attempt_id);

DROP TRIGGER IF EXISTS trg_evidence_items_updated_at ON public.evidence_items;
CREATE TRIGGER trg_evidence_items_updated_at
  BEFORE UPDATE ON public.evidence_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. AUDIT EVENTS (APPEND-ONLY) ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (char_length(trim(event_type)) BETWEEN 2 AND 80),
  actor TEXT NOT NULL CHECK (actor IN ('user', 'system', 'agent', 'kane')),
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_created
  ON public.audit_events (user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — STRICT USER ISOLATION ON EVERY TABLE
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Subscriptions
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
CREATE POLICY "subscriptions_insert_own" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
CREATE POLICY "subscriptions_update_own" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;
CREATE POLICY "subscriptions_delete_own" ON public.subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Authorisations
DROP POLICY IF EXISTS "authorisations_select_own" ON public.authorisations;
CREATE POLICY "authorisations_select_own" ON public.authorisations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "authorisations_insert_own" ON public.authorisations;
CREATE POLICY "authorisations_insert_own" ON public.authorisations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "authorisations_update_own" ON public.authorisations;
CREATE POLICY "authorisations_update_own" ON public.authorisations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cancellation jobs
DROP POLICY IF EXISTS "cancellation_jobs_select_own" ON public.cancellation_jobs;
CREATE POLICY "cancellation_jobs_select_own" ON public.cancellation_jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cancellation_jobs_insert_own" ON public.cancellation_jobs;
CREATE POLICY "cancellation_jobs_insert_own" ON public.cancellation_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cancellation_jobs_update_own" ON public.cancellation_jobs;
CREATE POLICY "cancellation_jobs_update_own" ON public.cancellation_jobs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cancellation attempts (scoped through parent job ownership)
DROP POLICY IF EXISTS "cancellation_attempts_select_own" ON public.cancellation_attempts;
CREATE POLICY "cancellation_attempts_select_own" ON public.cancellation_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cancellation_jobs j
      WHERE j.id = cancellation_attempts.job_id
        AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cancellation_attempts_insert_own" ON public.cancellation_attempts;
CREATE POLICY "cancellation_attempts_insert_own" ON public.cancellation_attempts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cancellation_jobs j
      WHERE j.id = cancellation_attempts.job_id
        AND j.user_id = auth.uid()
    )
  );

-- Evidence items
DROP POLICY IF EXISTS "evidence_items_select_own" ON public.evidence_items;
CREATE POLICY "evidence_items_select_own" ON public.evidence_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "evidence_items_insert_own" ON public.evidence_items;
CREATE POLICY "evidence_items_insert_own" ON public.evidence_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Audit events (APPEND-ONLY: SELECT + INSERT only, no UPDATE or DELETE policy)
DROP POLICY IF EXISTS "audit_events_select_own" ON public.audit_events;
CREATE POLICY "audit_events_select_own" ON public.audit_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audit_events_insert_own" ON public.audit_events;
CREATE POLICY "audit_events_insert_own" ON public.audit_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- PRIVATE STORAGE BUCKET FOR CANCELLATION EVIDENCE
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cancellation-evidence',
  'cancellation-evidence',
  FALSE,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/json', 'text/plain', 'text/markdown']
)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

DROP POLICY IF EXISTS "evidence_storage_select_own" ON storage.objects;
CREATE POLICY "evidence_storage_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cancellation-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "evidence_storage_insert_own" ON storage.objects;
CREATE POLICY "evidence_storage_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cancellation-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
