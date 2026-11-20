import type {
  BillingCadence,
  CancellationPolicyType,
  PolicyConfidence,
  SubscriptionStatus,
} from "@/lib/types";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  service_name: string;
  plan_name: string;
  account_label: string;
  amount_minor: number;
  currency: string;
  cadence: BillingCadence;
  next_renewal_at: string;
  timezone: string;
  policy_type: CancellationPolicyType;
  notice_period_days: number;
  safety_buffer_hours: number;
  cancellation_policy_text: string;
  policy_confidence: PolicyConfidence;
  status: SubscriptionStatus;
  is_controlled_demo_portal: boolean;
  portal_url: string | null;
  manual_fallback_url: string | null;
  notes: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  serviceName: string;
  planName: string;
  accountLabel: string;
  amountMinor: number;
  currency: string;
  cadence: BillingCadence;
  nextRenewalAt: string;
  timezone: string;
  policyType: CancellationPolicyType;
  noticePeriodDays: number;
  safetyBufferHours: number;
  cancellationPolicyText: string;
  policyConfidence: PolicyConfidence;
  status: SubscriptionStatus;
  isControlledDemoPortal: boolean;
  portalUrl: string | null;
  manualFallbackUrl: string | null;
  notes: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastSafeDeadlineAt: string | null;
}

/**
 * Preliminary conservative deadline preview (full timezone/DST planner lands in Phase 3).
 * Strict guardrail: if policyType is 'unknown' or policyConfidence is 'unknown', returns null.
 */
export function previewLastSafeDeadlineIso(row: {
  next_renewal_at: string;
  policy_type: CancellationPolicyType;
  policy_confidence: PolicyConfidence;
  notice_period_days: number;
  safety_buffer_hours: number;
}): string | null {
  if (row.policy_type === "unknown" || row.policy_confidence === "unknown") {
    return null;
  }
  const renewalMs = Date.parse(row.next_renewal_at);
  if (Number.isNaN(renewalMs)) return null;
  const noticeHours =
    row.policy_type === "notice_period" ? row.notice_period_days * 24 : 0;
  const totalOffsetMs = (noticeHours + row.safety_buffer_hours) * 60 * 60 * 1000;
  return new Date(renewalMs - totalOffsetMs).toISOString();
}

export function mapSubscriptionRow(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    serviceName: row.service_name,
    planName: row.plan_name,
    accountLabel: row.account_label,
    amountMinor: row.amount_minor,
    currency: row.currency,
    cadence: row.cadence,
    nextRenewalAt: row.next_renewal_at,
    timezone: row.timezone,
    policyType: row.policy_type,
    noticePeriodDays: row.notice_period_days,
    safetyBufferHours: row.safety_buffer_hours,
    cancellationPolicyText: row.cancellation_policy_text,
    policyConfidence: row.policy_confidence,
    status: row.status,
    isControlledDemoPortal: row.is_controlled_demo_portal,
    portalUrl: row.portal_url,
    manualFallbackUrl: row.manual_fallback_url,
    notes: row.notes,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSafeDeadlineAt: previewLastSafeDeadlineIso(row),
  };
}
