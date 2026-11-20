"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  OctagonX,
  RefreshCcw,
  Terminal,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state-views";
import { VerdictBadge } from "@/components/ui/status-badge";
import type { KaneVerdict } from "@/lib/types";
import { cn, formatDateTimeInZone } from "@/lib/utils";

export interface ActivityAttemptItem {
  id: string;
  attempt_number: number;
  started_at: string;
  finished_at: string | null;
  browser_result: string | null;
  kane_verdict: KaneVerdict | null;
  kane_run_id: string | null;
  kane_share_url: string | null;
  summary: string | null;
  feedback_json: {
    feedback?: {
      failed_assertions?: string[];
      concise_error?: string;
      allowed_next_action?: string;
    };
    diagnosis?: {
      diagnosis?: string;
      recoveryStrategy?: string;
      source?: string;
    };
  } | null;
}

export interface ActivityJobItem {
  id: string;
  subscription_id: string;
  service_name: string;
  account_label: string;
  timezone: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  stop_requested_at: string | null;
  last_error: string | null;
  created_at: string;
  attempts: ActivityAttemptItem[];
}

const ACTIVE_JOB_STATUSES = new Set([
  "authorised",
  "agent_running",
  "kane_verifying",
  "recovery_required",
  "agent_recovery",
]);

