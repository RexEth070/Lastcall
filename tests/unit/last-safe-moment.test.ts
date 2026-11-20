import { describe, expect, it } from "vitest";
import { calculateLastSafeMoment } from "@/lib/cancellation/last-safe-moment";

describe("Last Safe Moment calculator", () => {
  it("matches the Playbook example: 10 Dec 09:00 - 24h notice - 48h buffer = 7 Dec 09:00", () => {
    const result = calculateLastSafeMoment({
      nextRenewalAt: "2026-12-10T09:00:00.000Z",
      timezone: "UTC",
      policyType: "notice_period",
      policyConfidence: "verified",
      noticePeriodDays: 1,
      safetyBufferHours: 48,
      now: new Date("2026-12-01T09:00:00.000Z"),
    });

    expect(result.canComputeSafeDate).toBe(true);
    expect(result.providerDeadlineAt).toBe("2026-12-09T09:00:00.000Z");
    expect(result.lastSafeDeadlineAt).toBe("2026-12-07T09:00:00.000Z");
    expect(result.urgency).toBe("safe_window");
  });

  it("refuses to invent a safe date when policy type is unknown", () => {
    const result = calculateLastSafeMoment({
      nextRenewalAt: "2026-12-10T09:00:00.000Z",
      timezone: "Europe/London",
      policyType: "unknown",
      policyConfidence: "unknown",
      noticePeriodDays: 0,
      safetyBufferHours: 48,
    });

    expect(result.canComputeSafeDate).toBe(false);
    expect(result.urgency).toBe("unknown_policy");
    expect(result.providerDeadlineAt).toBeNull();
    expect(result.lastSafeDeadlineAt).toBeNull();
    expect(result.headline).toContain("Deadline unknown");
  });

  it("refuses to invent a safe date when policy confidence is unknown even if type is set", () => {
    const result = calculateLastSafeMoment({
      nextRenewalAt: "2026-12-10T09:00:00.000Z",
      timezone: "UTC",
      policyType: "end_of_period",
      policyConfidence: "unknown",
      noticePeriodDays: 0,
      safetyBufferHours: 48,
    });

    expect(result.canComputeSafeDate).toBe(false);
    expect(result.lastSafeDeadlineAt).toBeNull();
  });

  it("preserves provider local wall-clock time across US DST fall-back boundary (America/New_York)", () => {
    // 2026-11-01 is US DST fall-back (EDT UTC-4 -> EST UTC-5).
    // Renewal: 2026-11-02 09:00 EST (14:00Z).
    // 1-day notice = 2026-11-01 09:00 EST (14:00Z).
    // 48-hour (2-day) buffer = 2026-10-30 09:00 EDT (13:00Z) — wall-clock stays 09:00!
    const result = calculateLastSafeMoment({
      nextRenewalAt: "2026-11-02T14:00:00.000Z",
      timezone: "America/New_York",
      policyType: "notice_period",
      policyConfidence: "verified",
      noticePeriodDays: 1,
      safetyBufferHours: 48,
      now: new Date("2026-10-20T00:00:00.000Z"),
    });

    expect(result.canComputeSafeDate).toBe(true);
    expect(result.providerDeadlineAt).toBe("2026-11-01T14:00:00.000Z");
    expect(result.lastSafeDeadlineAt).toBe("2026-10-30T13:00:00.000Z");
  });

  it("preserves provider local wall-clock time across US DST spring-forward boundary (America/New_York)", () => {
    // 2026-03-08 is US DST spring-forward (EST UTC-5 -> EDT UTC-4).
    // Renewal: 2026-03-10 09:00 EDT (13:00Z).
    // 1-day notice = 2026-03-09 09:00 EDT (13:00Z).
    // 48-hour (2-day) buffer = 2026-03-07 09:00 EST (14:00Z).
    const result = calculateLastSafeMoment({
      nextRenewalAt: "2026-03-10T13:00:00.000Z",
      timezone: "America/New_York",
      policyType: "notice_period",
      policyConfidence: "verified",
      noticePeriodDays: 1,
      safetyBufferHours: 48,
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(result.canComputeSafeDate).toBe(true);
    expect(result.providerDeadlineAt).toBe("2026-03-09T13:00:00.000Z");
    expect(result.lastSafeDeadlineAt).toBe("2026-03-07T14:00:00.000Z");
  });

  it("flags overdue_window when current time is already inside the safety buffer", () => {
    const result = calculateLastSafeMoment({
      nextRenewalAt: "2026-11-22T09:00:00.000Z",
      timezone: "UTC",
      policyType: "end_of_period",
      policyConfidence: "verified",
      noticePeriodDays: 0,
      safetyBufferHours: 48,
      now: new Date("2026-11-21T09:00:00.000Z"),
    });

    expect(result.canComputeSafeDate).toBe(true);
    expect(result.urgency).toBe("overdue_window");
  });

  it("flags cancel_now_requested when user selects immediate cancellation", () => {
    const result = calculateLastSafeMoment({
      nextRenewalAt: "2026-12-20T09:00:00.000Z",
      timezone: "UTC",
      policyType: "end_of_period",
      policyConfidence: "verified",
      noticePeriodDays: 0,
      safetyBufferHours: 48,
      userIntent: "cancel_immediately",
      now: new Date("2026-12-01T09:00:00.000Z"),
    });

    expect(result.urgency).toBe("cancel_now_requested");
  });
});
