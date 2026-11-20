import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { isMissingTableError } from "@/lib/db/demo-account";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import {
  mapSubscriptionRow,
  type SubscriptionRecord,
  type SubscriptionRow,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .is("archived_at", null)
    .order("next_renewal_at", { ascending: true });

  if (error && isMissingTableError(error)) {
    return <DashboardClient initialSubscriptions={[]} schemaReady={false} />;
  }

  const records: SubscriptionRecord[] = error
    ? []
    : (data as SubscriptionRow[]).map(mapSubscriptionRow);

  return <DashboardClient initialSubscriptions={records} schemaReady={true} />;
}
