import { chromium, type Browser } from "playwright";
import type { RecoveryStrategy } from "../lib/agent/feedback";
import type { BrowserAttemptResult } from "../lib/cancellation/closed-loop";

export interface BrowserAgentConfig {
  portalUrl: string;
  portalEmail: string;
  portalPassword: string;
  headless: boolean;
  strategy: "standard" | RecoveryStrategy;
}

async function launchBrowser(headless: boolean): Promise<Browser> {
  try {
    return await chromium.launch({
      channel: "chrome",
      headless,
      slowMo: headless ? 0 : 250,
    });
  } catch {
    return await chromium.launch({
      headless,
      slowMo: headless ? 0 : 250,
    });
  }
}

/**
 * Separate browser cancellation agent operating exclusively against the controlled demo billing portal.
 * Never claims cancellation succeeded — only executes the browser steps and captures an observation
 * plus screenshot for independent Kane CLI verification.
 */
export async function runDemoPortalBrowserAttempt(
  config: BrowserAgentConfig,
): Promise<BrowserAttemptResult> {
  let browser: Browser | null = null;

  try {
    browser = await launchBrowser(config.headless);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    const baseUrl = config.portalUrl.replace(/\/$/, "");
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 20_000 });

    // Safety check: pause if CAPTCHA / MFA prompt ever appears
    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    if (bodyText.includes("captcha") || bodyText.includes("one-time code") || bodyText.includes("two-factor")) {
      const screenshot = await page.screenshot({ fullPage: true });
      return {
        completedFlow: false,
        requiresHumanReason:
          "MFA or CAPTCHA challenge detected on portal. Paused per safety rules.",
        observation: "Stopped at MFA/CAPTCHA challenge.",
        screenshotBuffer: screenshot,
      };
    }

    // Sign in on controlled demo portal
    if (await page.locator('input[name="email"]').isVisible()) {
      await page.fill('input[name="email"]', config.portalEmail);
      await page.fill('input[name="password"]', config.portalPassword);
      await Promise.all([
        page.waitForURL(/\/billing|\/login/, { timeout: 15_000 }),
        page.click('[data-testid="login-submit"]'),
      ]);
    }

    if (page.url().includes("/login")) {
      const screenshot = await page.screenshot({ fullPage: true });
      return {
        completedFlow: false,
        requiresHumanReason:
          "Demo portal login failed. Verify DEMO_PORTAL_EMAIL and DEMO_PORTAL_PASSWORD.",
        observation: "Portal rejected demo credentials.",
        screenshotBuffer: screenshot,
      };
    }

    // Check if already cancelled
    const statusText = (
      await page.locator('[data-testid="subscription-status"]').textContent()
    )?.trim();
    if (statusText === "Cancelled") {
      const screenshot = await page.screenshot({ fullPage: true });
      return {
        completedFlow: true,
        requiresHumanReason: null,
        observation:
          "Portal billing page already displays Cancelled status; handing to Kane CLI for independent verification.",
        screenshotBuffer: screenshot,
      };
    }

    // Navigate cancellation path: Manage Plan -> Decline Retention -> Confirm Cancellation
    if (config.strategy === "complete_extra_confirmation") {
      await page.goto(`${baseUrl}/cancel/extra-confirm`, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });

      const ackCheckbox = page.locator('[data-testid="final-ack-checkbox"]');
      if (await ackCheckbox.isVisible()) {
        await ackCheckbox.check();
        await Promise.all([
          page.waitForURL(/\/billing/, { timeout: 15_000 }),
          page.click('[data-testid="finalize-cancel-btn"]'),
        ]);
        const screenshot = await page.screenshot({ fullPage: true });
        return {
          completedFlow: true,
          requiresHumanReason: null,
          observation:
            "Recovery attempt completed: ticked final acknowledgement checkbox and clicked Finalize Cancellation on /cancel/extra-confirm. Awaiting independent Kane CLI verification.",
          screenshotBuffer: screenshot,
        };
      }
    }

    // Standard cancellation navigation (Attempt 1)
    await Promise.all([
      page.waitForURL(/\/manage-plan/, { timeout: 15_000 }),
      page.click('[data-testid="manage-plan-btn"]'),
    ]);

    await Promise.all([
      page.waitForURL(/\/cancel\/retention/, { timeout: 15_000 }),
      page.click('[data-testid="start-cancel-btn"]'),
    ]);

    // Explicitly DECLINE retention offer (never accept upsells/retention offers without consent)
    await Promise.all([
      page.waitForURL(/\/cancel\/confirm/, { timeout: 15_000 }),
      page.click('[data-testid="decline-retention-btn"]'),
    ]);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }),
      page.click('[data-testid="confirm-cancel-btn"]'),
    ]);

    const currentUrl = page.url();
    const screenshot = await page.screenshot({ fullPage: true });

    // If strategy is standard and obstacle redirected to /cancel/extra-confirm,
    // Attempt 1 intentionally stops here (simulating a realistic missed secondary confirmation)
    // so Kane CLI independently catches that the subscription is still Active!
    if (currentUrl.includes("/cancel/extra-confirm")) {
      return {
        completedFlow: true,
        requiresHumanReason: null,
        observation:
          "Agent navigated Manage Plan -> declined retention offer -> clicked Confirm Cancellation. Portal presented an extra confirmation page (/cancel/extra-confirm) that was not yet completed.",
        screenshotBuffer: screenshot,
      };
    }

    return {
      completedFlow: true,
      requiresHumanReason: null,
      observation:
        "Agent navigated Manage Plan -> declined retention offer -> clicked Confirm Cancellation and returned to billing page. Awaiting independent Kane CLI verification.",
      screenshotBuffer: screenshot,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      completedFlow: false,
      requiresHumanReason: `Browser agent encountered an error on demo portal: ${message}`,
      observation: `Browser error: ${message}`,
      screenshotBuffer: null,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
