# LASTCALL — System Architecture

## 1. Core Thesis: Proof Before Status

LASTCALL separates **action** from **verification**. A click or self-reported success from the cancellation agent never marks a subscription as cancelled. Only an independent **Kane CLI** verification pass with captured evidence may transition a subscription to `VERIFIED_CANCELLED`.

## 2. Layered Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Web Application | Next.js (App Router), TypeScript, Tailwind CSS, shadcn-style UI | Landing page, onboarding/demo mode, dashboard, subscription inventory, Last Safe Moment planner, consent modal, activity timeline, and Evidence Vault |
| Database, Auth & Private Storage | Supabase (PostgreSQL + Auth + RLS + Storage) | User-scoped persistence for profiles, subscriptions, scoped authorisations, jobs, attempts, evidence metadata, append-only audit log, and private evidence files |
| Server API | Next.js Route Handlers | Input validation (Zod), authorisation enforcement, idempotent job creation, safe Stop Agent requests, and short-lived signed evidence URLs |
| Cancellation Worker & Agent | Persistent Node/TS Worker + Playwright + Gemini API (`@google/genai`) | Claims authorised jobs, drives visible Chromium against the owned demo billing portal, interprets Kane failure feedback, and executes bounded recovery (max 2 retries) |
| Independent Verification | Kane CLI (`@testmuai/kane-cli`) | Launches independent browser session via `kane-cli run --agent --final-validation on`, checks post-cancellation assertions, and emits structured NDJSON verdicts and evidence |
| Controlled Demo Billing Portal | Standalone Next.js app (`demo-portal/` on `:3001`) | Realistic SaaS billing fixture (`Billing -> Manage Plan -> Retention Offer -> Confirm -> Final Status`) with a toggleable deterministic extra-confirmation obstacle |

## 3. Data Flow

```text
User -> Next.js UI -> Next.js API (Zod + Auth + Scoped Authorisation + Idempotency)
  -> Supabase DB (RLS)
  -> Worker (cancellation-worker.ts)
     -> Playwright Browser Agent -> Controlled Demo Billing Portal (:3001)
     -> Kane CLI Runner (kane-runner.ts) -> Independent Verification on Demo Portal
        -> PASS + Postconditions + Evidence -> Private Storage + VERIFIED_CANCELLED
        -> FAIL -> Structured Feedback -> Gemini Diagnosis -> Bounded Retry (max 2) -> Kane Re-Check
        -> Retries Exhausted / Blocked / Timeout -> NEEDS_HUMAN_ACTION (never marked cancelled)
```

## 4. Closed-Loop Job State Machine

`PENDING_APPROVAL -> AUTHORISED -> AGENT_RUNNING -> KANE_VERIFYING`
- On Kane PASS + verified postconditions + saved evidence: `-> VERIFIED_CANCELLED`
- On Kane FAIL (attempts remaining <= 2): `-> RECOVERY_REQUIRED -> AGENT_RECOVERY -> KANE_VERIFYING`
- On Kane FAIL (max retries exhausted) or CAPTCHA/MFA/ambiguity: `-> NEEDS_HUMAN_ACTION`
- On Kane CLI timeout / unavailable / malformed output: `-> VERIFICATION_UNAVAILABLE -> NEEDS_HUMAN_ACTION`
- On user pressing Stop Agent: `-> STOPPED_BY_USER` (audit event recorded)

## 5. Honest Scope Boundaries

- The controlled demo billing portal is an owned hackathon test fixture, not a live integration with third-party subscription providers.
- Web UI deploys to Vercel; the Playwright + Kane CLI worker runs persistently (locally during demo) and reports worker heartbeat status honestly.
- No passwords, payment card numbers, session cookies, or OTPs are stored in application tables or passed into LLM prompts.
