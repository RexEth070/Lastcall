import {
  buildStructuredFeedback,
  type AgentFeedbackPayload,
  type RecoveryDiagnosis,
  type RecoveryStrategy,
} from "../agent/feedback";
import type { ParsedKaneOutput } from "../kane/verdict";
import type { SubscriptionStatus } from "../types";

export type ClosedLoopJobStatus =
  | "agent_running"
  | "kane_verifying"
  | "recovery_required"
  | "agent_recovery"
  | "verified_cancelled"
  | "needs_human_action"
  | "verification_unavailable"
  | "stopped_by_user";

export interface BrowserAttemptResult {
  completedFlow: boolean;
  requiresHumanReason: string | null;
  observation: string;
  screenshotBuffer?: Buffer | null;
}

export interface AttemptRecordInput {
  attemptNumber: number;
  startedAt: string;
  finishedAt: string;
  browserResult: string;
  kaneVerdict: "PASS" | "FAIL" | "UNAVAILABLE" | null;
  kaneRunId: string | null;
  kaneShareUrl: string | null;
  summary: string;
  feedbackJson: {
    feedback?: AgentFeedbackPayload;
    diagnosis?: RecoveryDiagnosis;
  } | null;
  screenshotBuffer?: Buffer | null;
}

export interface ClosedLoopOutcome {
  finalJobStatus: ClosedLoopJobStatus;
  finalSubscriptionStatus: SubscriptionStatus;
  totalAttempts: number;
  lastError: string | null;
  verifiedRunId: string | null;
}

