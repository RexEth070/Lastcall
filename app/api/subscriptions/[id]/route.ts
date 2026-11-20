import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { mapSubscriptionRow, type SubscriptionRow } from "@/lib/db/types";
import { subscriptionUpdateSchema } from "@/lib/validation/subscription";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid subscription identifier." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Subscription not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    subscription: mapSubscriptionRow(data as SubscriptionRow),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid subscription identifier." },
      { status: 400 },
    );
  }

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

  const parsed = subscriptionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed. Please review the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const patch: Record<string, unknown> = {};

  if (input.serviceName !== undefined) patch.service_name = input.serviceName;
  if (input.planName !== undefined) patch.plan_name = input.planName;
  if (input.accountLabel !== undefined) patch.account_label = input.accountLabel;
  if (input.amountMinor !== undefined) patch.amount_minor = input.amountMinor;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.cadence !== undefined) patch.cadence = input.cadence;
  if (input.nextRenewalAt !== undefined) {
    patch.next_renewal_at = new Date(input.nextRenewalAt).toISOString();
  }
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.policyType !== undefined) {
    patch.policy_type = input.policyType;
    if (input.policyType === "unknown") {
      patch.policy_confidence = "unknown";
      patch.notice_period_days = 0;
    } else if (input.policyType !== "notice_period") {
      patch.notice_period_days = 0;
    }
  }
  if (input.noticePeriodDays !== undefined && input.policyType !== "unknown") {
    patch.notice_period_days = input.noticePeriodDays;
  }
  if (input.safetyBufferHours !== undefined) {
    patch.safety_buffer_hours = input.safetyBufferHours;
  }
  if (input.cancellationPolicyText !== undefined) {
    patch.cancellation_policy_text = input.cancellationPolicyText;
  }
  if (input.policyConfidence !== undefined && input.policyType !== "unknown") {
    patch.policy_confidence = input.policyConfidence;
  }
  if (input.isControlledDemoPortal !== undefined) {
    patch.is_controlled_demo_portal = input.isControlledDemoPortal;
  }
  if (input.portalUrl !== undefined) {
    patch.portal_url = input.portalUrl ? input.portalUrl.trim() : null;
  }
  if (input.manualFallbackUrl !== undefined) {
    patch.manual_fallback_url = input.manualFallbackUrl
      ? input.manualFallbackUrl.trim()
      : null;
  }
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.archived !== undefined) {
    patch.archived_at = input.archived ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided for update." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Subscription not found or access denied." },
      { status: 404 },
    );
  }

  const updated = mapSubscriptionRow(data as SubscriptionRow);

  const eventType =
    input.archived === true
      ? "subscription_archived"
      : input.archived === false
        ? "subscription_restored"
        : "subscription_updated";

  await supabase.from("audit_events").insert({
    user_id: user.id,
    subscription_id: updated.id,
    event_type: eventType,
    actor: "user",
    details_json: { updated_fields: Object.keys(patch) },
  });

  return NextResponse.json({ subscription: updated });
}
