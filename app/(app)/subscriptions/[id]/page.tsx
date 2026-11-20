import { notFound } from "next/navigation";
import { SubscriptionDetailClient } from "@/components/subscriptions/subscription-detail-client";
import type { AuthorisationRecord } from "@/components/consent/authorisation-modal";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { mapSubscriptionRow, type SubscriptionRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  const { data: subRow, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !subRow) {
    notFound();
  }

  const nowIso = new Date().toISOString();

  const [authRes, jobsRes, auditRes] = await Promise.all([
    supabase
      .from("authorisations")
      .select(
        "id, subscription_id, action_type, scope_summary, approved_at, expires_at, revoked_at, confirmation_version",
      )
      .eq("subscription_id", id)
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cancellation_jobs")
      .select("id, status, scheduled_for, attempt_count, max_attempts, created_at")
      .eq("subscription_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_events")
      .select("id, event_type, actor, created_at")
      .eq("subscription_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <SubscriptionDetailClient
      initialSubscription={mapSubscriptionRow(subRow as SubscriptionRow)}
      initialActiveAuth={(authRes.data as AuthorisationRecord | null) ?? null}
      initialJobs={jobsRes.data ?? []}
      initialAuditEvents={auditRes.data ?? []}
    />
  );
}
