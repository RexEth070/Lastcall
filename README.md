# LASTCALL

> **Your subscriptions have an expiry date. Your AI makes sure they respect it.**

**LASTCALL** is a proof-first autonomous subscription cancellation agent built with **Google Antigravity** and independently verified with **Kane CLI** (`@testmuai/kane-cli`).

## The Winning Thesis — Proof Before Status

A button click is not a cancellation. An agent's self-reported success message is not proof. LASTCALL strictly separates action from verification:

1. **Last Safe Moment Planner:** Computes conservative cancellation deadlines using provider IANA timezone (preserving wall-clock time across DST boundaries), documented notice period, and configurable safety buffer. When provider policy or confidence is `unknown`, LASTCALL refuses to invent a safe date and advises cancelling now or verifying terms.
2. **Explicit Scoped Authorisation:** Per-subscription, single-action, expiring, revocable consent modal stating exact service, masked account identifier, next renewal, recurring charge, access impact, and agent boundaries. Server rejects all unauthorised cancellation jobs with `403`.
3. **Browser Cancellation Agent (Playwright):** Navigates the owned **Controlled Demo Billing Portal** (`demo-portal/` on `:3001`), explicitly declining retention offers and pausing on MFA/CAPTCHA.
4. **Independent Kane CLI Verification (`worker/kane-runner.ts`):** Spawns `kane-cli run --agent --assertion-mode dom --final-validation on` in an independent Chrome browser session to verify post-cancellation assertions (`Cancelled` status, no next renewal date, visible confirmation message).
5. **Closed-Loop Recovery:** When Kane returns `FAIL` (e.g. catching the portal's toggleable extra-confirmation obstacle), structured secret-free failure feedback is sent to **Gemini API** (`@google/genai`) to diagnose the missed step and run bounded recovery (max 2 retries) followed by Kane re-verification — or stop safely into `Needs human action`.
6. **Cancellation Evidence Vault:** Persists every attempt, Kane verdict, TestMu share link, run ID, and privately stored screenshot in Supabase Storage served via 60-second signed URLs.

---

## Architecture & Stack

- **Web App:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Lucide icons (`app/`, `components/`)
- **Database, Auth & Private Storage:** Supabase PostgreSQL + Auth + Row Level Security (RLS) on all 7 tables + private `cancellation-evidence` bucket (`supabase/migrations/`)
- **Cancellation Worker & Agent:** Persistent Node/TS worker (`worker/cancellation-worker.ts`), Playwright (`worker/browser-agent.ts`), Gemini API (`lib/agent/feedback.ts`), Kane CLI runner (`worker/kane-runner.ts`)
- **Controlled Demo Billing Portal:** Standalone fixture app (`demo-portal/` on `http://localhost:3001`) with a toggleable deterministic extra-confirmation obstacle

See [docs/architecture.md](docs/architecture.md) and [docs/demo-script.md](docs/demo-script.md) for full details.

---

## Local Setup

### 1. Environment Variables
Copy `.env.example` to `.env.local` (never commit `.env.local`) and fill in your keys:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `GEMINI_API_KEY` (optional fallback diagnostician runs if unset)
- `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` (seeded judge demo account)
- `DEMO_PORTAL_EMAIL` / `DEMO_PORTAL_PASSWORD` (controlled demo billing portal fixture)

### 2. Supabase Database Setup
Run both migrations in order inside Supabase **SQL Editor**:
1. `supabase/migrations/202611200001_initial_schema.sql`
2. `supabase/migrations/202611200002_table_grants.sql`

### 3. Install & Authenticate Kane CLI
```bash
npm install -g @testmuai/kane-cli
kane-cli login
kane-cli whoami
```

### 4. Run All 3 Local Processes (Demo Mode)
Open three terminals in the repository root:
```bash
# Terminal 1 — LASTCALL Web App (http://localhost:3000)
npm run dev

# Terminal 2 — Controlled Demo Billing Portal (http://localhost:3001)
npm run demo-portal

# Terminal 3 — Persistent Cancellation & Kane Verification Worker
npm run worker
```

### 5. Judge Demo Flow (3–5 Minutes)
1. Open `http://localhost:3000` → click **Try demo workspace** → click **Enter seeded demo account**.
2. Open **CloudStream Pro (Demo Portal)** → inspect the **Last Safe Moment** planner.
3. Click **Authorise cancellation** → complete the scoped consent modal → click **Attempt cancellation now**.
4. Watch the worker navigate `http://localhost:3001` (Attempt 1 stops at the extra-confirmation obstacle) → **Kane CLI independently returns `FAIL`** → structured feedback triggers Gemini recovery → Attempt 2 ticks the final checkbox and finalizes → **Kane CLI independently returns `PASS`**.
5. Inspect the visible fail → recovery → pass timeline under **Activity** and open the private signed screenshot + TestMu report in **Evidence**.

---

## Automated Tests & Quality Gates

```bash
npm run typecheck    # TypeScript strict check
npm run lint         # ESLint check
npm test             # Vitest suite (validation, Last Safe Moment + DST, auth guards, demo portal, closed-loop recovery)
npm run test:rls     # Live Supabase cross-user RLS isolation check
npm run build        # Production Next.js build
```

---

## Honest Scope & Limitations

- The **Controlled Demo Billing Portal** (`demo-portal/`) is an owned hackathon fixture, not a live integration with third-party subscription providers (Netflix, Adobe, etc.).
- In production hosting, the Next.js web app deploys to Vercel while the Playwright + Kane CLI worker runs on a persistent local or always-on host (never inside short-lived serverless functions).
- LASTCALL never stores passwords, card numbers, session cookies, or OTPs, never bypasses CAPTCHA/MFA/anti-bot controls, and treats a verified confirmation page as strong evidence rather than a legal guarantee against billing errors.
