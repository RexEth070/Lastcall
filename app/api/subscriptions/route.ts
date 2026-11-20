import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { isMissingTableError } from "@/lib/db/demo-account";
import { mapSubscriptionRow, type SubscriptionRow } from "@/lib/db/types";
import { subscriptionInputSchema } from "@/lib/validation/subscription";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  let query = supabase
    .from("subscriptions")
    .select("*")
    .order("next_renewal_at", { ascending: true });

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        {
          error:
            "Database schema not initialized yet. Run supabase/migrations/202611200001_initial_schema.sql in Supabase SQL Editor.",
          code: "SCHEMA_NOT_READY",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const subscriptions = (data as SubscriptionRow[]).map(mapSubscriptionRow);
  return NextResponse.json({ subscriptions });
}

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

  const parsed = subscriptionInputSchema.safeParse(body);
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
  const insertRow = {
    user_id: user.id,
    service_name: input.serviceName,
    plan_name: input.planName,
    account_label: input.accountLabel,
    amount_minor: input.amountMinor,
    currency: input.currency,
    cadence: input.cadence,
    next_renewal_at: new Date(input.nextRenewalAt).toISOString(),
    timezone: input.timezone,
    policy_type: input.policyType,
    notice_period_days:
      input.policyType === "notice_period" ? input.noticePeriodDays : 0,
    safety_buffer_hours: input.safetyBufferHours,
    cancellation_policy_text: input.cancellationPolicyText,
    policy_confidence:
      input.policyType === "unknown" ? "unknown" : input.policyConfidence,
    status: "active" as const,
    is_controlled_demo_portal: input.isControlledDemoPortal,
    portal_url: input.portalUrl ? input.portalUrl.trim() : null,
    manual_fallback_url: input.manualFallbackUrl
      ? input.manualFallbackUrl.trim()
      : null,
    notes: input.notes,
  };

  const { data, error } = await supabase
    .from("subscriptions")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        {
          error:
            "Database schema not initialized yet. Run supabase/migrations/202611200001_initial_schema.sql in Supabase SQL Editor.",
          code: "SCHEMA_NOT_READY",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const created = mapSubscriptionRow(data as SubscriptionRow);

  // Append-only audit trail
  await supabase.from("audit_events").insert({
    user_id: user.id,
    subscription_id: created.id,
    event_type: "subscription_created",
    actor: "user",
    details_json: {
      service_name: created.serviceName,
      amount_minor: created.amountMinor,
      currency: created.currency,
      policy_type: created.policyType,
    },
  });

  return NextResponse.json({ subscription: created }, { status: 201 });
}
