"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CalendarClock,
  Database,
  ExternalLink,
  FlaskConical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state-views";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubscriptionFormModal } from "@/components/subscriptions/subscription-form-modal";
import type { SubscriptionRecord } from "@/lib/db/types";
import type { SubscriptionStatus } from "@/lib/types";
import { cn, formatDateTimeInZone, formatMinorCurrency } from "@/lib/utils";

type FilterKey = "all" | "at_risk" | "needs_attention" | "verified_cancelled";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All records" },
  { key: "at_risk", label: "Active & authorised" },
  { key: "needs_attention", label: "Failed / needs human" },
  { key: "verified_cancelled", label: "Verified cancelled" },
];

function matchesFilter(status: SubscriptionStatus, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "at_risk") {
    return (
      status === "active" ||
      status === "action_authorised" ||
      status === "agent_working"
    );
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

export function SubscriptionsClient({
  initialSubscriptions,
  schemaReady,
  isDemoUser,
}: {
  initialSubscriptions: SubscriptionRecord[];
  schemaReady: boolean;
  isDemoUser: boolean;
}) {
  const [subscriptions, setSubscriptions] =
    React.useState<SubscriptionRecord[]>(initialSubscriptions);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [showArchived, setShowArchived] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SubscriptionRecord | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState(false);
  const [bannerError, setBannerError] = React.useState<string | null>(null);

  const visibleList = subscriptions.filter((sub) => {
    if (!showArchived && sub.archivedAt) return false;
    const matchesText =
      query.trim() === "" ||
      sub.serviceName.toLowerCase().includes(query.toLowerCase()) ||
      sub.planName.toLowerCase().includes(query.toLowerCase()) ||
      sub.accountLabel.toLowerCase().includes(query.toLowerCase());
    return matchesText && matchesFilter(sub.status, filter);
  });

  function handleSaved(record: SubscriptionRecord, isEdit: boolean) {
    setSubscriptions((prev) => {
      const next = isEdit
        ? prev.map((item) => (item.id === record.id ? record : item))
        : [...prev, record];
      return next.sort(
        (a, b) => Date.parse(a.nextRenewalAt) - Date.parse(b.nextRenewalAt),
      );
    });
  }

  async function handleToggleArchive(sub: SubscriptionRecord) {
    setBusyId(sub.id);
    setBannerError(null);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !sub.archivedAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerError(data.error || "Unable to update archive state.");
        return;
      }
      handleSaved(data.subscription as SubscriptionRecord, true);
    } catch {
      setBannerError("Network error while updating subscription.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetDemo() {
    setResetting(true);
    setBannerError(null);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setBannerError(data.error || "Failed to reset demo fixtures.");
        return;
      }
      const listRes = await fetch("/api/subscriptions?includeArchived=true");
      const listData = await listRes.json();
      if (listRes.ok && Array.isArray(listData.subscriptions)) {
        setSubscriptions(listData.subscriptions);
      }
    } catch {
      setBannerError("Network error while resetting demo fixtures.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6 animate-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Subscriptions
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create, edit, and archive subscriptions. Amounts are stored strictly as integer minor units.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isDemoUser && schemaReady && (
            <Button
              variant="secondary"
              onClick={handleResetDemo}
              disabled={resetting}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              <span>{resetting ? "Resetting..." : "Reset demo fixtures"}</span>
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!schemaReady}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>Add subscription</span>
          </Button>
        </div>
      </div>

      {!schemaReady && (
        <Card
          role="alert"
          className="border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
        >
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="font-semibold">Supabase SQL migration pending</p>
              <p className="mt-1 text-xs">
                Run{" "}
                <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono">
                  supabase/migrations/202611200001_initial_schema.sql
                </code>{" "}
                in Supabase Dashboard → SQL Editor, then refresh this page.
              </p>
            </div>
          </div>
        </Card>
      )}

      {bannerError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{bannerError}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
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

        <div className="flex flex-wrap items-center gap-2">
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

          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              "min-h-[44px] rounded-lg border px-3.5 text-xs font-medium transition-colors cursor-pointer",
              showArchived
                ? "border-amber-400 bg-amber-50 text-amber-950"
                : "border-[#e4e1da] bg-white text-slate-700 hover:bg-[#efece5]",
            )}
            aria-pressed={showArchived}
          >
            {showArchived ? "Hiding: none (archived shown)" : "Show archived"}
          </button>
        </div>
      </div>

      {/* Inventory List */}
      {visibleList.length === 0 ? (
        <EmptyState
          title={
            subscriptions.length === 0
              ? "No subscriptions saved yet"
              : "No matching subscriptions"
          }
          description={
            subscriptions.length === 0
              ? "Add your first recurring subscription to calculate a conservative Last Safe Moment deadline."
              : "Adjust your search query, status filter, or archived toggle to view your subscriptions."
          }
          actionLabel={
            subscriptions.length === 0 ? "Add subscription" : "Clear filters"
          }
          onAction={() => {
            if (subscriptions.length === 0) {
              setEditing(null);
              setModalOpen(true);
            } else {
              setQuery("");
              setFilter("all");
              setShowArchived(false);
            }
          }}
        />
      ) : (
        <div className="space-y-4">
          {visibleList.map((sub) => (
            <Card
              key={sub.id}
              className={cn(sub.archivedAt && "opacity-75 bg-[#f7f6f2]")}
            >
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
                      {sub.archivedAt && (
                        <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-800">
                          Archived
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600">
                      Plan:{" "}
                      <span className="font-medium text-slate-800">
                        {sub.planName}
                      </span>{" "}
                      · Account:{" "}
                      <span className="font-mono text-slate-800">
                        {sub.accountLabel}
                      </span>{" "}
                      · Timezone:{" "}
                      <span className="font-mono text-slate-800">
                        {sub.timezone}
                      </span>
                    </p>

                    {sub.cancellationPolicyText && (
                      <p className="max-w-prose text-sm text-slate-700">
                        {sub.cancellationPolicyText}
                      </p>
                    )}

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
                            <ShieldCheck
                              className="h-3.5 w-3.5 text-[#1d4ed8]"
                              aria-hidden
                            />
                          ) : (
                            <AlertTriangle
                              className="h-3.5 w-3.5 text-amber-700"
                              aria-hidden
                            />
                          )}
                          <span>
                            Last Safe Moment ({sub.safetyBufferHours}h buffer)
                          </span>
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

                  <div className="flex flex-col justify-between gap-3 border-t border-[#e4e1da] pt-4 lg:w-60 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <div>
                      <p className="text-xs text-slate-500">Recurring charge</p>
                      <p className="mt-0.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                        {formatMinorCurrency(sub.amountMinor, sub.currency)}
                      </p>
                      <p className="text-xs capitalize text-slate-600">
                        {sub.cadence} · Policy:{" "}
                        {sub.policyType.replace("_", " ")} (
                        {sub.policyConfidence.replace("_", " ")})
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditing(sub);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busyId === sub.id}
                          onClick={() => handleToggleArchive(sub)}
                        >
                          {sub.archivedAt ? (
                            <>
                              <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
                              <span>Restore</span>
                            </>
                          ) : (
                            <>
                              <Archive className="h-3.5 w-3.5" aria-hidden />
                              <span>Archive</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {sub.manualFallbackUrl && (
                        <a
                          href={sub.manualFallbackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#e4e1da] bg-white px-3 text-xs font-medium text-slate-700 hover:bg-[#efece5]"
                        >
                          <span>Manual fallback link</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SubscriptionFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />
    </div>
  );
}
