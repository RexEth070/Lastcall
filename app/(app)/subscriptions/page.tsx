"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  FlaskConical,
  Search,
  ShieldCheck,
} from "lucide-react";
import { PreviewStateGate } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state-views";
import { StatusBadge } from "@/components/ui/status-badge";
import { DEMO_SUBSCRIPTIONS } from "@/lib/demo-data";
import type { SubscriptionStatus } from "@/lib/types";
import { cn, formatDateTimeInZone, formatMinorCurrency } from "@/lib/utils";

type FilterKey = "all" | "at_risk" | "verified_cancelled" | "needs_attention";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All records" },
  { key: "at_risk", label: "Active & authorised" },
  { key: "needs_attention", label: "Failed / needs human" },
  { key: "verified_cancelled", label: "Verified cancelled" },
];

function matchesFilter(status: SubscriptionStatus, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "at_risk") {
    return status === "active" || status === "action_authorised" || status === "agent_working";
  }
  if (filter === "needs_attention") {
    return (
      status === "verification_failed" ||
      status === "needs_human_action" ||
      status === "unverified_unknown"
    );
  }
  return status === "verified_cancelled";
}

export default function SubscriptionsPage() {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const filtered = DEMO_SUBSCRIPTIONS.filter((sub) => {
    const matchesText =
      query.trim() === "" ||
      sub.serviceName.toLowerCase().includes(query.toLowerCase()) ||
      sub.planName.toLowerCase().includes(query.toLowerCase()) ||
      sub.accountLabel.toLowerCase().includes(query.toLowerCase());
    return matchesText && matchesFilter(sub.status, filter);
  });

  return (
    <div className="space-y-6 animate-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Subscriptions
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Single inventory of recurring services, conservative cancellation windows, and verified states.
          </p>
        </div>
        <div className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#e4e1da] bg-white px-4 text-xs font-medium text-slate-600">
          <span>Add / edit / archive connects to Supabase in Phase 2</span>
        </div>
      </div>

      <PreviewStateGate
        emptyTitle="No subscriptions in your inventory"
        emptyDescription="Add your first subscription with its renewal date, timezone, and policy terms to calculate your Last Safe Moment."
      >
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <label htmlFor="subscription-search" className="sr-only">
              Filter subscriptions by service, plan, or account
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              id="subscription-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search service, plan, or masked account..."
              className="min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter subscriptions by status"
          >
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  "min-h-[44px] rounded-lg border px-3.5 text-xs font-medium transition-colors cursor-pointer",
                  filter === item.key
                    ? "border-[#0b1220] bg-[#0b1220] text-white"
                    : "border-[#e4e1da] bg-white text-slate-700 hover:bg-[#efece5]",
                )}
                aria-pressed={filter === item.key}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subscription Cards */}
        {filtered.length === 0 ? (
          <EmptyState
            title="No matching subscriptions"
            description="No demo records match your current search query or status filter."
            actionLabel="Clear filters"
            onAction={() => {
              setQuery("");
              setFilter("all");
            }}
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((sub) => (
              <Card key={sub.id}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">
                          {sub.serviceName}
                        </h2>
                        <StatusBadge status={sub.status} />
                        {sub.isControlledDemoPortal && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-900">
                            <FlaskConical className="h-3 w-3" aria-hidden />
                            <span>Controlled demo fixture</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600">
                        Plan: <span className="font-medium text-slate-800">{sub.planName}</span> · Account:{" "}
                        <span className="font-mono text-slate-800">{sub.accountLabel}</span> · Timezone:{" "}
                        <span className="font-mono text-slate-800">{sub.timezone}</span>
                      </p>

                      <p className="max-w-prose text-sm text-slate-700">
                        {sub.cancellationPolicyText}
                      </p>

                      <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-3 text-xs">
                          <span className="flex items-center gap-1.5 font-medium text-slate-600">
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                            <span>Next renewal</span>
                          </span>
                          <p className="mt-1 font-mono font-semibold text-slate-900 tabular-nums">
                            {formatDateTimeInZone(sub.nextRenewalAt, sub.timezone)}
                          </p>
                        </div>

                        <div
                          className={cn(
                            "rounded-lg border p-3 text-xs",
                            sub.lastSafeDeadlineAt
                              ? "border-[#e4e1da] bg-[#f7f6f2]"
                              : "border-amber-300 bg-amber-50",
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-medium text-slate-700">
                            {sub.lastSafeDeadlineAt ? (
                              <ShieldCheck className="h-3.5 w-3.5 text-[#1d4ed8]" aria-hidden />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" aria-hidden />
                            )}
                            <span>Last Safe Moment ({sub.safetyBufferHours}h buffer)</span>
                          </span>
                          <p className="mt-1 font-mono font-semibold text-slate-900 tabular-nums">
                            {sub.lastSafeDeadlineAt
                              ? formatDateTimeInZone(
                                  sub.lastSafeDeadlineAt,
                                  sub.timezone,
                                )
                              : "Deadline unknown — cancel now or verify terms"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-3 border-t border-[#e4e1da] pt-4 lg:w-56 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                      <div>
                        <p className="text-xs text-slate-500">Recurring charge</p>
                        <p className="mt-0.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                          {formatMinorCurrency(sub.amountMinor, sub.currency)}
                        </p>
                        <p className="text-xs capitalize text-slate-600">
                          {sub.cadence} · Policy confidence: {sub.policyConfidence.replace("_", " ")}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="rounded-lg border border-[#e4e1da] bg-[#f7f6f2] px-3 py-2 text-xs text-slate-600">
                          Scoped authorisation &amp; browser cancellation unlock in Phases 3–5.
                        </div>
                        <a
                          href={sub.manualFallbackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#e4e1da] bg-white px-3 text-xs font-medium text-slate-700 hover:bg-[#efece5]"
                        >
                          <span>Manual fallback link</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PreviewStateGate>
    </div>
  );
}
