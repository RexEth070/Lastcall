import { describe, expect, it } from "vitest";
import { diagnoseRecovery } from "@/lib/agent/feedback";
import {
  runClosedLoopCancellation,
  type AttemptRecordInput,
} from "@/lib/cancellation/closed-loop";
import { parseKaneAgentOutput, type ParsedKaneOutput } from "@/lib/kane/verdict";

function makePassResult(runId = "run-pass-1"): ParsedKaneOutput {
  return {
    verdict: "PASS",
    runId,
    sessionId: "sess-1",
    shareUrl: "https://test-manager.lambdatest.com/share/demo-pass",
    evidencePackPath: null,
    summary: "Subscription status is Cancelled and next renewal date is removed.",
    failedAssertions: [],
    conciseError: null,
    durationSeconds: 18.2,
    creditsConsumed: 8.5,
    rawEventCount: 6,
  };
}

function makeFailResult(runId = "run-fail-1"): ParsedKaneOutput {
  return {
    verdict: "FAIL",
    runId,
    sessionId: "sess-1",
    shareUrl: "https://test-manager.lambdatest.com/share/demo-fail",
    evidencePackPath: null,
    summary:
      "Expected status Cancelled, but observed status Active with pending extra confirmation.",
    failedAssertions: [
      "Subscription status is still Active",
      "Next renewal date is still visible",
    ],
    conciseError:
      "Portal still shows Active because extra confirmation step was not completed.",
    durationSeconds: 21.0,
    creditsConsumed: 9.1,
    rawEventCount: 6,
  };
}

describe("Kane CLI NDJSON verdict parser (Proof Before Status)", () => {
  it("parses a clean PASS only when exitCode=0 and run_end.status=passed", () => {
    const stdout = [
      JSON.stringify({ type: "recording_state", session_id: "abcd1234-5678" }),
      JSON.stringify({
        type: "run_end",
        status: "passed",
        run_id: "run-0",
        one_liner: "All cancellation postconditions passed.",
        test_url: "https://test-manager.lambdatest.com/share/ok",
        duration: 14.5,
      }),
    ].join("\n");

    const parsed = parseKaneAgentOutput({
      stdout,
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });
    expect(parsed.verdict).toBe("PASS");
    expect(parsed.runId).toBe("abcd1234:run-0");
    expect(parsed.shareUrl).toBe("https://test-manager.lambdatest.com/share/ok");
  });

  it("maps timeout, exit code 2, or missing run_end to UNAVAILABLE (never PASS)", () => {
    expect(
      parseKaneAgentOutput({
        stdout: "",
        stderr: "",
        exitCode: 3,
        timedOut: true,
      }).verdict,
    ).toBe("UNAVAILABLE");

    expect(
      parseKaneAgentOutput({
        stdout: "",
        stderr: "Not authenticated",
        exitCode: 2,
        timedOut: false,
      }).verdict,
    ).toBe("UNAVAILABLE");

    expect(
      parseKaneAgentOutput({
        stdout: "not valid json",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      }).verdict,
    ).toBe("UNAVAILABLE");
  });
});

