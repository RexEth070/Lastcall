"use client";

import {
  AlertTriangle,
  CheckCircle2,
  OctagonX,
  RefreshCcw,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";
import { PreviewStateGate } from "@/components/layout/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge, VerdictBadge } from "@/components/ui/status-badge";
import { DEMO_ACTIVITY_JOBS } from "@/lib/demo-data";
import type { DemoActivityStep } from "@/lib/types";
import { cn, formatDateTimeInZone } from "@/lib/utils";

function stepIcon(phase: DemoActivityStep["phase"]) {
  switch (phase) {
    case "authorised":
      return ShieldCheck;
    case "agent_attempt":
      return Terminal;
    case "kane_verdict":
      return XCircle;
    case "agent_recovery":
      return RefreshCcw;
    case "verified":
      return CheckCircle2;
    case "needs_human":
      return AlertTriangle;
  }
}

function stepTone(phase: DemoActivityStep["phase"]) {
  switch (phase) {
    case "kane_verdict":
      return "border-red-200 bg-red-50/60 text-red-950";
    case "verified":
      return "border-emerald-300 bg-emerald-50/70 text-emerald-950";
    case "needs_human":
      return "border-amber-300 bg-amber-50/70 text-amber-950";
    default:
      return "border-[#e4e1da] bg-[#f7f6f2]/70 text-slate-900";
  }
}

export default function ActivityPage() {
  return (
    <div className="space-y-6 animate-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Agent &amp; Kane activity
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Transparent step-by-step history of authorised browser attempts, independent Kane CLI verdicts, bounded recoveries (max 2 retries), and human handoffs.
          </p>
        </div>
        <div className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#e4e1da] bg-white px-4 text-xs font-medium text-slate-700">
          <OctagonX className="h-4 w-4 text-slate-500" aria-hidden />
          <span>Live worker &amp; Stop Agent control connect in Phase 5</span>
        </div>
      </div>

      <PreviewStateGate
        emptyTitle="No cancellation attempts recorded"
        emptyDescription="LASTCALL never runs unapproved browser actions. Authorise a single subscription cancellation to see real attempt and Kane verification events here."
      >
        <div className="rounded-xl border border-[#e4e1da] bg-white p-4 text-xs text-slate-700">
          <strong className="font-semibold text-slate-900">Honesty guarantee:</strong>{" "}
          The timelines below are Phase 1 static preview fixtures showing the exact closed-loop structure. No fake live agent feed is simulated; live browser worker events appear here once Phase 5 connects.
        </div>

        <div className="space-y-6">
          {DEMO_ACTIVITY_JOBS.map((job) => (
            <Card key={job.id}>
              <CardHeader className="border-b border-[#e4e1da]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{job.serviceName}</CardTitle>
                      <StatusBadge status={job.status} />
                    </div>
                    <CardDescription className="mt-1">
                      Account: <span className="font-mono">{job.accountLabel}</span> · Target: {job.portalLabel} · Attempts:{" "}
                      <span className="font-mono tabular-nums">
                        {job.attemptCount}/{job.maxAttempts}
                      </span>
                    </CardDescription>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    Job {job.id}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-5">
                <ol className="space-y-3">
                  {job.steps.map((step) => {
                    const Icon = stepIcon(step.phase);
                    return (
                      <li
                        key={step.id}
                        className={cn(
                          "rounded-lg border p-4",
                          stepTone(step.phase),
                        )}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-2.5">
                            <Icon
                              className="mt-0.5 h-4 w-4 shrink-0"
                              aria-hidden
                            />
                            <div>
                              <p className="text-sm font-semibold">
                                {step.title}
                              </p>
                              <p className="mt-1 max-w-prose text-xs leading-relaxed opacity-90">
                                {step.detail}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                            {step.verdict && (
                              <VerdictBadge verdict={step.verdict} />
                            )}
                            <span className="font-mono text-[11px] opacity-75 tabular-nums">
                              {formatDateTimeInZone(step.timestamp, "UTC")}
                            </span>
                            {step.kaneRunId && (
                              <span className="font-mono text-[11px] opacity-75">
                                Run: {step.kaneRunId}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      </PreviewStateGate>
    </div>
  );
}
