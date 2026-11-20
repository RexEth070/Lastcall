import { z } from "zod";

export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "CAD",
  "AUD",
  "INR",
] as const;

export const BILLING_CADENCES = [
  "monthly",
  "quarterly",
  "annual",
  "trial",
] as const;

export const POLICY_TYPES = [
  "immediate",
  "end_of_period",
  "notice_period",
  "unknown",
] as const;

export const POLICY_CONFIDENCES = [
  "verified",
  "user_provided",
  "unknown",
] as const;

export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Kolkata",
  "Asia/Singapore",
] as const;

/**
 * Checks whether a string is a valid IANA timezone identifier via Intl.
 */
export function isValidTimeZone(tz: string): boolean {
  const trimmed = tz.trim();
  if (!trimmed) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a major-unit string (e.g. "24.99", "12", "0.50") to exact integer minor units (2499, 1200, 50)
 * using string arithmetic — never floating-point multiplication.
 * Returns null if the input is invalid, <= 0, or has more than 2 decimal places.
 */
export function parseMajorAmountToMinor(raw: string): number | null {
  const cleaned = raw.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const [wholePart, fracPart = ""] = cleaned.split(".");
  const paddedFrac = (fracPart + "00").slice(0, 2);
  const whole = Number.parseInt(wholePart, 10);
  const frac = Number.parseInt(paddedFrac, 10);
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(frac)) {
    return null;
  }
  const minor = whole * 100 + frac;
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 100_000_000) {
    return null;
  }
  return minor;
}

export function formatMinorToMajorInput(amountMinor: number): string {
  const safe = Math.max(0, Math.round(amountMinor));
  const whole = Math.floor(safe / 100);
  const frac = String(safe % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}

function isValidOptionalHttpUrl(val: string | null | undefined): boolean {
  if (!val || val.trim() === "") return true;
  try {
    const parsed = new URL(val.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const subscriptionInputSchema = z
  .object({
    serviceName: z
      .string()
      .trim()
      .min(1, "Service name is required.")
      .max(120, "Service name must be 120 characters or fewer."),
    planName: z
      .string()
      .trim()
      .min(1, "Plan name is required.")
      .max(120, "Plan name must be 120 characters or fewer.")
      .default("Standard"),
    accountLabel: z
      .string()
      .trim()
      .min(1, "Masked account label is required (e.g. sam.***@email.com).")
      .max(160, "Account label must be 160 characters or fewer."),
    amountMinor: z
      .number()
      .int("Amount must be an integer in minor units.")
      .positive("Amount must be greater than zero.")
      .max(100_000_000, "Amount exceeds supported limit."),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Currency must be a valid 3-letter ISO code (e.g. USD, EUR, GBP)."),
    cadence: z.enum(BILLING_CADENCES),
    nextRenewalAt: z
      .string()
      .trim()
      .refine((val) => !Number.isNaN(Date.parse(val)), {
        message: "Next renewal date must be a valid ISO date/time.",
      }),
    timezone: z
      .string()
      .trim()
      .refine(isValidTimeZone, {
        message: "Timezone must be a valid IANA timezone (e.g. UTC, America/New_York).",
      }),
    policyType: z.enum(POLICY_TYPES),
    noticePeriodDays: z
      .number()
      .int("Notice period must be a whole number of days.")
      .min(0, "Notice period cannot be negative.")
      .max(365, "Notice period cannot exceed 365 days."),
    safetyBufferHours: z
      .number()
      .int("Safety buffer must be a whole number of hours.")
      .min(0, "Safety buffer cannot be negative.")
      .max(336, "Safety buffer cannot exceed 14 days (336 hours).")
      .default(48),
    cancellationPolicyText: z
      .string()
      .trim()
      .max(1000, "Policy notes must be 1000 characters or fewer.")
      .default(""),
    policyConfidence: z.enum(POLICY_CONFIDENCES),
    isControlledDemoPortal: z.boolean().default(false),
    portalUrl: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(isValidOptionalHttpUrl, {
        message: "Portal URL must start with http:// or https://.",
      }),
    manualFallbackUrl: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(isValidOptionalHttpUrl, {
        message: "Manual fallback URL must start with http:// or https://.",
      }),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes must be 1000 characters or fewer.")
      .default(""),
  })
  .superRefine((data, ctx) => {
    if (data.policyType === "unknown" && data.policyConfidence === "verified") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["policyConfidence"],
        message: "Unknown policy cannot be marked as verified confidence.",
      });
    }
    if (data.policyType !== "notice_period" && data.noticePeriodDays > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["noticePeriodDays"],
        message: "Notice period days only applies when policy type is 'notice_period'.",
      });
    }
  });

export const subscriptionUpdateSchema = z
  .object({
    serviceName: z.string().trim().min(1).max(120).optional(),
    planName: z.string().trim().min(1).max(120).optional(),
    accountLabel: z.string().trim().min(1).max(160).optional(),
    amountMinor: z.number().int().positive().max(100_000_000).optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Currency must be a valid 3-letter ISO code.")
      .optional(),
    cadence: z.enum(BILLING_CADENCES).optional(),
    nextRenewalAt: z
      .string()
      .trim()
      .refine((val) => !Number.isNaN(Date.parse(val)), {
        message: "Next renewal date must be valid.",
      })
      .optional(),
    timezone: z
      .string()
      .trim()
      .refine(isValidTimeZone, { message: "Timezone must be a valid IANA timezone." })
      .optional(),
    policyType: z.enum(POLICY_TYPES).optional(),
    noticePeriodDays: z.number().int().min(0).max(365).optional(),
    safetyBufferHours: z.number().int().min(0).max(336).optional(),
    cancellationPolicyText: z.string().trim().max(1000).optional(),
    policyConfidence: z.enum(POLICY_CONFIDENCES).optional(),
    isControlledDemoPortal: z.boolean().optional(),
    portalUrl: z
      .string()
      .trim()
      .nullable()
      .optional()
      .refine(isValidOptionalHttpUrl, {
        message: "Portal URL must start with http:// or https://.",
      }),
    manualFallbackUrl: z
      .string()
      .trim()
      .nullable()
      .optional()
      .refine(isValidOptionalHttpUrl, {
        message: "Manual fallback URL must start with http:// or https://.",
      }),
    notes: z.string().trim().max(1000).optional(),
    archived: z.boolean().optional(),
  })
  .strict();

export const authCredentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export type SubscriptionInput = z.infer<typeof subscriptionInputSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;
