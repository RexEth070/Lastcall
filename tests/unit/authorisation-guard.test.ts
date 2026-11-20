import { describe, expect, it } from "vitest";
import {
  createAuthorisationSchema,
  validateScopedAuthorisation,
  type AuthorisationCheckRecord,
} from "@/lib/validation/authorisation";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SUB_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SUB_ID = "33333333-3333-4333-8333-333333333333";

const VALID_AUTH: AuthorisationCheckRecord = {
  id: "44444444-4444-4444-8444-444444444444",
  user_id: USER_ID,
  subscription_id: SUB_ID,
  action_type: "cancel_subscription",
  expires_at: "2026-11-21T12:00:00.000Z",
  revoked_at: null,
};

describe("server-side scoped authorisation guard", () => {
  const now = new Date("2026-11-21T11:00:00.000Z");

  it("accepts a valid, unexpired, unrevoked single-subscription authorisation", () => {
    const res = validateScopedAuthorisation(VALID_AUTH, USER_ID, SUB_ID, now);
    expect(res.valid).toBe(true);
  });

  it("rejects missing authorisation", () => {
    const res = validateScopedAuthorisation(null, USER_ID, SUB_ID, now);
    expect(res.valid).toBe(false);
  });

  it("rejects authorisation belonging to a different user", () => {
    const res = validateScopedAuthorisation(
      VALID_AUTH,
      "99999999-9999-4999-8999-999999999999",
      SUB_ID,
      now,
    );
    expect(res.valid).toBe(false);
  });

  it("rejects authorisation scoped to a different subscription (no broad cancel-all)", () => {
    const res = validateScopedAuthorisation(
      VALID_AUTH,
      USER_ID,
      OTHER_SUB_ID,
      now,
    );
    expect(res.valid).toBe(false);
  });

  it("rejects revoked authorisation", () => {
    const res = validateScopedAuthorisation(
      { ...VALID_AUTH, revoked_at: "2026-11-21T10:30:00.000Z" },
      USER_ID,
      SUB_ID,
      now,
    );
    expect(res.valid).toBe(false);
  });

  it("rejects expired authorisation", () => {
    const res = validateScopedAuthorisation(
      { ...VALID_AUTH, expires_at: "2026-11-21T10:59:59.000Z" },
      USER_ID,
      SUB_ID,
      now,
    );
    expect(res.valid).toBe(false);
  });

  it("requires exact confirmation phrase and checkbox when creating authorisation", () => {
    expect(
      createAuthorisationSchema.safeParse({
        subscriptionId: SUB_ID,
        expiresInMinutes: 60,
        explicitConfirmation: true,
        confirmationPhrase: "Authorise cancellation for this subscription",
      }).success,
    ).toBe(true);

    expect(
      createAuthorisationSchema.safeParse({
        subscriptionId: SUB_ID,
        expiresInMinutes: 60,
        explicitConfirmation: true,
        confirmationPhrase: "yes",
      }).success,
    ).toBe(false);
  });
});
