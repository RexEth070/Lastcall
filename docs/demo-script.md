# LASTCALL — 3–5 Minute Demo Script (Draft)

| Time | Screen / Action | Narration / Proof |
| --- | --- | --- |
| 0:00–0:25 | Landing & Dashboard (`Renewals at risk`) | "People don't just forget subscriptions; they get trapped in cancellation friction." |
| 0:25–0:55 | Subscription Detail & Last Safe Moment | Show renewal timestamp, provider timezone, policy confidence, safety buffer, and `unknown` policy guardrail. |
| 0:55–1:20 | Explicit Scoped Authorisation Modal | Approve one specific subscription cancellation; highlight masked account, access impact, expiry, and server-side enforcement. |
| 1:20–2:00 | Browser Agent on Controlled Demo Portal | Show visible Chromium navigating `Billing -> Manage Plan -> Retention Offer -> Confirm` and hitting the extra-confirmation obstacle. |
| 2:00–2:45 | Kane CLI `FAIL` -> Structured Feedback -> Recovery | Show Kane independently catching the missed confirmation, structured feedback sent to Gemini agent, and Attempt 2 completing the final step. |
| 2:45–3:25 | Kane CLI `PASS` + Cancellation Evidence Vault | Show `Verified cancelled` status, TestMu/Kane evidence link, run ID, checked postconditions, and audit timeline. |
| 3:25–4:00 | Architecture & Honest Boundaries | Explain owned demo fixture vs live providers, private evidence storage, RLS, and safe `Needs human action` handoff. |

## Closing Line
> "LASTCALL does not ask you to trust an AI that says it clicked Cancel. It asks Kane to prove the subscription reached the expected state. If proof fails, the agent gets another chance—or stops and asks a human."
