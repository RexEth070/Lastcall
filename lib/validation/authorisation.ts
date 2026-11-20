import { z } from "zod";

export const createAuthorisationSchema = z.object({
  subscriptionId: z.string().uuid("Valid subscription ID is required."),
  expiresInMinutes: z
    .number()
    .int()
    .min(10, "Expiry must be at least 10 minutes.")
    .max(1440, "Authorisation cannot exceed 24 hours.")
    .default(60),
  explicitConfirmation: z.literal(true, {
    errorMap: () => ({
      message: "You must explicitly confirm authorisation for this subscription.",
    }),
  }),
  confirmationPhrase: z
    .string()
    .trim()
    .refine(
      (val) =>
        val.toLowerCase() === "authorise cancellation for this subscription",
      {
        message:
          "Type 'Authorise cancellation for this subscription' to confirm.",
      },
    ),
  confirmationVersion: z.string().default("v1"),
});

export const createCancellationJobSchema = z.object({
  subscriptionId: z.string().uuid("Valid subscription ID is required."),
  authorisationId: z.string().uuid("Scoped authorisation ID is required."),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Idempotency key must be at least 8 characters.")
    .max(128, "Idempotency key is too long."),
  executionMode: z
    .enum(["attempt_now", "schedule_attempt"])
    .default("attempt_now"),
  scheduledFor: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "Scheduled time must be a valid ISO timestamp.",
    }),
});

export interface AuthorisationCheckRecord {
  id: string;
  user_id: string;
  subscription_id: string;
  action_type: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface AuthorisationValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Pure server-side authorisation guard enforcing single-user, single-subscription,
 * unexpired, unrevoked scoped consent before any cancellation job may start.
 */
export function validateScopedAuthorisation(
  auth: AuthorisationCheckRecord | null | undefined,
  expectedUserId: string,
  expectedSubscriptionId: string,
  now: Date = new Date(),
): AuthorisationValidationResult {
  if (!auth) {
    return {
      valid: false,
      reason: "No scoped authorisation found for this subscription.",
    };
  }
  if (auth.user_id !== expectedUserId) {
    return {
      valid: false,
      reason: "Authorisation does not belong to the authenticated user.",
    };
  }
  if (auth.subscription_id !== expectedSubscriptionId) {
    return {
      valid: false,
      reason: "Authorisation is scoped to a different subscription.",
    };
  }
  if (auth.action_type !== "cancel_subscription") {
    return {
      valid: false,
      reason: "Authorisation action type does not permit cancellation.",
    };
  }
  if (auth.revoked_at !== null) {
    return {
      valid: false,
      reason: "Authorisation has been revoked.",
    };
  }
  const expiresMs = Date.parse(auth.expires_at);
  if (Number.isNaN(expiresMs) || expiresMs <= now.getTime()) {
    return {
      valid: false,
      reason: "Authorisation has expired. Please grant a fresh approval.",
    };
  }
  return { valid: true };
}
