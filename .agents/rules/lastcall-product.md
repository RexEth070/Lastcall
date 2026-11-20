# LASTCALL Workspace Rules

Project: LASTCALL — autonomous subscription cancellation agent.

Build a secure, polished, web-first MVP for the KaneCLI hackathon.
Primary users: students and young professionals.
Core promise: attempt authorised subscription cancellations and prove the final state with Kane CLI.

## Non-Negotiable Rules

1. Never claim cancellation succeeded unless Kane verification passes.
2. Separate agent attempt from independent verification.
3. Require explicit, scoped user authorisation before any action.
4. Never bypass CAPTCHA, MFA, bot protections or access controls.
5. Never store passwords, card data, cookies or OTPs.
6. Use a controlled demo billing portal for the hackathon demo; label it explicitly as a demo fixture.
7. Keep the MVP small; do not add unrelated features.
8. Use TypeScript, validation, clear errors and accessible UI.
9. Protect all user data with Supabase RLS.
10. Add tests for every critical workflow and failure state.
11. Before editing, explain the plan and list files to change.
12. After editing, run checks and report actual results; do not say tests passed unless they were executed.