describe("Closed-loop recovery state machine", () => {
  it("proves FAIL -> structured feedback -> recovery -> Kane PASS -> VERIFIED_CANCELLED", async () => {
    const attempts: AttemptRecordInput[] = [];
    const states: string[] = [];
    const strategiesUsed: string[] = [];

    const outcome = await runClosedLoopCancellation({
      jobId: "job-closed-loop-1",
      maxRecoveryAttempts: 2,
      checkStopRequested: async () => false,
      onJobStateChange: async (jobStatus) => {
        states.push(jobStatus);
      },
      executeBrowserAttempt: async (attemptNumber, strategy) => {
        strategiesUsed.push(strategy);
        if (attemptNumber === 1) {
          return {
            completedFlow: true,
            requiresHumanReason: null,
            observation:
              "Clicked Confirm Cancellation; portal displayed /cancel/extra-confirm.",
          };
        }
        return {
          completedFlow: true,
          requiresHumanReason: null,
          observation:
            "Ticked final acknowledgement checkbox and clicked Finalize Cancellation.",
        };
      },
      runKaneVerification: async (attemptNumber) =>
        attemptNumber === 1 ? makeFailResult() : makePassResult(),
      diagnoseFailure: async ({ feedback, lastBrowserObservation }) => {
        // Ensure offline deterministic fallback works without external network dependency in unit test
        const prevKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        try {
          return await diagnoseRecovery({ feedback, lastBrowserObservation });
        } finally {
          if (prevKey) process.env.GEMINI_API_KEY = prevKey;
        }
      },
      recordAttempt: async (a) => {
        attempts.push(a);
      },
    });

    expect(outcome.finalJobStatus).toBe("verified_cancelled");
    expect(outcome.finalSubscriptionStatus).toBe("verified_cancelled");
    expect(outcome.totalAttempts).toBe(2);
    expect(strategiesUsed).toEqual(["standard", "complete_extra_confirmation"]);
    expect(attempts[0].kaneVerdict).toBe("FAIL");
    expect(attempts[0].feedbackJson?.feedback?.allowed_next_action).toBe(
      "retry_with_recovery",
    );
    expect(attempts[1].kaneVerdict).toBe("PASS");
    expect(states).toContain("recovery_required");
    expect(states).toContain("agent_recovery");
    expect(states[states.length - 1]).toBe("verified_cancelled");
  });

  it("stops after max 2 recovery retries and marks NEEDS_HUMAN_ACTION when Kane keeps failing", async () => {
    const attempts: AttemptRecordInput[] = [];

    const outcome = await runClosedLoopCancellation({
      jobId: "job-retry-cap",
      maxRecoveryAttempts: 2,
      checkStopRequested: async () => false,
      onJobStateChange: async () => {},
      executeBrowserAttempt: async () => ({
        completedFlow: true,
        requiresHumanReason: null,
        observation: "Portal stayed Active.",
      }),
      runKaneVerification: async (n) => makeFailResult(`run-fail-${n}`),
      diagnoseFailure: async () => ({
        diagnosis: "Still active; retrying.",
        recoveryStrategy: "complete_extra_confirmation",
        shouldEscalateToHuman: false,
        source: "deterministic_fallback",
      }),
      recordAttempt: async (a) => {
        attempts.push(a);
      },
    });

    // 1 initial attempt + 2 bounded recovery retries = 3 total attempts max
    expect(outcome.totalAttempts).toBe(3);
    expect(attempts).toHaveLength(3);
    expect(outcome.finalJobStatus).toBe("needs_human_action");
    expect(outcome.finalSubscriptionStatus).toBe("needs_human_action");
  });

  it("never marks cancelled when Kane CLI times out or is unavailable", async () => {
    const outcome = await runClosedLoopCancellation({
      jobId: "job-timeout",
      maxRecoveryAttempts: 2,
      checkStopRequested: async () => false,
      onJobStateChange: async () => {},
      executeBrowserAttempt: async () => ({
        completedFlow: true,
        requiresHumanReason: null,
        observation: "Clicked Confirm Cancellation.",
      }),
      runKaneVerification: async () =>
        parseKaneAgentOutput({
          stdout: "",
          stderr: "",
          exitCode: 3,
          timedOut: true,
        }),
      diagnoseFailure: async () => {
        throw new Error("Should not diagnose on UNAVAILABLE");
      },
      recordAttempt: async () => {},
    });

    expect(outcome.finalJobStatus).toBe("verification_unavailable");
    expect(outcome.finalSubscriptionStatus).toBe("unverified_unknown");
  });

  it("stops safely when user triggers Stop Agent", async () => {
    let stopped = false;
    const outcome = await runClosedLoopCancellation({
      jobId: "job-stop",
      maxRecoveryAttempts: 2,
      checkStopRequested: async () => stopped,
      onJobStateChange: async () => {},
      executeBrowserAttempt: async () => {
        stopped = true;
        return {
          completedFlow: true,
          requiresHumanReason: null,
          observation: "Navigated to manage plan.",
        };
      },
      runKaneVerification: async () => {
        throw new Error("Should not invoke Kane after user requested stop");
      },
      diagnoseFailure: async () => {
        throw new Error("Should not diagnose after stop");
      },
      recordAttempt: async () => {},
    });

    expect(outcome.finalJobStatus).toBe("stopped_by_user");
    expect(outcome.finalSubscriptionStatus).toBe("unverified_unknown");
  });

  it("pauses immediately into NEEDS_HUMAN_ACTION when MFA or CAPTCHA is detected", async () => {
    const outcome = await runClosedLoopCancellation({
      jobId: "job-mfa",
      maxRecoveryAttempts: 2,
      checkStopRequested: async () => false,
      onJobStateChange: async () => {},
      executeBrowserAttempt: async () => ({
        completedFlow: false,
        requiresHumanReason: "MFA challenge detected on portal.",
        observation: "Stopped at MFA challenge.",
      }),
      runKaneVerification: async () => {
        throw new Error("Should not run Kane after MFA pause");
      },
      diagnoseFailure: async () => {
        throw new Error("Should not diagnose after MFA pause");
      },
      recordAttempt: async () => {},
    });

    expect(outcome.finalJobStatus).toBe("needs_human_action");
    expect(outcome.finalSubscriptionStatus).toBe("needs_human_action");
  });
});
