export type KaneVerdict = "PASS" | "FAIL" | "UNAVAILABLE";

export interface ParsedKaneOutput {
  verdict: KaneVerdict;
  runId: string | null;
  sessionId: string | null;
  shareUrl: string | null;
  evidencePackPath: string | null;
  summary: string;
  failedAssertions: string[];
  conciseError: string | null;
  durationSeconds: number | null;
  creditsConsumed: number | null;
  rawEventCount: number;
}

interface RawKaneEvent {
  type?: string;
  status?: string;
  step?: number;
  remark?: string;
  session_id?: string;
  pack?: string;
  summary?: string;
  one_liner?: string;
  reason?: string;
  reason_code?: string;
  run_id?: string;
  test_url?: string;
  duration?: number;
  credits_consumed?: number;
  verdict?: {
    root_cause?: string;
    one_liner?: string;
    suggestion?: string;
    bug_title?: string;
  };
}

/**
 * Parses `kane-cli run --agent` NDJSON output conservatively.
 * Proof Before Status contract:
 * - Timeout, CLI unavailable, malformed output, or missing `run_end` => UNAVAILABLE.
 * - Exit code 0 is ONLY a candidate pass; `run_end.status` MUST equal "passed"
 *   and zero step assertions may be failed.
 */
export function parseKaneAgentOutput(params: {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  spawnError?: string | null;
}): ParsedKaneOutput {
  const { stdout, stderr, exitCode, timedOut, spawnError } = params;

  if (spawnError) {
    return {
      verdict: "UNAVAILABLE",
      runId: null,
      sessionId: null,
      shareUrl: null,
      evidencePackPath: null,
      summary: `Kane CLI could not be started: ${spawnError}`,
      failedAssertions: [],
      conciseError: spawnError,
      durationSeconds: null,
      creditsConsumed: null,
      rawEventCount: 0,
    };
  }

  if (timedOut || exitCode === 3) {
    return {
      verdict: "UNAVAILABLE",
      runId: null,
      sessionId: null,
      shareUrl: null,
      evidencePackPath: null,
      summary:
        "Kane CLI verification timed out before completing independent checks. Subscription remains unverified.",
      failedAssertions: ["Kane verification timed out"],
      conciseError: "Kane CLI timed out before postconditions could be verified.",
      durationSeconds: null,
      creditsConsumed: null,
      rawEventCount: 0,
    };
  }

  if (exitCode === 2) {
    return {
      verdict: "UNAVAILABLE",
      runId: null,
      sessionId: null,
      shareUrl: null,
      evidencePackPath: null,
      summary:
        "Kane CLI reported an authentication or setup error (exit code 2). Subscription remains unverified.",
      failedAssertions: ["Kane CLI authentication or setup error"],
      conciseError:
        stderr.trim().slice(0, 240) || "Kane CLI authentication/setup error.",
      durationSeconds: null,
      creditsConsumed: null,
      rawEventCount: 0,
    };
  }

  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const events: RawKaneEvent[] = [];
  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    try {
      events.push(JSON.parse(line) as RawKaneEvent);
    } catch {
      // Ignore non-JSON preamble lines safely
    }
  }

  let sessionId: string | null = null;
  let evidencePackPath: string | null = null;
  let runEnd: RawKaneEvent | null = null;
  const failedSteps: string[] = [];

  for (const ev of events) {
    if (ev.type === "recording_state" && typeof ev.session_id === "string") {
      sessionId = ev.session_id;
    }
    if (ev.type === "coverage" && typeof ev.pack === "string") {
      evidencePackPath = ev.pack;
    }
    if (ev.status === "failed" && typeof ev.remark === "string") {
      failedSteps.push(ev.remark);
    }
    if (ev.type === "run_end") {
      runEnd = ev;
    }
  }

  // Missing run_end means malformed / incomplete Kane output -> never treat as PASS
  if (!runEnd) {
    return {
      verdict: "UNAVAILABLE",
      runId: null,
      sessionId,
      shareUrl: null,
      evidencePackPath,
      summary:
        "Kane CLI output was incomplete or malformed (missing run_end event). Subscription remains unverified.",
      failedAssertions: ["Incomplete Kane CLI output"],
      conciseError:
        stderr.trim().slice(0, 240) ||
        `Kane CLI exited with code ${exitCode ?? "null"} without a structured run_end verdict.`,
      durationSeconds: null,
      creditsConsumed: null,
      rawEventCount: events.length,
    };
  }

  const runId =
    typeof runEnd.run_id === "string"
      ? sessionId
        ? `${sessionId.slice(0, 8)}:${runEnd.run_id}`
        : runEnd.run_id
      : sessionId;
  const shareUrl =
    typeof runEnd.test_url === "string" && runEnd.test_url.startsWith("http")
      ? runEnd.test_url
      : null;
  const durationSeconds =
    typeof runEnd.duration === "number" ? runEnd.duration : null;
  const creditsConsumed =
    typeof runEnd.credits_consumed === "number"
      ? runEnd.credits_consumed
      : null;

  const isCleanPass =
    exitCode === 0 &&
    runEnd.status === "passed" &&
    failedSteps.length === 0;

  if (isCleanPass) {
    return {
      verdict: "PASS",
      runId,
      sessionId,
      shareUrl,
      evidencePackPath,
      summary:
        runEnd.one_liner ||
        runEnd.summary ||
        "Kane CLI independently verified all cancellation postconditions.",
      failedAssertions: [],
      conciseError: null,
      durationSeconds,
      creditsConsumed,
      rawEventCount: events.length,
    };
  }

  const assertions = new Set<string>(failedSteps);
  if (runEnd.reason) assertions.add(runEnd.reason);
  if (runEnd.verdict?.bug_title) assertions.add(runEnd.verdict.bug_title);
  if (assertions.size === 0) {
    assertions.add("Post-cancellation assertions were not satisfied.");
  }

  const conciseError =
    runEnd.verdict?.one_liner ||
    runEnd.one_liner ||
    runEnd.reason ||
    runEnd.summary ||
    "Kane CLI verification failed.";

  return {
    verdict: "FAIL",
    runId,
    sessionId,
    shareUrl,
    evidencePackPath,
    summary:
      runEnd.summary ||
      conciseError,
    failedAssertions: Array.from(assertions),
    conciseError,
    durationSeconds,
    creditsConsumed,
    rawEventCount: events.length,
  };
}

/**
 * Builds the plain-English verification objective passed to Kane CLI.
 * Credentials are referenced via Kane secret variables ({{portal_email}}, {{portal_password}})
 * and never embedded as literal secrets.
 */
export function buildDemoPortalVerificationObjective(serviceName: string): string {
  return [
    `Open the demo billing portal for ${serviceName}.`,
    `If the Sign in form is visible, enter {{portal_email}} into Email address, enter {{portal_password}} into Password, and click Sign in.`,
    `On the Subscription Status billing page, verify three conditions:`,
    `1. Subscription Status text is exactly 'Cancelled'.`,
    `2. No Next Renewal Date is displayed.`,
    `3. A confirmation message containing 'Cancellation confirmed' is visible.`,
    `If Subscription Status is still 'Active' or any condition is missing, fail immediately and explain which condition failed.`,
  ].join(" ");
}
