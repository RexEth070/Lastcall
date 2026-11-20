import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error ESM fixture module without separate .d.ts
import { createDemoPortalHandler } from "@/demo-portal/app.mjs";

const EMAIL = "test.fixture@cloudstream.test";
const PASSWORD = "FixturePassword2026!";

describe("Controlled Demo Billing Portal", () => {
  let server: http.Server;
  let baseUrl: string;
  let stateFile: string;

  beforeAll(async () => {
    stateFile = path.join(
      os.tmpdir(),
      `lastcall-demo-portal-test-${Date.now()}.json`,
    );
    const handler = createDemoPortalHandler({
      email: EMAIL,
      password: PASSWORD,
      stateFile,
    });
    server = http.createServer(handler);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("Failed to bind ephemeral port");
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(stateFile, { force: true });
  });

  async function loginCookie(): Promise<string> {
    const res = await fetch(`${baseUrl}/login`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: EMAIL, password: PASSWORD }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/billing");
    const cookie = res.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toContain("cs_demo_session=");
    return cookie!;
  }

  it("redirects unauthenticated billing requests to /login", async () => {
    const res = await fetch(`${baseUrl}/billing`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("cancels cleanly in normal mode when extra confirmation obstacle is OFF", async () => {
    await fetch(`${baseUrl}/api/fixture/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requireExtraConfirmation: false }),
    });

    const cookie = await loginCookie();

    const confirmRes = await fetch(`${baseUrl}/cancel/confirm`, {
      method: "POST",
      redirect: "manual",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ reason: "no_longer_needed" }),
    });
    expect(confirmRes.status).toBe(302);
    expect(confirmRes.headers.get("location")).toBe("/billing");

    const billingHtml = await (
      await fetch(`${baseUrl}/billing`, { headers: { Cookie: cookie } })
    ).text();
    expect(billingHtml).toContain('data-testid="subscription-status"');
    expect(billingHtml).toContain(">Cancelled<");
    expect(billingHtml).toContain('data-testid="cancellation-confirmation"');
    expect(billingHtml).not.toContain('data-testid="next-renewal-row"');
  });

  it("keeps subscription Active on first confirm when extra confirmation obstacle is ON, then cancels after final acknowledgement", async () => {
    await fetch(`${baseUrl}/api/fixture/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requireExtraConfirmation: true }),
    });

    const cookie = await loginCookie();

    // Attempt 1: submits initial confirm, gets redirected to /cancel/extra-confirm
    const firstConfirm = await fetch(`${baseUrl}/cancel/confirm`, {
      method: "POST",
      redirect: "manual",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ reason: "too_expensive" }),
    });
    expect(firstConfirm.status).toBe(302);
    expect(firstConfirm.headers.get("location")).toBe("/cancel/extra-confirm");

    // Independent check on /billing MUST still see Active + renewal date!
    const afterAttempt1Html = await (
      await fetch(`${baseUrl}/billing`, { headers: { Cookie: cookie } })
    ).text();
    expect(afterAttempt1Html).toContain(">Active<");
    expect(afterAttempt1Html).toContain('data-testid="next-renewal-row"');

    // Submitting extra-confirm without checking acknowledgement must NOT cancel
    const missingAck = await fetch(`${baseUrl}/cancel/extra-confirm`, {
      method: "POST",
      redirect: "manual",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({}),
    });
    expect(missingAck.headers.get("location")).toBe(
      "/cancel/extra-confirm?missingAck=1",
    );

    // Attempt 2 recovery: ticks checkbox and clicks Finalize Cancellation
    const finalized = await fetch(`${baseUrl}/cancel/extra-confirm`, {
      method: "POST",
      redirect: "manual",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ acknowledge: "yes" }),
    });
    expect(finalized.status).toBe(302);
    expect(finalized.headers.get("location")).toBe("/billing");

    // Independent check on /billing now sees Cancelled + confirmation + no renewal date!
    const afterAttempt2Html = await (
      await fetch(`${baseUrl}/billing`, { headers: { Cookie: cookie } })
    ).text();
    expect(afterAttempt2Html).toContain(">Cancelled<");
    expect(afterAttempt2Html).toContain(
      'data-testid="cancellation-confirmation"',
    );
    expect(afterAttempt2Html).not.toContain('data-testid="next-renewal-row"');
  });
});
