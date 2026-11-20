# LASTCALL Controlled Demo Billing Portal (`CloudStream Pro`)

> **Important:** This is an owned, controlled demo fixture built exclusively for the LASTCALL hackathon demonstration and independent **Kane CLI** verification. It is **not** a live integration with any third-party subscription provider.

## Local Setup

1. Configure `DEMO_PORTAL_EMAIL` and `DEMO_PORTAL_PASSWORD` in the root `.env.local` (see root `.env.example`; never commit real credentials).
2. Start the portal on port `3001`:
   ```bash
   npm run demo-portal
   ```
3. Open `http://localhost:3001` to view the sign-in screen.

## Cancellation Flow & Deterministic Failure Obstacle

1. `/login` — Sign in with the local fixture account.
2. `/billing` — Subscription Status (`Active`, renewal date shown, `Manage Plan` button, plus test-only fixture controls).
3. `/manage-plan` — Plan details and `Cancel Subscription`.
4. `/cancel/retention` — Retention offer (`Keep Plan with 40% Off` decoy vs `No thanks, continue to cancel`).
5. `/cancel/confirm` — Reason selector and `Confirm Cancellation`.
6. `/cancel/extra-confirm` *(when Extra Confirmation Obstacle is ENABLED)* — Subscription remains `Active` until the final acknowledgement checkbox is ticked and `Finalize Cancellation` is clicked. This enables a repeatable first-attempt failure that Kane CLI catches and feeds back to the agent for closed-loop recovery.
