import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: job, error: fetchError } = await supabase
    .from("cancellation_jobs")
    .select("id, subscription_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    stop_requested_at: nowIso,
    last_error: "Stopped by user.",
  };
  // If job hasn't been picked up by worker yet, transition immediately
  if (job.status === "authorised" || job.status === "pending_approval") {
    patch.status = "stopped_by_user";
  }

  const { data: updated, error: updateError } = await supabase
    .from("cancellation_jobs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await supabase.from("audit_events").insert({
    user_id: user.id,
    subscription_id: job.subscription_id,
    event_type: "stop_agent_requested",
    actor: "user",
    details_json: { job_id: id, previous_status: job.status },
  });

  return NextResponse.json({ job: updated });
}
