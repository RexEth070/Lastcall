# LASTCALL

> **Your subscriptions have an expiry date. Your AI makes sure they respect it.**

LASTCALL is a proof-first subscription cancellation agent built with **Google Antigravity** and independently verified by **Kane CLI**.

## Proof Before Status

A button click is not a cancellation. An agent's self-reported success message is not proof. LASTCALL separates browser execution from independent verification:

1. **Last Safe Moment Planner:** Computes conservative cancellation deadlines using provider timezone, notice period, and safety buffer — and refuses to invent a safe date when policy terms are unknown.
2. **Explicit Scoped Authorisation:** Requires single-subscription, single-action, expiring, revocable approval before any browser action starts.
3. **Browser Cancellation Agent:** Operates against an owned **controlled demo billing portal** fixture (never live third-party provider credentials or payment cards).
4. **Independent Kane CLI Verification & Closed-Loop Recovery:** Kane CLI independently inspects the post-cancellation browser state. Failures generate structured feedback for up to two bounded recovery retries — or stop safely into `Needs human action`.
5. **Cancellation Evidence Vault:** Persists Kane verdicts, run IDs, timestamps, and redacted evidence artifacts in private storage.

## Current Build Progress

- [x] **Phase 0:** Fresh hackathon Git repo, workspace rules (`.agents/rules/lastcall-product.md`), architecture & product spec, Day-1 Kane CLI smoke test evidence (`docs/kane-smoke-evidence/day1-smoke-summary.md`).
- [x] **Phase 1:** Next.js TypeScript + Tailwind fintech UI shell (Landing, Onboarding, Dashboard, Subscriptions, Activity, Evidence) with clearly labelled demo data and loading/empty/error/mobile states.
- [ ] **Phase 2:** Supabase schema, RLS, Auth/Demo mode, and validated Subscription CRUD.
- [ ] **Phase 3:** Timezone-aware Last Safe Moment calculator & explicit scoped consent modal.
- [ ] **Phase 4:** Controlled Demo Billing Portal (`demo-portal/`) with toggleable extra-confirmation obstacle.
- [ ] **Phase 5:** Persistent Worker, Playwright browser agent, Kane CLI runner, and private Evidence Vault.
- [ ] **Phase 6:** Closed-loop recovery (`FAIL -> feedback -> retry -> PASS`), automated tests, and hardening.

## Local Development

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Verification Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Honest Scope & Limitations

- The demo billing portal is an owned test fixture, not a live integration with third-party subscription providers.
- LASTCALL never stores raw passwords, payment card numbers, session cookies, or OTPs, and never bypasses CAPTCHA, MFA, or anti-bot protections.
