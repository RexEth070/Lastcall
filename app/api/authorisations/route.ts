import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createAuthorisationSchema } from "@/lib/validation/authorisation";
import { formatDateTimeInZone } from "@/lib/utils";

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

  const parsed = createAuthorisationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Explicit scoped confirmation is required.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { subscriptionId, expiresInMinutes, confirmationVersion } = parsed.data;

  // Verify subscription exists and belongs to authenticated user (RLS enforced)
  const { data: sub, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .is("archived_at", null)
    .maybeSingle();

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }
  if (!sub) {
    return NextResponse.json(
      { error: "Subscription not found or archived." },
      { status: 404 },
    );
  }
  if (sub.status === "verified_cancelled") {
    return NextResponse.json(
      { error: "Subscription is already verified cancelled." },
      { status: 409 },
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);
  const scopeSummary = `Single cancellation attempt for ${sub.service_name} (${sub.account_label}), renewing ${formatDateTimeInZone(sub.next_renewal_at, sub.timezone)}. No upsells, plan changes, or account deletion permitted.`;

  // Revoke any prior active authorisations for this exact subscription so only one active scope exists
  await supabase
    .from("authorisations")
    .update({ revoked_at: now.toISOString() })
    .eq("subscription_id", subscriptionId)
    .is("revoked_at", null);

  const { data: authorisation, error: insertError } = await supabase
    .from("authorisations")
    .insert({
      user_id: user.id,
      subscription_id: subscriptionId,
      action_type: "cancel_subscription",
      scope_summary: scopeSummary,
      approved_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      confirmation_version: confirmationVersion,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  await supabase
    .from("subscriptions")
    .update({ status: "action_authorised" })
    .eq("id", subscriptionId);

  await supabase.from("audit_events").insert({
    user_id: user.id,
    subscription_id: subscriptionId,
    event_type: "authorisation_granted",
    actor: "user",
    details_json: {
      authorisation_id: authorisation.id,
      expires_at: expiresAt.toISOString(),
      scope_summary: scopeSummary,
    },
  });

  return NextResponse.json({ authorisation }, { status: 201 });
}