export async function runClosedLoopCancellation(deps: {
  jobId: string;
  maxRecoveryAttempts: number;
  checkStopRequested: () => Promise<boolean>;
  onJobStateChange: (
    jobStatus: ClosedLoopJobStatus,
    subscriptionStatus: SubscriptionStatus,
    attemptCount: number,
    lastError: string | null,
  ) => Promise<void>;
  executeBrowserAttempt: (
    attemptNumber: number,
    strategy: "standard" | RecoveryStrategy,
  ) => Promise<BrowserAttemptResult>;
  runKaneVerification: (attemptNumber: number) => Promise<ParsedKaneOutput>;
  diagnoseFailure: (params: {
    feedback: AgentFeedbackPayload;
    lastBrowserObservation: string;
  }) => Promise<RecoveryDiagnosis>;
  recordAttempt: (attempt: AttemptRecordInput) => Promise<void>;
}): Promise<ClosedLoopOutcome> {
  // Hard-cap recovery retries to at most 2 (1 initial attempt + up to 2 recoveries)
  const maxRecoveries = Math.max(0, Math.min(deps.maxRecoveryAttempts, 2));
  const maxTotalAttempts = 1 + maxRecoveries;

  let strategy: "standard" | RecoveryStrategy = "standard";

  for (let attemptNumber = 1; attemptNumber <= maxTotalAttempts; attemptNumber++) {
    if (await deps.checkStopRequested()) {
      await deps.onJobStateChange(
        "stopped_by_user",
        "unverified_unknown",
        attemptNumber - 1,
        "Stopped by user before next attempt.",
      );
      return {
        finalJobStatus: "stopped_by_user",
        finalSubscriptionStatus: "unverified_unknown",
        totalAttempts: attemptNumber - 1,
        lastError: "Stopped by user before next attempt.",
        verifiedRunId: null,
      };
    }

    const startedAt = new Date().toISOString();
    const isRecovery = attemptNumber > 1;

    await deps.onJobStateChange(
      isRecovery ? "agent_recovery" : "agent_running",
      "agent_working",
      attemptNumber,
      null,
    );

    const browser = await deps.executeBrowserAttempt(attemptNumber, strategy);

    // Safe human handoff for MFA / CAPTCHA / ambiguous terms
    if (browser.requiresHumanReason) {
      const finishedAt = new Date().toISOString();
      await deps.recordAttempt({
        attemptNumber,
        startedAt,
        finishedAt,
        browserResult: `paused_needs_human: ${browser.requiresHumanReason}`,
        kaneVerdict: null,
        kaneRunId: null,
        kaneShareUrl: null,
        summary: browser.requiresHumanReason,
        feedbackJson: null,
        screenshotBuffer: browser.screenshotBuffer,
      });
      await deps.onJobStateChange(
        "needs_human_action",
        "needs_human_action",
        attemptNumber,
        browser.requiresHumanReason,
      );
      return {
        finalJobStatus: "needs_human_action",
        finalSubscriptionStatus: "needs_human_action",
        totalAttempts: attemptNumber,
        lastError: browser.requiresHumanReason,
        verifiedRunId: null,
      };
    }

    if (await deps.checkStopRequested()) {
      const finishedAt = new Date().toISOString();
      await deps.recordAttempt({
        attemptNumber,
        startedAt,
        finishedAt,
        browserResult: browser.observation,
        kaneVerdict: null,
        kaneRunId: null,
        kaneShareUrl: null,
        summary: "Stopped by user before Kane CLI verification.",
        feedbackJson: null,
        screenshotBuffer: browser.screenshotBuffer,
      });
      await deps.onJobStateChange(
        "stopped_by_user",
        "unverified_unknown",
        attemptNumber,
        "Stopped by user before verification.",
      );
      return {
        finalJobStatus: "stopped_by_user",
        finalSubscriptionStatus: "unverified_unknown",
        totalAttempts: attemptNumber,
        lastError: "Stopped by user before verification.",
        verifiedRunId: null,
      };
    }

    // Independent Kane CLI Verification
    await deps.onJobStateChange(
      "kane_verifying",
      "agent_working",
      attemptNumber,
      null,
    );

    const kane = await deps.runKaneVerification(attemptNumber);
    const finishedAt = new Date().toISOString();

    // ONLY path that may transition subscription to VERIFIED_CANCELLED
    if (kane.verdict === "PASS") {
      await deps.recordAttempt({
        attemptNumber,
        startedAt,
        finishedAt,
        browserResult: browser.observation,
        kaneVerdict: "PASS",
        kaneRunId: kane.runId,
        kaneShareUrl: kane.shareUrl,
        summary: kane.summary,
        feedbackJson: null,
        screenshotBuffer: browser.screenshotBuffer,
      });
      await deps.onJobStateChange(
        "verified_cancelled",
        "verified_cancelled",
        attemptNumber,
        null,
      );
      return {
        finalJobStatus: "verified_cancelled",
        finalSubscriptionStatus: "verified_cancelled",
        totalAttempts: attemptNumber,
        lastError: null,
        verifiedRunId: kane.runId,
      };
    }

    // Kane CLI timeout / unavailable / malformed output -> NEVER mark cancelled
    if (kane.verdict === "UNAVAILABLE") {
      const feedback = buildStructuredFeedback({
        jobId: deps.jobId,
        attemptNumber,
        maxRecoveryAttempts: maxRecoveries,
        verdict: "UNAVAILABLE",
        failedAssertions: kane.failedAssertions,
        conciseError: kane.conciseError || kane.summary,
        evidenceReference: kane.shareUrl || kane.runId,
      });
      await deps.recordAttempt({
        attemptNumber,
        startedAt,
        finishedAt,
        browserResult: browser.observation,
        kaneVerdict: "UNAVAILABLE",
        kaneRunId: kane.runId,
        kaneShareUrl: kane.shareUrl,
        summary: kane.summary,
        feedbackJson: { feedback },
        screenshotBuffer: browser.screenshotBuffer,
      });
      await deps.onJobStateChange(
        "verification_unavailable",
        "unverified_unknown",
        attemptNumber,
        kane.conciseError || kane.summary,
      );
      return {
        finalJobStatus: "verification_unavailable",
        finalSubscriptionStatus: "unverified_unknown",
        totalAttempts: attemptNumber,
        lastError: kane.conciseError || kane.summary,
        verifiedRunId: null,
      };
    }

    // Kane CLI returned FAIL -> build structured feedback & diagnose bounded recovery
    const feedback = buildStructuredFeedback({
      jobId: deps.jobId,
      attemptNumber,
      maxRecoveryAttempts: maxRecoveries,
      verdict: "FAIL",
      failedAssertions: kane.failedAssertions,
      conciseError: kane.conciseError || kane.summary,
      evidenceReference: kane.shareUrl || kane.runId,
    });

    const diagnosis = await deps.diagnoseFailure({
      feedback,
      lastBrowserObservation: browser.observation,
    });

    await deps.recordAttempt({
      attemptNumber,
      startedAt,
      finishedAt,
      browserResult: browser.observation,
      kaneVerdict: "FAIL",
      kaneRunId: kane.runId,
      kaneShareUrl: kane.shareUrl,
      summary: kane.summary,
      feedbackJson: { feedback, diagnosis },
      screenshotBuffer: browser.screenshotBuffer,
    });

    if (
      feedback.allowed_next_action === "stop_needs_human_action" ||
      diagnosis.shouldEscalateToHuman ||
      attemptNumber >= maxTotalAttempts
    ) {
      const reason = `Verification failed after ${attemptNumber} attempt(s): ${feedback.concise_error}`;
      await deps.onJobStateChange(
        "needs_human_action",
        "needs_human_action",
        attemptNumber,
        reason,
      );
      return {
        finalJobStatus: "needs_human_action",
        finalSubscriptionStatus: "needs_human_action",
        totalAttempts: attemptNumber,
        lastError: reason,
        verifiedRunId: null,
      };
    }

    // Transition into recovery_required before next bounded retry
    await deps.onJobStateChange(
      "recovery_required",
      "verification_failed",
      attemptNumber,
      feedback.concise_error,
    );
    strategy = diagnosis.recoveryStrategy;
  }

  return {
    finalJobStatus: "needs_human_action",
    finalSubscriptionStatus: "needs_human_action",
    totalAttempts: maxTotalAttempts,
    lastError: "Maximum recovery attempts reached.",
    verifiedRunId: null,
  };
}
