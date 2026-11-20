# Phase Verification Checklist

Run these checks at the end of every build phase before committing a checkpoint:

1. **Secrets Hygiene:** Verify `.env.local` is ignored (`git status --ignored`) and no secrets, tokens, or passwords exist in staged files (`git diff --cached`).
2. **Type Safety:** Run `npm run typecheck` (`tsc --noEmit`) — zero errors.
3. **Linting:** Run `npm run lint` — zero errors.
4. **Tests:** Run `npm test` (once test runner is wired) — report exact pass/fail counts.
5. **Production Build:** Run `npm run build` — clean build with zero errors.
6. **Honest Reporting:** Report exact command outputs; never claim a check passed unless executed after the latest edit.
7. **Checkpoint Commit:** Commit only the current phase's vertical slice with a descriptive message.
