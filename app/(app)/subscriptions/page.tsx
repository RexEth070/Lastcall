import { SubscriptionsClient } from "@/components/subscriptions/subscriptions-client";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { isMissingTableError } from "@/lib/db/demo-account";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import {
  mapSubscriptionRow,
  type SubscriptionRecord,
  type SubscriptionRow,
} from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const session = await getAuthenticatedSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("next_renewal_at", { ascending: true });

  if (error && isMissingTableError(error)) {
    return (
      <SubscriptionsClient
        initialSubscriptions={[]}
        schemaReady={false}
        isDemoUser={Boolean(session?.isDemoUser)}
      />
    );
  }

  const records: SubscriptionRecord[] = error
    ? []
    : (data as SubscriptionRow[]).map(mapSubscriptionRow);

  return (
    <SubscriptionsClient
      initialSubscriptions={records}
      schemaReady={true}
      isDemoUser={Boolean(session?.isDemoUser)}
    />
  );
}
