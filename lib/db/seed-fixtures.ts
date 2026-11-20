import type { SubscriptionRow } from "./types";

type SeedSubscriptionInsert = Omit<
  SubscriptionRow,
  "id" | "user_id" | "archived_at" | "created_at" | "updated_at"
>;

export function buildDemoSeedSubscriptions(
  demoPortalUrl: string,
): SeedSubscriptionInsert[] {
  const billingUrl = `${demoPortalUrl.replace(/\/$/, "")}/billing`;

  return [
    {
      service_name: "CloudStream Pro (Demo Portal)",
      plan_name: "Creator Monthly",
      account_label: "alex.d***@cloudstream.test",
      amount_minor: 2400,
      currency: "USD",
      cadence: "monthly",
      next_renewal_at: "2026-11-25T09:00:00.000Z",
      timezone: "UTC",
      policy_type: "notice_period",
      notice_period_days: 1,
      safety_buffer_hours: 48,
      cancellation_policy_text:
        "Controlled demo billing portal fixture. Cancellation must be completed at least 24 hours before renewal; access remains until cycle end.",
      policy_confidence: "verified",
      status: "active",
      is_controlled_demo_portal: true,
      portal_url: billingUrl,
      manual_fallback_url: billingUrl,
      notes: "Primary controlled fixture for the Kane CLI closed-loop verification demo.",
    },
    {
      service_name: "DesignForge Studio",
      plan_name: "14-Day Trial -> Pro",
      account_label: "sam.***@university.edu",
      amount_minor: 1900,
      currency: "USD",
      cadence: "trial",
      next_renewal_at: "2026-11-23T17:00:00.000Z",
      timezone: "America/New_York",
      policy_type: "immediate",
      notice_period_days: 0,
      safety_buffer_hours: 48,
      cancellation_policy_text:
        "Trial converts automatically at renewal timestamp. Cancelling stops trial access immediately.",
      policy_confidence: "verified",
      status: "active",
      is_controlled_demo_portal: false,
      portal_url: null,
      manual_fallback_url: "https://example.com/designforge/cancel-help",
      notes: "Sample trial renewal fixture.",
    },
    {
      service_name: "NoteSync AI",
      plan_name: "Student Plus",
      account_label: "sam.***@gmail.com",
      amount_minor: 1200,
      currency: "USD",
      cadence: "monthly",
      next_renewal_at: "2026-11-26T12:00:00.000Z",
      timezone: "Europe/London",
      policy_type: "unknown",
      notice_period_days: 0,
      safety_buffer_hours: 48,
      cancellation_policy_text:
        "Provider notice period not verified. LASTCALL refuses to invent a safe deadline.",
      policy_confidence: "unknown",
      status: "active",
      is_controlled_demo_portal: false,
      portal_url: null,
      manual_fallback_url: "https://example.com/notesync/terms",
      notes: "Demonstrates conservative handling of unknown cancellation terms.",
    },
    {
      service_name: "FocusRead Audio",
      plan_name: "Annual Library",
      account_label: "sam.***@gmail.com",
      amount_minor: 8900,
      currency: "USD",
      cadence: "annual",
      next_renewal_at: "2026-11-28T08:00:00.000Z",
      timezone: "UTC",
      policy_type: "notice_period",
      notice_period_days: 3,
      safety_buffer_hours: 48,
      cancellation_policy_text:
        "Requires 3 days notice and MFA verification during cancellation.",
      policy_confidence: "user_provided",
      status: "needs_human_action",
      is_controlled_demo_portal: false,
      portal_url: null,
      manual_fallback_url: "https://example.com/focusread/account",
      notes: "Illustrates safe human handoff when MFA is required.",
    },
  ];
}
