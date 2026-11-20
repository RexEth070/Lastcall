import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import {
  createCancellationJobSchema,
  validateScopedAuthorisation,
  type AuthorisationCheckRecord,
} from "@/lib/validation/authorisation";

/**
 * Creates a cancellation job ONLY after strict server-side verification of an active,
 * scoped, unexpired, unrevoked authorisation for this exact user & subscription.
 * Enforces idempotency via unique `idempotency_key` to prevent duplicate cancellations.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createCancellationJobSchema.safeParse(body);
  if (!parsed.success) {
    await supabase.from("audit_events").insert({
      user_id: user.id,
      subscription_id: null,
      event_type: "unauthorised_job_rejected",
      actor: "system",
      details_json: { reason: "invalid_or_missing_authorisation_payload" },
    });

    return NextResponse.json(
      {
        error:
          "Scoped authorisation and idempotency key are required before creating a cancellation job.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 403 },
    );
  }

  const {
    subscriptionId,
    authorisationId,
    idempotencyKey,
    executionMode,
    scheduledFor,
  } = parsed.data;

  // Idempotency check: return existing job if already created with this key
  const { data: existingJob } = await supabase
    .from("cancellation_jobs")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingJob) {
    return NextResponse.json(
      { job: existingJob, deduplicated: true },
      { status: 200 },
    );
  }

  // Server-side scoped authorisation enforcement
  const { data: authRow, error: authFetchError } = await supabase
    .from("authorisations")
    .select("id, user_id, subscription_id, action_type, expires_at, revoked_at")
    .eq("id", authorisationId)
    .maybeSingle();

  if (authFetchError) {
    return NextResponse.json({ error: authFetchError.message }, { status: 500 });
  }

  const check = validateScopedAuthorisation(
    authRow as AuthorisationCheckRecord | null,
    user.id,
    subscriptionId,
  );

  if (!check.valid) {
    await supabase.from("audit_events").insert({
      user_id: user.id,
      subscription_id: subscriptionId,
      event_type: "unauthorised_job_rejected",
      actor: "system",
      details_json: {
        authorisation_id: authorisationId,
        reason: check.reason,
      },
    });

    return NextResponse.json(
      { error: check.reason || "Authorisation check failed." },
      { status: 403 },
    );
  }

  const scheduledIso =
    executionMode === "schedule_attempt" && scheduledFor
      ? new Date(scheduledFor).toISOString()
      : new Date().toISOString();

  const { data: job, error: jobError } = await supabase
    .from("cancellation_jobs")
    .insert({
      user_id: user.id,
      subscription_id: subscriptionId,
      authorisation_id: authorisationId,
      idempotency_key: idempotencyKey,
      scheduled_for: scheduledIso,
      status: "authorised",
      attempt_count: 0,
      max_attempts: 2,
    })
    .select("*")
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 400 });
  }

  await supabase.from("audit_events").insert({
    user_id: user.id,
    subscription_id: subscriptionId,
    event_type: "cancellation_job_queued",
    actor: "user",
    details_json: {
      job_id: job.id,
      authorisation_id: authorisationId,
      execution_mode: executionMode,
      scheduled_for: scheduledIso,
    },
  });

  return NextResponse.json({ job, deduplicated: false }, { status: 201 });
}
