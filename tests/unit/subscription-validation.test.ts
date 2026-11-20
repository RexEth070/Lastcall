import { describe, expect, it } from "vitest";
import { previewLastSafeDeadlineIso } from "@/lib/db/types";
import {
  formatMinorToMajorInput,
  isValidTimeZone,
  parseMajorAmountToMinor,
  subscriptionInputSchema,
  subscriptionUpdateSchema,
} from "@/lib/validation/subscription";

const VALID_BASE = {
  serviceName: "CloudStream Pro",
  planName: "Creator Monthly",
  accountLabel: "alex.d***@cloudstream.test",
  amountMinor: 2499,
  currency: "USD",
  cadence: "monthly" as const,
  nextRenewalAt: "2026-12-10T09:00:00.000Z",
  timezone: "UTC",
  policyType: "notice_period" as const,
  noticePeriodDays: 1,
  safetyBufferHours: 48,
  cancellationPolicyText: "24 hours notice required before renewal.",
  policyConfidence: "verified" as const,
  isControlledDemoPortal: true,
  portalUrl: "http://localhost:3001/billing",
  manualFallbackUrl: "http://localhost:3001/billing",
  notes: "Demo fixture",
};

describe("minor-unit money conversion (no floating-point drift)", () => {
  it("parses exact major currency strings into integer minor units", () => {
    expect(parseMajorAmountToMinor("19.99")).toBe(1999);
    expect(parseMajorAmountToMinor("0.10")).toBe(10);
    expect(parseMajorAmountToMinor("0.5")).toBe(50);
    expect(parseMajorAmountToMinor("100")).toBe(10000);
    expect(parseMajorAmountToMinor("2400.00")).toBe(240000);
    expect(formatMinorToMajorInput(1999)).toBe("19.99");
    expect(formatMinorToMajorInput(5)).toBe("0.05");
  });

  it("rejects zero, negative, non-numeric, or >2 decimal values", () => {
    expect(parseMajorAmountToMinor("0")).toBeNull();
    expect(parseMajorAmountToMinor("0.00")).toBeNull();
    expect(parseMajorAmountToMinor("-19.99")).toBeNull();
    expect(parseMajorAmountToMinor("12.999")).toBeNull();
    expect(parseMajorAmountToMinor("abc")).toBeNull();
    expect(parseMajorAmountToMinor("")).toBeNull();
  });
});

describe("subscription validation schema", () => {
  it("accepts a valid subscription payload", () => {
    const res = subscriptionInputSchema.safeParse(VALID_BASE);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.amountMinor).toBe(2499);
      expect(res.data.currency).toBe("USD");
    }
  });

  it("rejects invalid amount, date, ISO currency, and timezone", () => {
    expect(
      subscriptionInputSchema.safeParse({ ...VALID_BASE, amountMinor: -100 })
        .success,
    ).toBe(false);
    expect(
      subscriptionInputSchema.safeParse({ ...VALID_BASE, amountMinor: 19.99 })
        .success,
    ).toBe(false);
    expect(
      subscriptionInputSchema.safeParse({ ...VALID_BASE, currency: "US" })
        .success,
    ).toBe(false);
    expect(
      subscriptionInputSchema.safeParse({ ...VALID_BASE, currency: "123" })
        .success,
    ).toBe(false);
    expect(
      subscriptionInputSchema.safeParse({
        ...VALID_BASE,
        nextRenewalAt: "not-a-date",
      }).success,
    ).toBe(false);
    expect(
      subscriptionInputSchema.safeParse({
        ...VALID_BASE,
        timezone: "Mars/Olympus_Mons",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown policy claiming verified confidence", () => {
    const res = subscriptionInputSchema.safeParse({
      ...VALID_BASE,
      policyType: "unknown",
      noticePeriodDays: 0,
      policyConfidence: "verified",
    });
    expect(res.success).toBe(false);
  });

  it("rejects unexpected credential fields on update (strict mode)", () => {
    const res = subscriptionUpdateSchema.safeParse({
      serviceName: "Safe Update",
      password: "do-not-store-passwords",
    });
    expect(res.success).toBe(false);
  });

  it("validates IANA timezones accurately", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Africa/Lagos")).toBe(true);
    expect(isValidTimeZone("Invalid/Zone")).toBe(false);
  });
});

describe("conservative Last Safe Moment preview guardrail", () => {
  it("never invents a deadline when policy is unknown", () => {
    const deadline = previewLastSafeDeadlineIso({
      next_renewal_at: "2026-12-10T09:00:00.000Z",
      policy_type: "unknown",
      policy_confidence: "unknown",
      notice_period_days: 0,
      safety_buffer_hours: 48,
    });
    expect(deadline).toBeNull();
  });

  it("subtracts notice period + safety buffer when policy is verified", () => {
    const deadline = previewLastSafeDeadlineIso({
      next_renewal_at: "2026-12-10T09:00:00.000Z",
      policy_type: "notice_period",
      policy_confidence: "verified",
      notice_period_days: 1,
      safety_buffer_hours: 48,
    });
    expect(deadline).toBe("2026-12-07T09:00:00.000Z");
  });
});
