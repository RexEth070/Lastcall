export type SubscriptionStatus =
  | "active"
  | "action_authorised"
  | "agent_working"
  | "verification_failed"
  | "needs_human_action"
  | "verified_cancelled"
  | "unverified_unknown";

export type BillingCadence = "monthly" | "quarterly" | "annual" | "trial";

export type CancellationPolicyType =
  | "immediate"
  | "end_of_period"
  | "notice_period"
  | "unknown";

export type PolicyConfidence = "verified" | "user_provided" | "unknown";

export interface DemoSubscription {
  id: string;
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
  lastSafeDeadlineAt: string | null;
  policyConfidence: PolicyConfidence;
  cancellationPolicyText: string;
  status: SubscriptionStatus;
  isControlledDemoPortal: boolean;
  manualFallbackUrl: string;
}

export type KaneVerdict = "PASS" | "FAIL" | "UNAVAILABLE";

export interface DemoActivityStep {
  id: string;
  attemptNumber: number;
  phase:
    | "authorised"
    | "agent_attempt"
    | "kane_verdict"
    | "agent_recovery"
    | "verified"
    | "needs_human";
  title: string;
  detail: string;
  timestamp: string;
  verdict?: KaneVerdict;
  kaneRunId?: string;
}

export interface DemoActivityJob {
  id: string;
  subscriptionId: string;
  serviceName: string;
  accountLabel: string;
  portalLabel: string;
  status: SubscriptionStatus;
  attemptCount: number;
  maxAttempts: number;
  startedAt: string;
  updatedAt: string;
  steps: DemoActivityStep[];
}

export interface DemoEvidenceRecord {
  id: string;
  jobId: string;
  subscriptionId: string;
  serviceName: string;
  accountLabel: string;
  verdict: KaneVerdict;
  finalStatus: SubscriptionStatus;
  kaneRunId: string;
  verifiedAt: string;
  timezone: string;
  summary: string;
  postconditionsChecked: {
    label: string;
    passed: boolean;
  }[];
  storageState: "private_signed_ready" | "preview_placeholder";
  redacted: boolean;
}
