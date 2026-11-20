# LASTCALL — Product Specification (MVP)

## Positioning
"Your subscriptions have an expiry date. Your AI makes sure they respect it."

## Core Promise — Proof Before Status
A button click is not a cancellation. An agent's self-reported success message is not proof. Only an independent **Kane CLI** verification pass with visible, persisted evidence may transition a subscription to `Verified cancelled`.

## Target Users
- **Primary:** Students and young professionals who sign up for free trials and digital services and face cancellation friction before renewals hit.
- **Secondary:** Freelancers and creators rotating monthly SaaS tools.

## MVP Features (P0)
1. **Authentication & Seeded Demo Mode:** Judges can enter a seeded demo account immediately without payment setup, while every user record remains protected by Supabase RLS.
2. **Subscription Inventory:** Create, edit, and archive subscriptions with service name, masked account label, integer minor-unit amount, ISO currency, cadence, next renewal timestamp, timezone, policy rules, and lifecycle status.
3. **Last Safe Moment Planner:** Conservative cancellation deadline calculator combining provider timezone, documented policy/notice period, and configurable safety buffer (default 48h). When policy is `unknown`, LASTCALL refuses to invent a safe deadline and instructs the user to cancel now or verify provider terms.
4. **Explicit Scoped Authorisation:** Per-subscription, single-action, expiring, revocable approval modal stating exact service, masked account, next renewal, access impact, and agent boundaries. Server rejects unauthorised jobs.
5. **Controlled Demo Billing Portal:** Standalone owned SaaS billing portal fixture (`demo-portal/` on `:3001`) implementing `Billing -> Manage Plan -> Retention Offer -> Confirm -> Final Status` plus a toggleable deterministic extra-confirmation obstacle.
6. **Browser Cancellation Agent:** Playwright-driven agent operating on the controlled demo portal without storing user passwords, card numbers, cookies, or OTPs.
7. **Independent Kane CLI Verification:** Separate server-side `kane-runner` executing `kane-cli run --agent --final-validation on` against the demo portal to independently confirm expected postconditions and collect evidence.
8. **Closed-Loop Recovery:** Structured Kane failure summary fed back to the Gemini-backed orchestrator for bounded recovery (max 2 retries), re-verified by Kane, or safely stopped into `Needs human action`.
9. **Cancellation Evidence Vault:** Private evidence storage with short-lived signed URLs, Kane verdicts, run IDs, timestamps, and an append-only audit timeline.

## Explicit Non-Goals (Hackathon MVP)
- No Gmail OAuth auto-discovery, bank/card integrations, refund claims, or mobile app.
- No broad "cancel everything" permission.
- No CAPTCHA/MFA/anti-bot bypasses.
- No fake live agent streams or exaggerated "money saved" totals (dashboard highlights **Renewals at risk**).
