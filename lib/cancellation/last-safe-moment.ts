import type {
  CancellationPolicyType,
  PolicyConfidence,
} from "@/lib/types";

export type UserCancellationIntent =
  | "stop_future_renewal"
  | "preserve_access"
  | "cancel_immediately";

export type DeadlineUrgency =
  | "unknown_policy"
  | "cancel_now_requested"
  | "overdue_window"
  | "upcoming_soon"
  | "safe_window";

export interface LastSafeMomentInput {
  nextRenewalAt: string;
  timezone: string;
  policyType: CancellationPolicyType;
  policyConfidence: PolicyConfidence;
  noticePeriodDays: number;
  safetyBufferHours: number;
  userIntent?: UserCancellationIntent;
  now?: Date;
}

export interface LastSafeMomentResult {
  canComputeSafeDate: boolean;
  urgency: DeadlineUrgency;
  headline: string;
  providerDeadlineAt: string | null;
  lastSafeDeadlineAt: string | null;
  accessImpactSummary: string;
  assumptions: string[];
  disclaimer: string;
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getLocalPartsInTimeZone(date: Date, timeZone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const pick = (type: string) =>
    Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour") === 24 ? 0 : pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

/**
 * Resolves a provider-local wall-clock date/time in an IANA timezone back to a UTC Date,
 * preserving wall-clock time cleanly across Daylight Saving Time transitions.
 */
function zonedWallClockToUtc(parts: LocalDateParts, timeZone: string): Date {
  const utcGuessMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  // Two-pass offset refinement handles DST transitions accurately without external libs.
  let candidate = new Date(utcGuessMs);
  for (let i = 0; i < 2; i++) {
    const rendered = getLocalPartsInTimeZone(candidate, timeZone);
    const renderedAsUtcMs = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );
    const diffMs = utcGuessMs - renderedAsUtcMs;
    if (diffMs === 0) break;
    candidate = new Date(candidate.getTime() + diffMs);
  }
  return candidate;
}

/**
 * Subtracts whole calendar days in provider local wall-clock time (preserving e.g. 09:00 across DST).
 */
function subtractCalendarDaysInZone(
  baseUtc: Date,
  days: number,
  timeZone: string,
): Date {
  if (days <= 0) return new Date(baseUtc.getTime());
  const local = getLocalPartsInTimeZone(baseUtc, timeZone);
  // Use Date.UTC calendar normalization to roll back month/year cleanly
  const shifted = new Date(
    Date.UTC(
      local.year,
      local.month - 1,
      local.day - days,
      local.hour,
      local.minute,
      local.second,
    ),
  );
  return zonedWallClockToUtc(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
    },
    timeZone,
  );
}

function getAccessImpactSummary(policyType: CancellationPolicyType): string {
  switch (policyType) {
    case "immediate":
      return "Access may end immediately once cancellation is confirmed.";
    case "end_of_period":
      return "Paid access typically remains active until the end of the current billing period.";
    case "notice_period":
      return "Provider requires advance notice before renewal; cancelling late may trigger another charge.";
    case "unknown":
      return "Access impact and cutoff rules are unverified — access may end immediately or require advance notice.";
  }
}

export function calculateLastSafeMoment(
  input: LastSafeMomentInput,
): LastSafeMomentResult {
  const now = input.now ?? new Date();
  const intent = input.userIntent ?? "stop_future_renewal";
  const disclaimer =
    "Conservative planning target based on stated terms and safety buffer — not a universal guarantee against provider billing rules.";

  const renewalDate = new Date(input.nextRenewalAt);
  if (Number.isNaN(renewalDate.getTime())) {
    return {
      canComputeSafeDate: false,
      urgency: "unknown_policy",
      headline: "Renewal date invalid — verify billing date manually",
      providerDeadlineAt: null,
      lastSafeDeadlineAt: null,
      accessImpactSummary: getAccessImpactSummary(input.policyType),
      assumptions: ["Renewal timestamp could not be parsed."],
      disclaimer,
    };
  }

  // Non-negotiable guardrail: NEVER invent a safe date when policy or confidence is unknown.
  if (input.policyType === "unknown" || input.policyConfidence === "unknown") {
    return {
      canComputeSafeDate: false,
      urgency: "unknown_policy",
      headline: "Deadline unknown — cancel now or verify terms",
      providerDeadlineAt: null,
      lastSafeDeadlineAt: null,
      accessImpactSummary: getAccessImpactSummary("unknown"),
      assumptions: [
        `Renewal timestamp tracked in ${input.timezone}.`,
        "Provider cancellation policy or cutoff notice period is unverified.",
        "LASTCALL refuses to invent a safe future date when policy terms are unknown.",
      ],
      disclaimer,
    };
  }

  const noticeDays =
    input.policyType === "notice_period" ? Math.max(0, Math.round(input.noticePeriodDays)) : 0;
  const bufferHours = Math.max(0, Math.round(input.safetyBufferHours));

  // Step 1: Compute provider deadline in provider timezone (preserves wall-clock across DST)
  const providerDeadline = subtractCalendarDaysInZone(
    renewalDate,
    noticeDays,
    input.timezone,
  );

  // Step 2: Subtract safety buffer (whole days stay wall-clock consistent; remainder hours subtracted directly)
  const wholeBufferDays = Math.floor(bufferHours / 24);
  const remBufferHours = bufferHours % 24;
  const afterBufferDays = subtractCalendarDaysInZone(
    providerDeadline,
    wholeBufferDays,
    input.timezone,
  );
  const lastSafeDate = new Date(
    afterBufferDays.getTime() - remBufferHours * 60 * 60 * 1000,
  );

  const hoursUntilSafe = (lastSafeDate.getTime() - now.getTime()) / (60 * 60 * 1000);

  let urgency: DeadlineUrgency;
  let headline: string;

  if (intent === "cancel_immediately") {
    urgency = "cancel_now_requested";
    headline = "Immediate cancellation selected — act now";
  } else if (hoursUntilSafe <= 0) {
    urgency = "overdue_window";
    headline = "Inside safety buffer — cancel immediately";
  } else if (hoursUntilSafe <= 48) {
    urgency = "upcoming_soon";
    headline = "Last Safe Moment approaching within 48 hours";
  } else {
    urgency = "safe_window";
    headline =
      intent === "preserve_access"
        ? "Conservative target calculated to stop renewal while preserving access"
        : "Conservative Last Safe Moment calculated";
  }

  const assumptions: string[] = [
    `Calculated in provider timezone (${input.timezone}), preserving local wall-clock time across DST boundaries.`,
    noticeDays > 0
      ? `Includes documented ${noticeDays}-day provider notice period before renewal.`
      : `Policy type '${input.policyType.replace("_", " ")}' assumes cancellation is accepted up to renewal.`,
    `Includes a configurable ${bufferHours}-hour safety buffer.`,
    `Policy confidence: ${input.policyConfidence.replace("_", " ")}.`,
  ];

  if (intent === "preserve_access" && input.policyType === "immediate") {
    assumptions.push(
      "Warning: this provider's policy is immediate-effect, so cancelling early will end access immediately.",
    );
  }

  return {
    canComputeSafeDate: true,
    urgency,
    headline,
    providerDeadlineAt: providerDeadline.toISOString(),
    lastSafeDeadlineAt: lastSafeDate.toISOString(),
    accessImpactSummary: getAccessImpactSummary(input.policyType),
    assumptions,
    disclaimer,
  };
}
