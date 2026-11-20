import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_FILE = path.join(__dirname, "fixtures", "state.json");

function defaultPortalState() {
  return {
    serviceName: "CloudStream Pro",
    planName: "Creator Monthly",
    priceLabel: "$24.00 / month",
    status: "Active", // "Active" | "Cancelled"
    nextRenewalDate: "25 Nov 2026, 09:00 UTC",
    confirmationCode: null,
    cancelledAt: null,
    requireExtraConfirmation: true,
    pendingExtraConfirm: false,
    lastReason: null,
  };
}

function readState(stateFile) {
  try {
    if (!fs.existsSync(stateFile)) {
      const initial = defaultPortalState();
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    return {
      ...defaultPortalState(),
      ...JSON.parse(fs.readFileSync(stateFile, "utf8")),
    };
  } catch {
    return defaultPortalState();
  }
}

function writeState(stateFile, state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf8");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const map = new Map();
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    map.set(part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim()));
  }
  return map;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function renderLayout({ title, body, email, showNav = true }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — CloudStream Pro Billing</title>
  <style>
    :root {
      --navy: #0b1220;
      --canvas: #f7f6f2;
      --card: #ffffff;
      --border: #e4e1da;
      --blue: #1d4ed8;
      --amber-bg: #fffbeb;
      --amber-border: #fcd34d;
      --amber-text: #78350f;
      --green-bg: #ecfdf5;
      --green-border: #6ee7b7;
      --green-text: #065f46;
      --red-bg: #fef2f2;
      --red-border: #fecaca;
      --red-text: #991b1b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
      background: var(--canvas);
      color: #0f172a;
      line-height: 1.5;
    }
    .fixture-banner {
      background: var(--amber-bg);
      border-bottom: 1px solid var(--amber-border);
      color: var(--amber-text);
      padding: 10px 16px;
      font-size: 12px;
      text-align: center;
    }
    header {
      background: var(--navy);
      color: #fff;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    header .brand {
      font-weight: 700;
      letter-spacing: -0.02em;
      font-size: 16px;
    }
    header .meta {
      font-size: 12px;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    main {
      max-width: 780px;
      margin: 32px auto;
      padding: 0 16px 48px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }
    h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -0.02em; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 0 0 12px; color: #475569; font-size: 14px; }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
      color: #0f172a;
    }
    .badge-active {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e3a8a;
    }
    .badge-cancelled {
      background: var(--green-bg);
      border-color: var(--green-border);
      color: var(--green-text);
    }
    .alert-success {
      background: var(--green-bg);
      border: 1px solid var(--green-border);
      color: var(--green-text);
      border-radius: 10px;
      padding: 14px 16px;
      margin: 16px 0;
      font-size: 14px;
    }
    .alert-warning {
      background: var(--amber-bg);
      border: 1px solid var(--amber-border);
      color: var(--amber-text);
      border-radius: 10px;
      padding: 14px 16px;
      margin: 16px 0;
      font-size: 14px;
    }
    .alert-error {
      background: var(--red-bg);
      border: 1px solid var(--red-border);
      color: var(--red-text);
      border-radius: 10px;
      padding: 12px 16px;
      margin: 16px 0;
      font-size: 13px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #efece5;
      font-size: 14px;
      gap: 12px;
    }
    .row:last-child { border-bottom: none; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #334155; }
    input[type="email"], input[type="password"], select {
      width: 100%;
      min-height: 44px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 14px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn-primary { background: var(--blue); color: #fff; }
    .btn-danger { background: #b91c1c; color: #fff; }
    .btn-secondary { background: #fff; color: #0f172a; border-color: var(--border); }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
    .checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #f8fafc;
      margin: 16px 0;
      cursor: pointer;
      font-weight: 500;
    }
    .checkbox-row input { width: 18px; height: 18px; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="fixture-banner">
    <strong>Controlled Demo Billing Portal Fixture (CloudStream Pro)</strong> — Owned test environment for LASTCALL &amp; Kane CLI verification. Not a live third-party provider.
  </div>
  <header>
    <div class="brand">CloudStream Pro · Billing Settings</div>
    ${
      showNav && email
        ? `<div class="meta">
            <span class="mono">${escapeHtml(email)}</span>
            <form method="POST" action="/logout" style="margin:0;">
              <button type="submit" class="btn btn-secondary" style="min-height:36px;padding:6px 12px;font-size:12px;">Sign out</button>
            </form>
          </div>`
        : ""
    }
  </header>
  <main>${body}</main>
</body>
</html>`;
}

export function createDemoPortalHandler(options = {}) {
  const portalEmail = (
    options.email ||
    process.env.DEMO_PORTAL_EMAIL ||
    "alex.demo@cloudstream.test"
  ).trim();
  const portalPassword =
    options.password || process.env.DEMO_PORTAL_PASSWORD || "DemoBilling2026!";
  const stateFile = options.stateFile || DEFAULT_STATE_FILE;
  const sessions = new Set();

  function isAuthenticated(req) {
    const token = parseCookies(req).get("cs_demo_session");
    return Boolean(token && sessions.has(token));
  }

  function redirect(res, location, extraHeaders = {}) {
    res.writeHead(302, { Location: location, ...extraHeaders });
    res.end();
  }

  function sendHtml(res, status, html) {
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  }

  function sendJson(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  }

  return async function handleRequest(req, res) {
    const url = new URL(req.url || "/", "http://localhost:3001");
    const pathname = url.pathname;
    const method = req.method || "GET";

    // Health & Fixture Control APIs (for automated tests & demo resets)
    if (method === "GET" && pathname === "/api/fixture/state") {
      return sendJson(res, 200, readState(stateFile));
    }

    if (method === "POST" && pathname === "/api/fixture/reset") {
      const raw = await readRequestBody(req);
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        // form-encoded fallback
      }
      const next = defaultPortalState();
      if (typeof body.requireExtraConfirmation === "boolean") {
        next.requireExtraConfirmation = body.requireExtraConfirmation;
      }
      writeState(stateFile, next);
      if ((req.headers.accept || "").includes("text/html")) {
        return redirect(res, "/billing");
      }
      return sendJson(res, 200, { ok: true, state: next });
    }

    if (method === "POST" && pathname === "/api/fixture/config") {
      const raw = await readRequestBody(req);
      const state = readState(stateFile);
      if (req.headers["content-type"]?.includes("application/json")) {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed.requireExtraConfirmation === "boolean") {
            state.requireExtraConfirmation = parsed.requireExtraConfirmation;
          }
        } catch {
          return sendJson(res, 400, { error: "Invalid JSON" });
        }
        writeState(stateFile, state);
        return sendJson(res, 200, { ok: true, state });
      }
      state.requireExtraConfirmation = !state.requireExtraConfirmation;
      writeState(stateFile, state);
      return redirect(res, "/billing");
    }

    // Login
    if (method === "GET" && (pathname === "/" || pathname === "/login")) {
      if (isAuthenticated(req)) {
        return redirect(res, "/billing");
      }
      const err = url.searchParams.get("error");
      const html = renderLayout({
        title: "Sign in",
        showNav: false,
        body: `
          <div class="card">
            <h1>Sign in to CloudStream Pro Billing</h1>
            <p>Access your demo subscription status and cancellation controls.</p>
            ${err ? `<div class="alert-error" role="alert">Invalid demo credentials. Check local setup instructions.</div>` : ""}
            <form method="POST" action="/login">
              <label for="email">Email address</label>
              <input id="email" name="email" type="email" required autocomplete="username" placeholder="alex.demo@cloudstream.test" />
              <label for="password">Password</label>
              <input id="password" name="password" type="password" required autocomplete="current-password" placeholder="Enter demo password" />
              <button type="submit" class="btn btn-primary" data-testid="login-submit">Sign in</button>
            </form>
          </div>
        `,
      });
      return sendHtml(res, 200, html);
    }

    if (method === "POST" && pathname === "/login") {
      const raw = await readRequestBody(req);
      const params = new URLSearchParams(raw);
      const email = (params.get("email") || "").trim();
      const password = params.get("password") || "";
      if (
        email.toLowerCase() === portalEmail.toLowerCase() &&
        password === portalPassword
      ) {
        const token = crypto.randomBytes(24).toString("hex");
        sessions.add(token);
        return redirect(res, "/billing", {
          "Set-Cookie": `cs_demo_session=${token}; HttpOnly; Path=/; SameSite=Lax`,
        });
      }
      return redirect(res, "/login?error=1");
    }

    if (method === "POST" && pathname === "/logout") {
      const token = parseCookies(req).get("cs_demo_session");
      if (token) sessions.delete(token);
      return redirect(res, "/login", {
        "Set-Cookie": "cs_demo_session=; HttpOnly; Path=/; Max-Age=0",
      });
    }

    // All billing & cancellation routes require authentication
    if (!isAuthenticated(req)) {
      return redirect(res, "/login");
    }

    // Billing / Subscription Status Page
    if (method === "GET" && pathname === "/billing") {
      const state = readState(stateFile);
      const isCancelled = state.status === "Cancelled";
      const html = renderLayout({
        title: "Subscription Status",
        email: portalEmail,
        body: `
          <div class="card">
            <h1>Subscription Status</h1>
            <p>Review your active plan, renewal schedule, and billing status.</p>

            ${
              isCancelled
                ? `<div class="alert-success" data-testid="cancellation-confirmation">
                    <strong>Cancellation confirmed.</strong> Your ${escapeHtml(state.serviceName)} subscription has been cancelled (Reference <span class="mono">${escapeHtml(state.confirmationCode)}</span>). No future renewals will be charged.
                   </div>`
                : state.pendingExtraConfirm
                  ? `<div class="alert-warning" data-testid="pending-extra-warning">
                      <strong>Cancellation incomplete:</strong> You started cancelling, but the required extra confirmation step has not been finalised yet. Your subscription is still <strong>Active</strong>.
                     </div>`
                  : ""
            }

            <div class="row">
              <span>Service &amp; Plan</span>
              <strong>${escapeHtml(state.serviceName)} — ${escapeHtml(state.planName)}</strong>
            </div>
            <div class="row">
              <span>Recurring Price</span>
              <span class="mono">${escapeHtml(state.priceLabel)}</span>
            </div>
            <div class="row">
              <span>Subscription Status</span>
              <span data-testid="subscription-status" class="badge ${isCancelled ? "badge-cancelled" : "badge-active"}">${escapeHtml(state.status)}</span>
            </div>
            ${
              !isCancelled
                ? `<div class="row" data-testid="next-renewal-row">
                    <span>Next Renewal Date</span>
                    <span class="mono" data-testid="next-renewal">${escapeHtml(state.nextRenewalDate)}</span>
                   </div>`
                : `<div class="row" data-testid="no-renewal-row">
                    <span>Upcoming Renewal</span>
                    <span>None (subscription cancelled)</span>
                   </div>`
            }

            ${
              !isCancelled
                ? `<div class="actions">
                    <a href="/manage-plan" class="btn btn-primary" data-testid="manage-plan-btn">Manage Plan</a>
                   </div>`
                : ""
            }
          </div>

          <div class="card">
            <h2>Hackathon Demo Fixture Controls (Test-Only)</h2>
            <p>Use these controls to test deterministic first-attempt failure and closed-loop recovery with Kane CLI.</p>
            <div class="row">
              <span>Extra confirmation required obstacle</span>
              <strong data-testid="obstacle-state">${state.requireExtraConfirmation ? "ENABLED" : "DISABLED"}</strong>
            </div>
            <div class="actions">
              <form method="POST" action="/api/fixture/config" style="margin:0;">
                <button type="submit" class="btn btn-secondary" data-testid="toggle-obstacle-btn">
                  ${state.requireExtraConfirmation ? "Disable extra confirmation obstacle" : "Enable extra confirmation obstacle"}
                </button>
              </form>
              <form method="POST" action="/api/fixture/reset" style="margin:0;">
                <button type="submit" class="btn btn-secondary" data-testid="reset-portal-btn">Reset Subscription to Active</button>
              </form>
            </div>
          </div>
        `,
      });
      return sendHtml(res, 200, html);
    }

    // Step 1: Manage Plan
    if (method === "GET" && pathname === "/manage-plan") {
      const state = readState(stateFile);
      if (state.status === "Cancelled") return redirect(res, "/billing");
      const html = renderLayout({
        title: "Manage Plan",
        email: portalEmail,
        body: `
          <div class="card">
            <h1>Manage ${escapeHtml(state.serviceName)} Plan</h1>
            <p>Current plan: <strong>${escapeHtml(state.planName)}</strong> (${escapeHtml(state.priceLabel)}).</p>
            <p>Next scheduled billing date: <span class="mono">${escapeHtml(state.nextRenewalDate)}</span>.</p>
            <div class="actions">
              <a href="/cancel/retention" class="btn btn-danger" data-testid="start-cancel-btn">Cancel Subscription</a>
              <a href="/billing" class="btn btn-secondary">Back to Billing</a>
            </div>
          </div>
        `,
      });
      return sendHtml(res, 200, html);
    }

    // Step 2: Retention Offer
    if (method === "GET" && pathname === "/cancel/retention") {
      const state = readState(stateFile);
      if (state.status === "Cancelled") return redirect(res, "/billing");
      const html = renderLayout({
        title: "Special Retention Offer",
        email: portalEmail,
        body: `
          <div class="card">
            <h1>Wait — keep CloudStream Pro for 40% off?</h1>
            <p>Stay on Creator Monthly for <strong>$14.40/month</strong> for the next 3 billing cycles instead of cancelling today.</p>
            <div class="actions">
              <a href="/billing" class="btn btn-primary" data-testid="accept-retention-btn">Keep Plan with 40% Off</a>
              <a href="/cancel/confirm" class="btn btn-secondary" data-testid="decline-retention-btn">No thanks, continue to cancel</a>
            </div>
          </div>
        `,
      });
      return sendHtml(res, 200, html);
    }

    // Step 3: Initial Confirm Cancellation
    if (method === "GET" && pathname === "/cancel/confirm") {
      const state = readState(stateFile);
      if (state.status === "Cancelled") return redirect(res, "/billing");
      const html = renderLayout({
        title: "Confirm Cancellation",
        email: portalEmail,
        body: `
          <div class="card">
            <h1>Confirm Cancellation</h1>
            <p>You are requesting to cancel <strong>${escapeHtml(state.serviceName)} (${escapeHtml(state.planName)})</strong>.</p>
            <form method="POST" action="/cancel/confirm">
              <label for="reason">Primary reason for cancelling</label>
              <select id="reason" name="reason">
                <option value="no_longer_needed">No longer needed</option>
                <option value="too_expensive">Too expensive</option>
                <option value="switching_service">Switching to another service</option>
              </select>
              <div class="actions">
                <button type="submit" class="btn btn-danger" data-testid="confirm-cancel-btn">Confirm Cancellation</button>
                <a href="/billing" class="btn btn-secondary">Keep Subscription</a>
              </div>
            </form>
          </div>
        `,
      });
      return sendHtml(res, 200, html);
    }

    if (method === "POST" && pathname === "/cancel/confirm") {
      const raw = await readRequestBody(req);
      const params = new URLSearchParams(raw);
      const state = readState(stateFile);
      state.lastReason = params.get("reason") || "no_longer_needed";

      if (state.requireExtraConfirmation) {
        // Obstacle Mode ON: subscription stays Active until extra confirmation is finalized!
        state.pendingExtraConfirm = true;
        writeState(stateFile, state);
        return redirect(res, "/cancel/extra-confirm");
      }

      // Normal Mode: cancel immediately
      state.status = "Cancelled";
      state.pendingExtraConfirm = false;
      state.confirmationCode = `CNCL-${Date.now().toString().slice(-6)}`;
      state.cancelledAt = new Date().toISOString();
      writeState(stateFile, state);
      return redirect(res, "/billing");
    }

    // Step 4 (Obstacle Mode): Extra Confirmation Required
    if (method === "GET" && pathname === "/cancel/extra-confirm") {
      const state = readState(stateFile);
      if (state.status === "Cancelled") return redirect(res, "/billing");
      const missingAck = url.searchParams.get("missingAck") === "1";
      const html = renderLayout({
        title: "Extra Confirmation Required",
        email: portalEmail,
        body: `
          <div class="card">
            <h1>Additional confirmation required</h1>
            <div class="alert-warning" data-testid="extra-confirm-notice">
              <strong>Your subscription is still Active.</strong> To prevent accidental cancellations, tick the final acknowledgement below and click <strong>Finalize Cancellation</strong>.
            </div>
            ${
              missingAck
                ? `<div class="alert-error" role="alert">You must tick the confirmation checkbox before finalizing cancellation.</div>`
                : ""
            }
            <form method="POST" action="/cancel/extra-confirm">
              <label class="checkbox-row">
                <input type="checkbox" name="acknowledge" value="yes" data-testid="final-ack-checkbox" />
                <span>I understand my ${escapeHtml(state.serviceName)} subscription will be cancelled and no future renewal will occur.</span>
              </label>
              <div class="actions">
                <button type="submit" class="btn btn-danger" data-testid="finalize-cancel-btn">Finalize Cancellation</button>
                <a href="/billing" class="btn btn-secondary">Return to Billing (Keep Active)</a>
              </div>
            </form>
          </div>
        `,
      });
      return sendHtml(res, 200, html);
    }

    if (method === "POST" && pathname === "/cancel/extra-confirm") {
      const raw = await readRequestBody(req);
      const params = new URLSearchParams(raw);
      if (params.get("acknowledge") !== "yes") {
        return redirect(res, "/cancel/extra-confirm?missingAck=1");
      }
      const state = readState(stateFile);
      state.status = "Cancelled";
      state.pendingExtraConfirm = false;
      state.confirmationCode = `CNCL-${Date.now().toString().slice(-6)}`;
      state.cancelledAt = new Date().toISOString();
      writeState(stateFile, state);
      return redirect(res, "/billing");
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  };
}

export function startDemoPortalServer(port = Number(process.env.PORT || 3001)) {
  const handler = createDemoPortalHandler();
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve(server);
    });
  });
}
