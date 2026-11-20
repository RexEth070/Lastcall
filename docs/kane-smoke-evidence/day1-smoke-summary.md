# Day-1 Kane CLI Smoke Test Evidence

- **Date (UTC):** `2026-11-20T14:39:04Z`
- **Kane CLI Version:** `0.10.7` (`@testmuai/kane-cli`)
- **Authenticated Profile:** OAuth (`prod`)
- **Session ID:** `5d103a1a-5cfa-4f9e-9226-ab044b22c10f`
- **TestMu Evidence Share URL:** `https://test-manager.lambdatest.com/projects/01M7MCT99EZZYN461FX38AR3Z3/test-cases/01M7WPB9VSWH6ZT4232BWHAXVB/dashboard/share/US_J35EEOQIELA7DAWGECBK58HQ0SBXACYV7JNK1MV7ED7S8G7G52VIDIPKXHFRXYC2?type=summary&agentView=true&fqdn=summary-page`
- **Command Executed:**
  ```bash
  kane-cli run "Open https://example.com and verify that the main heading says Example Domain" --url https://example.com --agent --headless --max-steps 5 --timeout 60 --final-validation on
  ```
- **Observed Exit Code:** `1` (`status: "failed"`, `result_code: 710`, `reason_code: "assertion_error.final_verification"`)
- **Duration / Credits:** `47.6s` / `13.44` credits

## Key Integration Findings for Phase 5 (`worker/kane-runner.ts`)

Running a real end-to-end Kane CLI invocation on Day 1 surfaced critical facts before writing the runner:

1. **Verified `--agent` NDJSON Schema:**
   - Stream lifecycle events: `stream_start`, `recording_state`, `bifurcation`, per-step `{ step, status, remark }`, `coverage` (with local `.evidence` pack path), and final `run_end`.
   - `run_end` reliably supplies `status`, `summary`, `one_liner`, `reason`, `reason_code`, `result_code`, `run_id`, `test_url` (shareable TestMu evidence link), `verdict` (`root_cause`, `suggestion`, `culprit_step`), and `credits_consumed`.
2. **Real Failure Behavior Verified:**
   - Kane navigated to `https://example.com` and executed the check, returning a triaged failure (`verdict.one_liner` + `test_url` + sealed `.evidence` pack) when the visual assertion extracted an empty string for `main_heading_text_check` in headless mode.
   - For Phase 5 against our controlled demo billing portal (`http://localhost:3001`), we will explicitly pass `--assertion-mode dom` and test non-headless Desktop Chrome + explicit DOM text assertions (`data-testid` / visible status badges) so `PASS` and `FAIL` verdicts are 100% deterministic.
