"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { PreviewStateGate } from "@/components/layout/app-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DEMO_SUBSCRIPTIONS } from "@/lib/demo-data";
import { cn, formatDateTimeInZone, formatMinorCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const renewalsAtRisk = DEMO_SUBSCRIPTIONS.filter(
    (s) =>
      s.status === "active" ||
      s.status === "action_authorised" ||
      s.status === "verification_failed" ||
      s.status === "needs_human_action",
  );
  const activeCount = DEMO_SUBSCRIPTIONS.filter(
    (s) => s.status !== "verified_cancelled",
  ).length;
  const readyAuthorisedCount = DEMO_SUBSCRIPTIONS.filter(
    (s) => s.status === "action_authorised",
  ).length;
  const verifiedCancelled = DEMO_SUBSCRIPTIONS.filter(
    (s) => s.status === "verified_cancelled",
  );
  const potentialExposureMinor = renewalsAtRisk.reduce(
    (sum, item) => sum + item.amountMinor,
    0,
  );

  return (
    <div className="space-y-6 animate-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Renewal control center
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track upcoming renewal exposure, conservative Last Safe Moments, and Kane-verified outcomes.
          </p>
        </div>
        <Link
          href="/subscriptions"
          className={cn(buttonVariants({ variant: "primary" }))}
        >
          <span>Review subscriptions</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <PreviewStateGate
        emptyTitle="No subscriptions tracked yet"
        emptyDescription="Add a subscription or load seeded demo records to calculate Last Safe Moment deadlines and track renewal risk."
      >
        {/* Primary KPI Row — Hero metric is "Renewals at risk" */}
        <section
          aria-label="Renewal summary metrics"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {/* Hero KPI */}
          <Card className="border-amber-300 bg-amber-50/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-950">
                  Renewals at risk
                </span>
                <AlertTriangle
                  className="h-4 w-4 text-amber-700"
                  aria-hidden
                />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-semibold text-amber-950 tabular-nums">
                {renewalsAtRisk.length}
              </p>
              <p className="mt-1.5 text-xs text-amber-900">
                Potential renewal exposure:{" "}
                <span className="font-mono font-semibold tabular-nums">
                  {formatMinorCurrency(potentialExposureMinor, "USD")}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  Active tracked services
                </span>
                <Clock className="h-4 w-4 text-slate-500" aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                {activeCount}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">
                Includes trials, active &amp; pending handoffs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  Authorised &amp; ready
                </span>
                <ShieldCheck className="h-4 w-4 text-[#1d4ed8]" aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-semibold text-slate-900 tabular-nums">
                {readyAuthorisedCount}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">
                Scoped approval granted (no auto-guess)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  Verified cancelled
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-semibold text-emerald-800 tabular-nums">
                {verifiedCancelled.length}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">
                Proven by independent Kane CLI check
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Upcoming Renewals & Deadlines */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Upcoming renewals &amp; Last Safe Moments</CardTitle>
                <CardDescription>
                  Conservative target deadlines calculated in provider timezone. Forecasts represent potential renewal avoided, not realised savings.
                </CardDescription>
              </div>
              <Link
                href="/subscriptions"
                className="inline-flex min-h-[44px] items-center text-xs font-medium text-[#1d4ed8] hover:underline shrink-0"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {renewalsAtRisk.map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-col gap-3 rounded-lg border border-[#e4e1da] bg-[#f7f6f2]/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {sub.serviceName}
                      </p>
                      <StatusBadge status={sub.status} />
                    </div>
                    <p className="text-xs text-slate-600">
                      {sub.planName} · {sub.accountLabel}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
                      <span className="inline-flex items-center gap-1 text-slate-700">
                        <CalendarClock className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                        <span>Renews:</span>
                        <span className="font-mono tabular-nums">
                          {formatDateTimeInZone(sub.nextRenewalAt, sub.timezone)}
                        </span>
                      </span>
                      {sub.lastSafeDeadlineAt ? (
                        <span className="font-medium text-amber-900">
                          Last safe:{" "}
                          <span className="font-mono tabular-nums">
                            {formatDateTimeInZone(
                              sub.lastSafeDeadlineAt,
                              sub.timezone,
                            )}
                          </span>
                        </span>
                      ) : (
                        <span className="font-medium text-amber-900">
                          Deadline unknown — cancel now or verify terms
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-[#e4e1da] pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                        {formatMinorCurrency(sub.amountMinor, sub.currency)}
                      </p>
                      <p className="text-[11px] capitalize text-slate-500">
                        {sub.cadence}
                      </p>
                    </div>
                    <span className="rounded-md border border-[#e4e1da] bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      Actions unlock in Phase 3
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Right column: Proof-before-status guardrail card */}
          <div className="space-y-4">
            <Card className="bg-[#0b1220] text-white border-white/10">
              <CardHeader>
                <CardTitle className="text-white">
                  Proof before status
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Every cancellation attempt stays unverified until Kane CLI independently checks the portal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-slate-300">
                <div className="rounded-lg border border-white/10 bg-[#111b2e] p-3.5">
                  <p className="font-medium text-white">Controlled demo fixture</p>
                  <p className="mt-1 text-slate-400">
                    Live browser cancellation in this hackathon runs exclusively against our owned demo billing portal, never real third-party billing accounts.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    href="/activity"
                    className="inline-flex min-h-[44px] items-center justify-between rounded-lg border border-white/15 px-3.5 text-xs font-medium text-white hover:bg-white/10"
                  >
                    <span>Inspect closed-loop activity</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                  <Link
                    href="/evidence"
                    className="inline-flex min-h-[44px] items-center justify-between rounded-lg border border-white/15 px-3.5 text-xs font-medium text-white hover:bg-white/10"
                  >
                    <span>Open Evidence Vault</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </PreviewStateGate>
    </div>
  );
}
