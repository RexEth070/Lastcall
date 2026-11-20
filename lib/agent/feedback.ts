import { GoogleGenAI } from "@google/genai";

export interface AgentFeedbackPayload {
  job_id: string;
  attempt_number: number;
  verdict: "FAIL" | "UNAVAILABLE";
  failed_assertions: string[];
  concise_error: string;
  evidence_reference: string | null;
  allowed_next_action: "retry_with_recovery" | "stop_needs_human_action";
}

export type RecoveryStrategy =
  | "complete_extra_confirmation"
  | "retry_standard_flow"
  | "escalate_to_human";

export interface RecoveryDiagnosis {
  diagnosis: string;
  recoveryStrategy: RecoveryStrategy;
  shouldEscalateToHuman: boolean;
  source: "gemini" | "deterministic_fallback";
}

export function buildStructuredFeedback(params: {
  jobId: string;
  attemptNumber: number;
  maxRecoveryAttempts: number;
  verdict: "FAIL" | "UNAVAILABLE";
  failedAssertions: string[];
  conciseError: string;
  evidenceReference: string | null;
}): AgentFeedbackPayload {
  const retriesUsed = Math.max(0, params.attemptNumber - 1);
  const canRetry =
    params.verdict === "FAIL" && retriesUsed < params.maxRecoveryAttempts;

  return {
    job_id: params.jobId,
    attempt_number: params.attemptNumber,
    verdict: params.verdict,
    failed_assertions: params.failedAssertions,
    concise_error: params.conciseError.slice(0, 400),
    evidence_reference: params.evidenceReference,
    allowed_next_action: canRetry
      ? "retry_with_recovery"
      : "stop_needs_human_action",
  };
}

function deterministicDiagnosis(
  feedback: AgentFeedbackPayload,
  lastBrowserObservation: string,
): RecoveryDiagnosis {
  const combined =
    `${feedback.concise_error} ${feedback.failed_assertions.join(" ")} ${lastBrowserObservation}`.toLowerCase();

  if (
    combined.includes("mfa") ||
    combined.includes("captcha") ||
    combined.includes("otp") ||
    combined.includes("two-factor")
  ) {
    return {
      diagnosis:
        "Portal requires MFA or CAPTCHA verification. Per LASTCALL safety rules, stop and hand off to a human.",
      recoveryStrategy: "escalate_to_human",
      shouldEscalateToHuman: true,
      source: "deterministic_fallback",
    };
  }

  if (feedback.allowed_next_action === "stop_needs_human_action") {
    return {
      diagnosis:
        "Bounded recovery limit reached or verification unavailable. Escalating safely to human action.",
      recoveryStrategy: "escalate_to_human",
      shouldEscalateToHuman: true,
      source: "deterministic_fallback",
    };
  }

  if (
    combined.includes("extra") ||
    combined.includes("final") ||
    combined.includes("active") ||
    combined.includes("confirm") ||
    combined.includes("acknowledge") ||
    combined.includes("cancelled")
  ) {
    return {
      diagnosis:
        "Kane CLI confirmed the subscription is still Active. The billing portal likely requires completing an additional final confirmation step (checkbox + Finalize Cancellation).",
      recoveryStrategy: "complete_extra_confirmation",
      shouldEscalateToHuman: false,
      source: "deterministic_fallback",
    };
  }

  return {
    diagnosis:
      "Cancellation postconditions were not met on the previous attempt. Retrying the full cancellation path and checking for any pending confirmation controls.",
    recoveryStrategy: "retry_standard_flow",
    shouldEscalateToHuman: false,
    source: "deterministic_fallback",
  };
}

/**
 * Feeds secret-free structured Kane failure feedback to Gemini to diagnose the missed step
 * and select the next bounded recovery strategy. Falls back cleanly if Gemini is unavailable.
 */
export async function diagnoseRecovery(params: {
  feedback: AgentFeedbackPayload;
  lastBrowserObservation: string;
}): Promise<RecoveryDiagnosis> {
  const { feedback, lastBrowserObservation } = params;

  if (feedback.allowed_next_action === "stop_needs_human_action") {
    return deterministicDiagnosis(feedback, lastBrowserObservation);
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return deterministicDiagnosis(feedback, lastBrowserObservation);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

    const prompt = [
      "You are the LASTCALL subscription cancellation recovery diagnostician.",
      "An independent Kane CLI browser verification returned FAIL after a cancellation attempt.",
      "Never suggest bypassing MFA, CAPTCHA, or anti-bot checks.",
      "Analyze the secret-free structured feedback and browser observation below, then respond with ONLY valid JSON:",
      '{"diagnosis":"short 1-2 sentence explanation","recoveryStrategy":"complete_extra_confirmation|retry_standard_flow|escalate_to_human","shouldEscalateToHuman":false}',
      "",
      `Structured Kane Feedback: ${JSON.stringify(feedback)}`,
      `Last Browser Observation (redacted): ${lastBrowserObservation.slice(0, 500)}`,
    ].join("\n");

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const text = response.text?.trim() || "";
    const parsed = JSON.parse(text) as {
      diagnosis?: string;
      recoveryStrategy?: RecoveryStrategy;
      shouldEscalateToHuman?: boolean;
    };

    const allowed: RecoveryStrategy[] = [
      "complete_extra_confirmation",
      "retry_standard_flow",
      "escalate_to_human",
    ];
    const strategy =
      parsed.recoveryStrategy && allowed.includes(parsed.recoveryStrategy)
        ? parsed.recoveryStrategy
        : "complete_extra_confirmation";

    return {
      diagnosis:
        parsed.diagnosis?.slice(0, 400) ||
        "Gemini diagnosed a missed confirmation step on the billing portal.",
      recoveryStrategy: strategy,
      shouldEscalateToHuman:
        Boolean(parsed.shouldEscalateToHuman) || strategy === "escalate_to_human",
      source: "gemini",
    };
  } catch {
    return deterministicDiagnosis(feedback, lastBrowserObservation);
  }
}
