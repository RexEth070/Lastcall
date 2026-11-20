"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Database,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state-views";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubscriptionFormModal } from "@/components/subscriptions/subscription-form-modal";
import type { SubscriptionRecord } from "@/lib/db/types";
import { cn, formatDateTimeInZone, formatMinorCurrency } from "@/lib/utils";

function formatExposureByCurrency(items: SubscriptionRecord[]): string {
  if (items.length === 0) return formatMinorCurrency(0, "USD");
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amountMinor);
  }
  return Array.from(totals.entries())
    .map(([cur, minor]) => formatMinorCurrency(minor, cur))
    .join(" + ");
}

export function DashboardClient({
  initialSubscriptions,
  schemaReady,
}: {
  initialSubscriptions: SubscriptionRecord[];
  schemaReady: boolean;
}) {
  const [subscriptions, setSubscriptions] =
    React.useState<SubscriptionRecord[]>(initialSubscriptions);
  const [modalOpen, setModalOpen] = React.useState(false);

  const activeList = subscriptions.filter((s) => !s.archivedAt);
  const renewalsAtRisk = activeList.filter(
    (s) =>
      s.status === "active" ||
      s.status === "action_authorised" ||
      s.status === "verification_failed" ||
      s.status === "needs_human_action",
  );
  const readyAuthorisedCount = activeList.filter(
    (s) => s.status === "action_authorised",
  ).length;
  const verifiedCancelledCount = activeList.filter(
    (s) => s.status === "verified_cancelled",
  ).length;

  function handleSaved(record: SubscriptionRecord) {
    setSubscriptions((prev) =>
      [...prev, record].sort(
        (a, b) => Date.parse(a.nextRenewalAt) - Date.parse(b.nextRenewalAt),
      ),
    );
  }

  return (
    <div className="space-y-6 animate-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Renewal control center
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Live Supabase inventory with conservative Last Safe Moments and Kane-verified outcomes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            onClick={() => setModalOpen(true)}
            disabled={!schemaReady}
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>Add subscription</span>
          </Button>
          <Link
            href="/subscriptions"
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            <span>Manage inventory</span>
          </Link>
        </div>
      </div>

      {!schemaReady && (
        <Card
          role="alert"
          className="border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
        >
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div className="space-y-1.5">
              <p className="font-semibold">
                One-time Supabase SQL setup required
              </p>
              <p className="text-xs leading-relaxed">
                Your account is signed in, but the 7 LASTCALL Postgres tables have not been created in Supabase yet. Copy and run{" "}
                <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono">
                  supabase/migrations/202611200001_initial_schema.sql
                </code>{" "}
                in your Supabase Dashboard → <strong>SQL Editor</strong>, then refresh or re-enter Demo Mode.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Primary KPI Row — Hero metric is "Renewals at risk" */}
      <section
        aria-label="Renewal summary metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-950">
                Renewals at risk
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden />
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold text-amber-950 tabular-nums">
              {renewalsAtRisk.length}
            </p>
            <p className="mt-1.5 text-xs text-amber-900">
              Potential renewal exposure:{" "}
              <span className="font-mono font-semibold tabular-nums">
                {formatExposureByCurrency(renewalsAtRisk)}
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
              {activeList.length}
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              Protected by user-scoped Supabase RLS
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
              Explicit scoped consent required
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
              {verifiedCancelledCount}
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              Only updated after independent Kane PASS
            </p>
          </CardContent>
        </Card>
      </section>

      {schemaReady && activeList.length === 0 ? (
        <EmptyState
          title="No active subscriptions tracked yet"
          description="Add a subscription with its renewal date, timezone, and policy terms to calculate your conservative Last Safe Moment."
          actionLabel="Add your first subscription"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Upcoming renewals &amp; Last Safe Moments</CardTitle>
                <CardDescription>
                  Conservative target deadlines shown in provider timezone. Forecasts represent potential renewal avoided, never exaggerated savings.
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
              {renewalsAtRisk.slice(0, 6).map((sub) => (
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
                        <CalendarClock
                          className="h-3.5 w-3.5 text-slate-500"
                          aria-hidden
                        />
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
                    <Link
                      href={`/subscriptions/${sub.id}`}
                      className="text-xs font-medium text-[#1d4ed8] hover:underline"
                    >
                      Plan &amp; authorise
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[#0b1220] text-white border-white/10 h-fit">
            <CardHeader>
              <CardTitle className="text-white">Proof before status</CardTitle>
              <CardDescription className="text-slate-300">
                Every cancellation stays unverified until Kane CLI proves the post-action state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300">
              <div className="rounded-lg border border-white/10 bg-[#111b2e] p-3.5">
                <p className="font-medium text-white">Next milestone (Phase 3)</p>
                <p className="mt-1 text-slate-400">
                  Full Last Safe Moment planner and scoped authorisation modal connect next, followed by the controlled demo billing portal and live Kane verification loop.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href="/activity"
                  className="inline-flex min-h-[44px] items-center justify-between rounded-lg border border-white/15 px-3.5 text-xs font-medium text-white hover:bg-white/10"
                >
                  <span>View activity timeline</span>
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
        </section>
      )}

      <SubscriptionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
