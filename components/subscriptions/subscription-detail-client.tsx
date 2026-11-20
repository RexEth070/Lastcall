"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  FlaskConical,
  Play,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import {
  AuthorisationModal,
  type AuthorisationRecord,
} from "@/components/consent/authorisation-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  calculateLastSafeMoment,
  type UserCancellationIntent,
} from "@/lib/cancellation/last-safe-moment";
import type { SubscriptionRecord } from "@/lib/db/types";
import { cn, formatDateTimeInZone, formatMinorCurrency } from "@/lib/utils";

interface JobSummary {
  id: string;
  status: string;
  scheduled_for: string;
  attempt_count: number;
  max_attempts: number;
  created_at: string;
}

interface AuditSummary {
  id: string;
  event_type: string;
  actor: string;
  created_at: string;
}

export function SubscriptionDetailClient({
  initialSubscription,
  initialActiveAuth,
  initialJobs,
  initialAuditEvents,
}: {
  initialSubscription: SubscriptionRecord;
  initialActiveAuth: AuthorisationRecord | null;
  initialJobs: JobSummary[];
  initialAuditEvents: AuditSummary[];
}) {
  const [subscription, setSubscription] = React.useState(initialSubscription);
  const [activeAuth, setActiveAuth] = React.useState(initialActiveAuth);
  const [jobs, setJobs] = React.useState(initialJobs);
  const [auditEvents, setAuditEvents] = React.useState(initialAuditEvents);

  const [intent, setIntent] = React.useState<UserCancellationIntent>(
    "stop_future_renewal",
  );
  const [bufferHours, setBufferHours] = React.useState(
    initialSubscription.safetyBufferHours,
  );
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{
    tone: "error" | "info";
    text: string;
  } | null>(null);

  const plan = React.useMemo(
    () =>
      calculateLastSafeMoment({
        nextRenewalAt: subscription.nextRenewalAt,
        timezone: subscription.timezone,
        policyType: subscription.policyType,
        policyConfidence: subscription.policyConfidence,
        noticePeriodDays: subscription.noticePeriodDays,
        safetyBufferHours: bufferHours,
        userIntent: intent,
      }),
    [subscription, bufferHours, intent],
  );

  async function handleRevoke() {
    if (!activeAuth) return;
    setBusyAction("revoke");
    setFeedback(null);
    try {
      const res = await fetch(`/api/authorisations/${activeAuth.id}/revoke`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          tone: "error",
          text: data.error || "Failed to revoke authorisation.",
        });
        return;
      }
      setActiveAuth(null);
      if (subscription.status === "action_authorised") {
        setSubscription((prev) => ({ ...prev, status: "active" }));
      }
      setAuditEvents((prev) => [
        {
          id: `local-${Date.now()}`,
          event_type: "authorisation_revoked",
          actor: "user",
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setFeedback({
        tone: "info",
        text: "Scoped authorisation revoked. No browser action can run without a fresh approval.",
      });
    } catch {
      setFeedback({ tone: "error", text: "Network error while revoking." });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleQueueJob(mode: "attempt_now" | "schedule_attempt") {
    if (!activeAuth) return;
    setBusyAction(mode);
    setFeedback(null);
    try {
      const idempotencyKey = `job-${subscription.id.slice(0, 8)}-${activeAuth.id.slice(0, 8)}-${mode}`;
      const res = await fetch("/api/cancellation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          authorisationId: activeAuth.id,
          idempotencyKey,
          executionMode: mode,
          scheduledFor:
            mode === "schedule_attempt" && plan.lastSafeDeadlineAt
              ? plan.lastSafeDeadlineAt
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          tone: "error",
          text: data.error || "Unable to queue cancellation job.",
        });
        return;
      }
      const createdJob = data.job as JobSummary;
      setJobs((prev) =>
        prev.some((j) => j.id === createdJob.id) ? prev : [createdJob, ...prev],
      );
      setFeedback({
        tone: "info",
        text: data.deduplicated
          ? "Idempotency check matched your existing queued job — no duplicate cancellation was created."
          : mode === "attempt_now"
            ? "Authorised cancellation job queued. Start the local worker (Phase 5) to execute browser cancellation and Kane CLI verification."
            : "Scheduled cancellation plan saved. In the hackathon MVP, press Attempt now when ready so execution stays explicit and observable.",
      });
    } catch {
      setFeedback({ tone: "error", text: "Network error while queuing job." });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6 animate-enter">
      <div>
        <Link
          href="/subscriptions"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span>Back to subscriptions</span>
        </Link>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {subscription.serviceName}
              </h1>
              <StatusBadge status={subscription.status} />
              {subscription.isControlledDemoPortal && (
                <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-900">
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                  <span>Controlled demo billing portal</span>
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {subscription.planName} ·{" "}
              <span className="font-mono">{subscription.accountLabel}</span> ·{" "}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatMinorCurrency(
                  subscription.amountMinor,
                  subscription.currency,
                )}
              </span>{" "}
              ({subscription.cadence})
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-start gap-2.5 rounded-xl border p-4 text-sm",
            feedback.tone === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-blue-200 bg-blue-50 text-blue-950",
          )}
        >
          {feedback.tone === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4ed8]" aria-hidden />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 cols: Last Safe Moment Planner */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Last Safe Moment planner</CardTitle>
            <CardDescription>
              Transparent, conservative deadline calculation in provider timezone ({subscription.timezone}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Headline Banner */}
            <div
              className={cn(
                "rounded-xl border p-4",
                plan.canComputeSafeDate
                  ? plan.urgency === "overdue_window" ||
                    plan.urgency === "upcoming_soon"
                    ? "border-amber-300 bg-amber-50 text-amber-950"
                    : "border-blue-200 bg-blue-50/70 text-slate-900"
                  : "border-amber-400 bg-amber-50 text-amber-950",
              )}
            >
              <div className="flex items-start gap-2.5">
                {plan.canComputeSafeDate ? (
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-[#1d4ed8]" aria-hidden />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                )}
                <div>
                  <p className="text-sm font-semibold">{plan.headline}</p>
                  {plan.lastSafeDeadlineAt ? (
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                      No later than{" "}
                      {formatDateTimeInZone(
                        plan.lastSafeDeadlineAt,
                        subscription.timezone,
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs">
                      Policy terms are unknown — LASTCALL will never invent a safe future date.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Intent & Buffer Controls */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="planner-intent"
                  className="block text-xs font-medium text-slate-700"
                >
                  Desired end state
                </label>
                <select
                  id="planner-intent"
                  value={intent}
                  onChange={(e) =>
                    setIntent(e.target.value as UserCancellationIntent)
                  }
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900"
                >
                  <option value="stop_future_renewal">Stop future renewal</option>
                  <option value="preserve_access">
                    Preserve access where possible
                  </option>
                  <option value="cancel_immediately">Cancel immediately</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="planner-buffer"
                  className="block text-xs font-medium text-slate-700"
                >
                  Safety buffer (hours)
                </label>
                <input
                  id="planner-buffer"
                  type="number"
                  min={0}
                  max={336}
                  value={bufferHours}
                  onChange={(e) =>
                    setBufferHours(
                      Math.max(0, Math.min(336, Number(e.target.value) || 0)),
                    )
                  }
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 font-mono text-sm text-slate-900 tabular-nums"
                />
              </div>
            </div>

            {/* Renewal Timeline Breakdown */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-3 text-xs">
                <span className="text-slate-600">Next renewal</span>
                <p className="mt-1 font-mono font-semibold text-slate-900 tabular-nums">
                  {formatDateTimeInZone(
                    subscription.nextRenewalAt,
                    subscription.timezone,
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-3 text-xs">
                <span className="text-slate-600">Provider cutoff</span>
                <p className="mt-1 font-mono font-semibold text-slate-900 tabular-nums">
                  {plan.providerDeadlineAt
                    ? formatDateTimeInZone(
                        plan.providerDeadlineAt,
                        subscription.timezone,
                      )
                    : "Unknown"}
                </p>
              </div>
              <div className="rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-3 text-xs">
                <span className="text-slate-600">Policy confidence</span>
                <p className="mt-1 font-semibold capitalize text-slate-900">
                  {subscription.policyConfidence.replace("_", " ")} (
                  {subscription.policyType.replace("_", " ")})
                </p>
              </div>
            </div>

            {/* Assumptions & Disclaimer */}
            <div className="space-y-2 border-t border-[#e4e1da] pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Assumptions &amp; access impact
              </h3>
              <p className="text-xs font-medium text-slate-800">
                {plan.accessImpactSummary}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                {plan.assumptions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="pt-1 text-[11px] text-slate-500">{plan.disclaimer}</p>
            </div>
          </CardContent>
        </Card>

        {/* Right col: Explicit Scoped Authorisation & Job Trigger */}
        <div className="space-y-4">
          <Card className="border-[#1d4ed8]/30">
            <CardHeader>
              <CardTitle>Scoped authorisation</CardTitle>
              <CardDescription>
                Server rejects all cancellation jobs without an active, unexpired approval for this exact subscription.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeAuth ? (
                <>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-950 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <ShieldCheck className="h-4 w-4 text-[#1d4ed8]" aria-hidden />
                      <span>Active scoped authorisation</span>
                    </div>
                    <p>{activeAuth.scope_summary}</p>
                    <p className="font-mono text-[11px] text-blue-900 tabular-nums">
                      Expires:{" "}
                      {formatDateTimeInZone(
                        activeAuth.expires_at,
                        subscription.timezone,
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={busyAction !== null}
                      onClick={() => handleQueueJob("attempt_now")}
                    >
                      <Play className="h-4 w-4" aria-hidden />
                      <span>
                        {busyAction === "attempt_now"
                          ? "Queuing..."
                          : "Attempt cancellation now"}
                      </span>
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={busyAction !== null}
                      onClick={() => handleQueueJob("schedule_attempt")}
                    >
                      <Clock className="h-4 w-4" aria-hidden />
                      <span>
                        {busyAction === "schedule_attempt"
                          ? "Saving plan..."
                          : "Save scheduled plan"}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-red-700 hover:bg-red-50 hover:text-red-900"
                      disabled={busyAction !== null}
                      onClick={handleRevoke}
                    >
                      <ShieldOff className="h-4 w-4" aria-hidden />
                      <span>
                        {busyAction === "revoke"
                          ? "Revoking..."
                          : "Revoke authorisation"}
                      </span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    No active authorisation exists for this subscription. Grant explicit single-subscription approval before queuing a browser cancellation attempt.
                  </p>
                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={subscription.status === "verified_cancelled"}
                    onClick={() => setAuthModalOpen(true)}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    <span>Authorise cancellation</span>
                  </Button>
                </>
              )}

              {subscription.manualFallbackUrl && (
                <a
                  href={subscription.manualFallbackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#e4e1da] bg-[#f7f6f2] px-3 text-xs font-medium text-slate-700 hover:bg-[#efece5]"
                >
                  <span>Manual cancellation link</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </CardContent>
          </Card>

          {/* Queued Jobs & Audit Trail */}
          <Card>
            <CardHeader>
              <CardTitle>Action &amp; audit history</CardTitle>
              <CardDescription>
                Append-only trail of approvals, jobs, and status changes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {jobs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-semibold text-slate-700">
                    Cancellation jobs ({jobs.length})
                  </p>
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-2.5 flex items-center justify-between gap-2"
                    >
                      <span className="font-mono capitalize text-slate-800">
                        {job.status.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {job.attempt_count}/{job.max_attempts} retries
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {auditEvents.length === 0 ? (
                <p className="text-slate-500">No audit events recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {auditEvents.slice(0, 8).map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between gap-2 border-b border-[#efece5] pb-2 last:border-b-0"
                    >
                      <span className="font-mono text-slate-800">
                        {ev.event_type}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {formatDateTimeInZone(
                          ev.created_at,
                          subscription.timezone,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AuthorisationModal
        open={authModalOpen}
        subscription={subscription}
        plan={plan}
        onClose={() => setAuthModalOpen(false)}
        onAuthorised={(auth) => {
          setActiveAuth(auth);
          setSubscription((prev) => ({ ...prev, status: "action_authorised" }));
          setAuditEvents((prev) => [
            {
              id: `local-${Date.now()}`,
              event_type: "authorisation_granted",
              actor: "user",
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
          setFeedback({
            tone: "info",
            text: "Scoped authorisation saved. You can now queue a cancellation attempt or revoke it at any time.",
          });
        }}
      />
    </div>
  );
}