export function ActivityClient({
  initialJobs,
}: {
  initialJobs: ActivityJobItem[];
}) {
  const router = useRouter();
  const [stoppingId, setStoppingId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const hasActiveJob = initialJobs.some(
    (j) => ACTIVE_JOB_STATUSES.has(j.status) && !j.stop_requested_at,
  );

  // Poll server data cleanly every 4s ONLY while a real job is active
  React.useEffect(() => {
    if (!hasActiveJob) return;
    const timer = setInterval(() => {
      router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [hasActiveJob, router]);

  async function handleStop(jobId: string) {
    setStoppingId(jobId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/cancellation-jobs/${jobId}/stop`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Unable to stop job.");
        return;
      }
      router.refresh();
    } catch {
      setErrorMsg("Network error while sending stop signal.");
    } finally {
      setStoppingId(null);
    }
  }

  return (
    <div className="space-y-6 animate-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Agent &amp; Kane activity
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Real persisted timeline of authorised cancellation jobs, browser attempts, independent Kane CLI verdicts, Gemini recovery diagnoses, and safe human handoffs.
          </p>
        </div>

        <Button variant="secondary" onClick={() => router.refresh()}>
          <RefreshCcw className="h-4 w-4" aria-hidden />
          <span>Refresh status</span>
        </Button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{errorMsg}</span>
        </div>
      )}

      {initialJobs.length === 0 ? (
        <EmptyState
          title="No cancellation jobs recorded yet"
          description="LASTCALL never runs unapproved browser actions. Open a subscription, grant explicit scoped authorisation, and press Attempt cancellation now to run the closed loop."
          actionLabel="Go to subscriptions"
          actionHref="/subscriptions"
        />
      ) : (
        <div className="space-y-6">
          {initialJobs.map((job) => {
            const canStop =
              ACTIVE_JOB_STATUSES.has(job.status) && !job.stop_requested_at;
            return (
              <Card key={job.id}>
                <CardHeader className="border-b border-[#e4e1da]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/subscriptions/${job.subscription_id}`}
                          className="hover:underline"
                        >
                          <CardTitle>{job.service_name}</CardTitle>
                        </Link>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2.5 py-0.5 font-mono text-xs font-semibold capitalize",
                            job.status === "verified_cancelled"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                              : job.status === "needs_human_action" ||
                                  job.status === "verification_unavailable"
                                ? "border-amber-300 bg-amber-50 text-amber-950"
                                : job.status === "stopped_by_user"
                                  ? "border-slate-300 bg-slate-100 text-slate-800"
                                  : "border-blue-200 bg-blue-50 text-blue-900",
                          )}
                        >
                          {job.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <CardDescription className="mt-1">
                        Account:{" "}
                        <span className="font-mono">{job.account_label}</span> ·
                        Attempts:{" "}
                        <span className="font-mono tabular-nums">
                          {job.attempt_count}
                        </span>{" "}
                        (max {job.max_attempts} recoveries) · Created:{" "}
                        <span className="font-mono tabular-nums">
                          {formatDateTimeInZone(job.created_at, job.timezone)}
                        </span>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      {canStop && (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={stoppingId === job.id}
                          onClick={() => handleStop(job.id)}
                        >
                          <OctagonX className="h-3.5 w-3.5" aria-hidden />
                          <span>
                            {stoppingId === job.id
                              ? "Stopping..."
                              : "Stop agent"}
                          </span>
                        </Button>
                      )}
                      {job.stop_requested_at && (
                        <span className="rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          Stop requested
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-5">
                  {job.status === "authorised" && job.attempts.length === 0 && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs text-blue-950">
                      <strong>Queued &amp; waiting for worker:</strong> Run{" "}
                      <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono">
                        npm run demo-portal
                      </code>{" "}
                      and{" "}
                      <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono">
                        npm run worker
                      </code>{" "}
                      locally to execute Playwright + independent Kane CLI verification on this job.
                    </div>
                  )}

                  {job.last_error && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                        aria-hidden
                      />
                      <span>{job.last_error}</span>
                    </div>
                  )}

                  {job.attempts.length > 0 && (
                    <ol className="space-y-3">
                      {job.attempts.map((attempt) => (
                        <li
                          key={attempt.id}
                          className={cn(
                            "rounded-lg border p-4 space-y-2.5",
                            attempt.kane_verdict === "PASS"
                              ? "border-emerald-300 bg-emerald-50/60"
                              : attempt.kane_verdict === "FAIL"
                                ? "border-red-200 bg-red-50/50"
                                : "border-[#e4e1da] bg-[#f7f6f2]/70",
                          )}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              {attempt.kane_verdict === "PASS" ? (
                                <CheckCircle2
                                  className="h-4 w-4 text-emerald-700"
                                  aria-hidden
                                />
                              ) : attempt.kane_verdict === "FAIL" ? (
                                <XCircle
                                  className="h-4 w-4 text-red-700"
                                  aria-hidden
                                />
                              ) : (
                                <Terminal
                                  className="h-4 w-4 text-slate-600"
                                  aria-hidden
                                />
                              )}
                              <span className="text-sm font-semibold text-slate-900">
                                Attempt {attempt.attempt_number}
                                {attempt.attempt_number > 1
                                  ? " (Bounded Recovery)"
                                  : " (Initial Attempt)"}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {attempt.kane_verdict && (
                                <VerdictBadge verdict={attempt.kane_verdict} />
                              )}
                              {attempt.kane_run_id && (
                                <span className="font-mono text-[11px] text-slate-600">
                                  Run: {attempt.kane_run_id}
                                </span>
                              )}
                            </div>
                          </div>

                          {attempt.browser_result && (
                            <p className="text-xs text-slate-700">
                              <strong>Browser agent:</strong>{" "}
                              {attempt.browser_result}
                            </p>
                          )}

                          {attempt.summary && (
                            <p className="text-xs text-slate-800">
                              <strong>Kane CLI verdict summary:</strong>{" "}
                              {attempt.summary}
                            </p>
                          )}

                          {attempt.feedback_json?.diagnosis && (
                            <div className="rounded-md border border-[#e4e1da] bg-white p-3 text-xs text-slate-800 space-y-1">
                              <p className="font-semibold text-slate-900">
                                Closed-loop recovery diagnosis (
                                {attempt.feedback_json.diagnosis.source || "agent"}):
                              </p>
                              <p>{attempt.feedback_json.diagnosis.diagnosis}</p>
                              <p className="font-mono text-[11px] text-[#1d4ed8]">
                                Next strategy:{" "}
                                {attempt.feedback_json.diagnosis.recoveryStrategy}
                              </p>
                            </div>
                          )}

                          {attempt.kane_share_url && (
                            <a
                              href={attempt.kane_share_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#1d4ed8] hover:underline"
                            >
                              <span>Open Kane CLI TestMu evidence report</span>
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            </a>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
