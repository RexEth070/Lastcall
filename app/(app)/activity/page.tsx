import {
  ActivityClient,
  type ActivityAttemptItem,
  type ActivityJobItem,
} from "@/components/activity/activity-client";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const supabase = await createSupabaseServerClient();

  const { data: jobRows } = await supabase
    .from("cancellation_jobs")
    .select(
      `
      id,
      subscription_id,
      status,
      attempt_count,
      max_attempts,
      stop_requested_at,
      last_error,
      created_at,
      subscriptions (
        service_name,
        account_label,
        timezone
      ),
      cancellation_attempts (
        id,
        attempt_number,
        started_at,
        finished_at,
        browser_result,
        kane_verdict,
        kane_run_id,
        kane_share_url,
        summary,
        feedback_json
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const items: ActivityJobItem[] = (jobRows ?? []).map((row) => {
    const sub = Array.isArray(row.subscriptions)
      ? row.subscriptions[0]
      : row.subscriptions;
    const attempts = (
      (row.cancellation_attempts as ActivityAttemptItem[] | null) ?? []
    ).sort((a, b) => a.attempt_number - b.attempt_number);

    return {
      id: row.id,
      subscription_id: row.subscription_id,
      service_name: sub?.service_name ?? "Subscription",
      account_label: sub?.account_label ?? "—",
      timezone: sub?.timezone ?? "UTC",
      status: row.status,
      attempt_count: row.attempt_count,
      max_attempts: row.max_attempts,
      stop_requested_at: row.stop_requested_at,
      last_error: row.last_error,
      created_at: row.created_at,
      attempts,
    };
  });

  return <ActivityClient initialJobs={items} />;
}
