import { createSupabaseAdminClient } from "./supabase-admin";
import { buildDemoSeedSubscriptions } from "./seed-fixtures";

export function getDemoCredentials() {
  const email = (process.env.DEMO_USER_EMAIL || "demo@lastcall.app").trim();
  const password = process.env.DEMO_USER_PASSWORD || "LastcallDemo2026!";
  const portalUrl =
    process.env.NEXT_PUBLIC_DEMO_PORTAL_URL || "http://localhost:3001";
  return { email, password, portalUrl };
}

export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("Could not find the table"))
  );
}

/**
 * Ensures the seeded judge demo Auth user exists (email_confirm: true),
 * has a profile row, and has initial demo subscriptions if none exist yet.
 */
export async function ensureSeededDemoAccount(): Promise<{
  userId: string;
  schemaReady: boolean;
}> {
  const admin = createSupabaseAdminClient();
  const { email, password, portalUrl } = getDemoCredentials();

  // Find existing demo user or create one idempotently
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) {
    throw new Error(`Failed to verify demo user: ${listError.message}`);
  }

  let userId = listed.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  )?.id;

  if (!userId) {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: "Judge Demo Account",
          timezone: "UTC",
        },
      });
    if (createError || !created.user) {
      throw new Error(
        `Failed to provision demo account: ${createError?.message || "unknown error"}`,
      );
    }
    userId = created.user.id;
  } else {
    // Keep demo password synced with environment configuration
    await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
  }

  // Ensure profile exists (tolerates schema not yet migrated)
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      display_name: "Judge Demo Account",
      timezone: "UTC",
    },
    { onConflict: "id" },
  );

  if (isMissingTableError(profileError)) {
    return { userId, schemaReady: false };
  }

  // Seed subscriptions only when the demo user currently has zero records
  const { count, error: countError } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (isMissingTableError(countError)) {
    return { userId, schemaReady: false };
  }

  if ((count ?? 0) === 0) {
    const fixtures = buildDemoSeedSubscriptions(portalUrl).map((item) => ({
      ...item,
      user_id: userId,
    }));

    const { error: insertError } = await admin
      .from("subscriptions")
      .insert(fixtures);

    if (insertError) {
      throw new Error(`Failed to seed demo subscriptions: ${insertError.message}`);
    }

    await admin.from("audit_events").insert({
      user_id: userId,
      subscription_id: null,
      event_type: "demo_seeded",
      actor: "system",
      details_json: { seeded_count: fixtures.length },
    });
  }

  return { userId, schemaReady: true };
}

export async function resetDemoAccountSubscriptions(userId: string) {
  const admin = createSupabaseAdminClient();
  const { portalUrl } = getDemoCredentials();

  const { error: delError } = await admin
    .from("subscriptions")
    .delete()
    .eq("user_id", userId);

  if (delError) {
    throw new Error(`Failed to clear demo subscriptions: ${delError.message}`);
  }

  const fixtures = buildDemoSeedSubscriptions(portalUrl).map((item) => ({
    ...item,
    user_id: userId,
  }));

  const { error: insError } = await admin
    .from("subscriptions")
    .insert(fixtures);

  if (insError) {
    throw new Error(`Failed to re-seed demo subscriptions: ${insError.message}`);
  }

  await admin.from("audit_events").insert({
    user_id: userId,
    subscription_id: null,
    event_type: "demo_reset",
    actor: "user",
    details_json: { seeded_count: fixtures.length },
  });

  return { count: fixtures.length };
}
