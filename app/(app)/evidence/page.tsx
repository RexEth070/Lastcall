import {
  EvidenceClient,
  type VaultAttemptRecord,
  type VaultEvidenceItem,
} from "@/components/evidence/evidence-client";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import type { KaneVerdict } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const supabase = await createSupabaseServerClient();

  const { data: attempts } = await supabase
    .from("cancellation_attempts")
    .select(
      `
      id,
      job_id,
      attempt_number,
      kane_verdict,
      kane_run_id,
      kane_share_url,
      summary,
      finished_at,
      cancellation_jobs (
        subscriptions (
          service_name,
          account_label,
          timezone
        )
      ),
      evidence_items (
        id,
        kind,
        redacted,
        created_at
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(30);

  const records: VaultAttemptRecord[] = (attempts ?? []).map((row) => {
    const jobObj = Array.isArray(row.cancellation_jobs)
      ? row.cancellation_jobs[0]
      : row.cancellation_jobs;
    const subObj = jobObj?.subscriptions
      ? Array.isArray(jobObj.subscriptions)
        ? jobObj.subscriptions[0]
        : jobObj.subscriptions
      : null;

    return {
      id: row.id,
      job_id: row.job_id,
      service_name: subObj?.service_name ?? "Subscription",
      account_label: subObj?.account_label ?? "—",
      timezone: subObj?.timezone ?? "UTC",
      attempt_number: row.attempt_number,
      kane_verdict: (row.kane_verdict as KaneVerdict | null) ?? null,
      kane_run_id: row.kane_run_id,
      kane_share_url: row.kane_share_url,
      summary: row.summary,
      finished_at: row.finished_at,
      evidence_items: (row.evidence_items as VaultEvidenceItem[] | null) ?? [],
    };
  });

  return <EvidenceClient records={records} />;
}
