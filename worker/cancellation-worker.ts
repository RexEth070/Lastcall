import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { diagnoseRecovery } from "../lib/agent/feedback";
import { runClosedLoopCancellation } from "../lib/cancellation/closed-loop";
import {
  validateScopedAuthorisation,
  type AuthorisationCheckRecord,
} from "../lib/validation/authorisation";
import { runDemoPortalBrowserAttempt } from "./browser-agent";
import { runKaneVerification } from "./kane-runner";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PORTAL_URL = process.env.DEMO_PORTAL_URL || "http://localhost:3001";
const DEMO_PORTAL_EMAIL =
  process.env.DEMO_PORTAL_EMAIL || "alex.demo@cloudstream.test";
const DEMO_PORTAL_PASSWORD =
  process.env.DEMO_PORTAL_PASSWORD || "DemoBilling2026!";
const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 3000);
const HEADLESS = process.env.WORKER_HEADLESS === "true";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface JobRow {
  id: string;
  user_id: string;
  subscription_id: string;
  authorisation_id: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  stop_requested_at: string | null;
}

async function processNextAuthorisedJob(): Promise<boolean> {
  const { data: jobs, error } = await supabase
    .from("cancellation_jobs")
    .select("*")
    .eq("status", "authorised")
    .is("stop_requested_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("[worker] Poll error:", error.message);
    return false;
  }

  const job = (jobs?.[0] as JobRow | undefined) ?? null;
  if (!job) return false;

  console.log(`[worker] Claimed job ${job.id} for subscription ${job.subscription_id}`);

  // Defense-in-depth: re-verify scoped authorisation before launching any browser
  const { data: authRow } = await supabase
    .from("authorisations")
    .select("id, user_id, subscription_id, action_type, expires_at, revoked_at")
    .eq("id", job.authorisation_id)
    .maybeSingle();

  const authCheck = validateScopedAuthorisation(
    authRow as AuthorisationCheckRecord | null,
    job.user_id,
    job.subscription_id,
  );

  if (!authCheck.valid) {
    const reason = authCheck.reason || "Authorisation no longer valid.";
    console.warn(`[worker] Rejecting job ${job.id}: ${reason}`);
    await supabase
      .from("cancellation_jobs")
      .update({ status: "needs_human_action", last_error: reason })
      .eq("id", job.id);
    await supabase.from("audit_events").insert({
      user_id: job.user_id,
      subscription_id: job.subscription_id,
      event_type: "worker_rejected_unauthorised_job",
      actor: "system",
      details_json: { job_id: job.id, reason },
    });
    return true;
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, service_name, portal_url, is_controlled_demo_portal")
    .eq("id", job.subscription_id)
    .maybeSingle();

  if (!sub) {
    await supabase
      .from("cancellation_jobs")
      .update({ status: "needs_human_action", last_error: "Subscription missing." })
      .eq("id", job.id);
    return true;
  }

  const targetPortalUrl = sub.portal_url
    ? new URL(sub.portal_url).origin
    : DEMO_PORTAL_URL;

  const checkStopRequested = async () => {
    const { data } = await supabase
      .from("cancellation_jobs")
      .select("stop_requested_at")
      .eq("id", job.id)
      .maybeSingle();
    return Boolean(data?.stop_requested_at);
  };

  const outcome = await runClosedLoopCancellation({
    jobId: job.id,
    maxRecoveryAttempts: job.max_attempts,
    checkStopRequested,
    onJobStateChange: async (
      jobStatus,
      subscriptionStatus,
      attemptCount,
      lastError,
    ) => {
      await supabase
        .from("cancellation_jobs")
        .update({
          status: jobStatus,
          attempt_count: attemptCount,
          last_error: lastError,
        })
        .eq("id", job.id);

      await supabase
        .from("subscriptions")
        .update({ status: subscriptionStatus })
        .eq("id", job.subscription_id);

      await supabase.from("audit_events").insert({
        user_id: job.user_id,
        subscription_id: job.subscription_id,
        event_type: `job_${jobStatus}`,
        actor: jobStatus === "kane_verifying" ? "kane" : "agent",
        details_json: {
          job_id: job.id,
          attempt_count: attemptCount,
          subscription_status: subscriptionStatus,
          last_error: lastError,
        },
      });
    },
    executeBrowserAttempt: async (attemptNumber, strategy) => {
      console.log(
        `[worker] Job ${job.id} Attempt ${attemptNumber} (strategy=${strategy}) -> Playwright`,
      );
      return runDemoPortalBrowserAttempt({
        portalUrl: targetPortalUrl,
        portalEmail: DEMO_PORTAL_EMAIL,
        portalPassword: DEMO_PORTAL_PASSWORD,
        headless: HEADLESS,
        strategy,
      });
    },
    runKaneVerification: async (attemptNumber) => {
      console.log(
        `[worker] Job ${job.id} Attempt ${attemptNumber} -> Independent Kane CLI verification`,
      );
      return runKaneVerification({
        portalUrl: targetPortalUrl,
        serviceName: sub.service_name,
        portalEmail: DEMO_PORTAL_EMAIL,
        portalPassword: DEMO_PORTAL_PASSWORD,
        headless: HEADLESS,
        checkStopRequested,
      });
    },
    diagnoseFailure: async ({ feedback, lastBrowserObservation }) => {
      console.log(
        `[worker] Job ${job.id} Attempt ${feedback.attempt_number} -> Kane FAIL; diagnosing recovery`,
      );
      return diagnoseRecovery({ feedback, lastBrowserObservation });
    },
    recordAttempt: async (attempt) => {
      let screenshotPath: string | null = null;

      if (attempt.screenshotBuffer) {
        const storagePath = `${job.user_id}/${job.id}/attempt-${attempt.attemptNumber}.png`;
        const { error: uploadErr } = await supabase.storage
          .from("cancellation-evidence")
          .upload(storagePath, attempt.screenshotBuffer, {
            contentType: "image/png",
            upsert: true,
          });
        if (!uploadErr) {
          screenshotPath = storagePath;
        }
      }

      const { data: attemptRow } = await supabase
        .from("cancellation_attempts")
        .insert({
          job_id: job.id,
          attempt_number: attempt.attemptNumber,
          started_at: attempt.startedAt,
          finished_at: attempt.finishedAt,
          browser_result: attempt.browserResult,
          kane_verdict: attempt.kaneVerdict,
          kane_run_id: attempt.kaneRunId,
          kane_share_url: attempt.kaneShareUrl,
          evidence_path: screenshotPath,
          feedback_json: attempt.feedbackJson,
          summary: attempt.summary,
        })
        .select("id")
        .single();

      if (attemptRow?.id && screenshotPath) {
        await supabase.from("evidence_items").insert({
          user_id: job.user_id,
          attempt_id: attemptRow.id,
          kind: "screenshot",
          storage_path: screenshotPath,
          content_type: "image/png",
          redacted: true,
        });
      }

      if (attemptRow?.id && attempt.kaneShareUrl) {
        await supabase.from("evidence_items").insert({
          user_id: job.user_id,
          attempt_id: attemptRow.id,
          kind: "share_link",
          storage_path: attempt.kaneShareUrl,
          content_type: "text/uri-list",
          redacted: true,
        });
      }
    },
  });

  console.log(
    `[worker] Job ${job.id} finished -> jobStatus=${outcome.finalJobStatus}, subscriptionStatus=${outcome.finalSubscriptionStatus}, attempts=${outcome.totalAttempts}`,
  );
  return true;
}

async function main() {
  const runOnce = process.argv.includes("--once");
  console.log(
    `LASTCALL Cancellation Worker started (mode=${runOnce ? "once" : "poll"}, target=${DEMO_PORTAL_URL}, headless=${HEADLESS})`,
  );

  if (runOnce) {
    await processNextAuthorisedJob();
    return;
  }

  while (true) {
    try {
      await processNextAuthorisedJob();
    } catch (err) {
      console.error("[worker] Unexpected loop error:", err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error("[worker] Fatal startup error:", err);
  process.exit(1);
});
