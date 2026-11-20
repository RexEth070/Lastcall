-- ============================================================================
-- LASTCALL Migration 0002: Explicit Table Grants for Supabase Roles
-- Defense-in-depth alongside Row Level Security (RLS).
-- Run once in Supabase Dashboard -> SQL Editor.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- Service role (server-side demo seeder & persistent worker)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Authenticated users (strictly scoped by RLS policies on every table)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.authorisations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cancellation_jobs TO authenticated;

-- Append-only / immutable user-facing tables (no UPDATE or DELETE granted)
GRANT SELECT, INSERT ON public.cancellation_attempts TO authenticated;
GRANT SELECT, INSERT ON public.evidence_items TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;

-- Explicitly ensure anon has no direct table access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
