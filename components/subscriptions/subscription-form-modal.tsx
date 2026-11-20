"use client";

import * as React from "react";
import { AlertCircle, Loader2, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubscriptionRecord } from "@/lib/db/types";
import {
  BILLING_CADENCES,
  COMMON_TIMEZONES,
  POLICY_CONFIDENCES,
  POLICY_TYPES,
  SUPPORTED_CURRENCIES,
  formatMinorToMajorInput,
  parseMajorAmountToMinor,
  subscriptionInputSchema,
} from "@/lib/validation/subscription";

interface SubscriptionFormModalProps {
  open: boolean;
  initial?: SubscriptionRecord | null;
  onClose: () => void;
  onSaved: (record: SubscriptionRecord, isEdit: boolean) => void;
}

function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function SubscriptionFormModal({
  open,
  initial,
  onClose,
  onSaved,
}: SubscriptionFormModalProps) {
  const isEdit = Boolean(initial);

  const [serviceName, setServiceName] = React.useState("");
  const [planName, setPlanName] = React.useState("Standard");
  const [accountLabel, setAccountLabel] = React.useState("");
  const [amountText, setAmountText] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [cadence, setCadence] = React.useState<(typeof BILLING_CADENCES)[number]>("monthly");
  const [renewalLocal, setRenewalLocal] = React.useState("");
  const [timezone, setTimezone] = React.useState("UTC");
  const [policyType, setPolicyType] = React.useState<(typeof POLICY_TYPES)[number]>("unknown");
  const [noticePeriodDays, setNoticePeriodDays] = React.useState("0");
  const [safetyBufferHours, setSafetyBufferHours] = React.useState("48");
  const [policyConfidence, setPolicyConfidence] =
    React.useState<(typeof POLICY_CONFIDENCES)[number]>("unknown");
  const [cancellationPolicyText, setCancellationPolicyText] = React.useState("");
  const [manualFallbackUrl, setManualFallbackUrl] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setErrorBanner(null);
    setFieldErrors({});
    if (initial) {
      setServiceName(initial.serviceName);
      setPlanName(initial.planName);
      setAccountLabel(initial.accountLabel);
      setAmountText(formatMinorToMajorInput(initial.amountMinor));
      setCurrency(initial.currency);
      setCadence(initial.cadence);
      setRenewalLocal(isoToDatetimeLocalValue(initial.nextRenewalAt));
      setTimezone(initial.timezone);
      setPolicyType(initial.policyType);
      setNoticePeriodDays(String(initial.noticePeriodDays));
      setSafetyBufferHours(String(initial.safetyBufferHours));
      setPolicyConfidence(initial.policyConfidence);
      setCancellationPolicyText(initial.cancellationPolicyText);
      setManualFallbackUrl(initial.manualFallbackUrl ?? "");
      setNotes(initial.notes);
    } else {
      const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setServiceName("");
      setPlanName("Standard");
      setAccountLabel("");
      setAmountText("");
      setCurrency("USD");
      setCadence("monthly");
      setRenewalLocal(isoToDatetimeLocalValue(defaultDate.toISOString()));
      setTimezone("UTC");
      setPolicyType("unknown");
      setNoticePeriodDays("0");
      setSafetyBufferHours("48");
      setPolicyConfidence("unknown");
      setCancellationPolicyText("");
      setManualFallbackUrl("");
      setNotes("");
    }
  }, [open, initial]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorBanner(null);
    setFieldErrors({});

    const amountMinor = parseMajorAmountToMinor(amountText);
    if (amountMinor === null) {
      setFieldErrors({
        amountMinor: "Enter a positive amount with up to 2 decimal places (e.g. 19.99).",
      });
      return;
    }

    const parsedRenewal = renewalLocal ? `${renewalLocal}:00.000Z` : "";
    const parsedNotice = Number.parseInt(noticePeriodDays, 10);
    const parsedBuffer = Number.parseInt(safetyBufferHours, 10);

    const payload = {
      serviceName,
      planName,
      accountLabel,
      amountMinor,
      currency: currency.toUpperCase(),
      cadence,
      nextRenewalAt: parsedRenewal,
      timezone,
      policyType,
      noticePeriodDays:
        policyType === "notice_period" && Number.isFinite(parsedNotice)
          ? parsedNotice
          : 0,
      safetyBufferHours: Number.isFinite(parsedBuffer) ? parsedBuffer : 48,
      cancellationPolicyText,
      policyConfidence: policyType === "unknown" ? "unknown" : policyConfidence,
      isControlledDemoPortal: initial?.isControlledDemoPortal ?? false,
      portalUrl: initial?.portalUrl ?? null,
      manualFallbackUrl: manualFallbackUrl.trim() || null,
      notes,
    };

    const clientCheck = subscriptionInputSchema.safeParse(payload);
    if (!clientCheck.success) {
      const flat = clientCheck.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [key, messages] of Object.entries(flat)) {
        if (messages?.[0]) mapped[key] = messages[0];
      }
      setFieldErrors(mapped);
      setErrorBanner("Please fix the highlighted validation errors.");
      return;
    }

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/subscriptions/${initial!.id}`
        : "/api/subscriptions";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientCheck.data),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorBanner(data.error || "Failed to save subscription.");
        if (data.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, msgs] of Object.entries(
            data.fieldErrors as Record<string, string[]>,
          )) {
            if (msgs?.[0]) mapped[k] = msgs[0];
          }
          setFieldErrors(mapped);
        }
        return;
      }

      onSaved(data.subscription as SubscriptionRecord, isEdit);
      onClose();
    } catch {
      setErrorBanner("Network error while saving subscription.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-modal-title"
    >
      {/* Solid scrim backdrop (no heavy blur) */}
      <div
        className="fixed inset-0 bg-[#0b1220]/75"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[#e4e1da] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e4e1da] px-5 py-4 sm:px-6">
          <div>
            <h2
              id="sub-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              {isEdit ? "Edit subscription" : "Add subscription"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Stored in integer minor units with user-scoped Supabase RLS.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-[#efece5] hover:text-slate-900 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto px-5 py-5 sm:px-6 space-y-4"
          noValidate
        >
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/80 bg-amber-50 p-3 text-xs text-amber-950">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            <span>
              Privacy guardrail: enter a masked account identifier (e.g.{" "}
              <code className="font-mono">sam.***@email.com</code>). Never enter passwords, card numbers, or OTPs.
            </span>
          </div>

          {errorBanner && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden />
              <span>{errorBanner}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sub-service-name"
                className="block text-xs font-medium text-slate-700"
              >
                Service name *
              </label>
              <input
                id="sub-service-name"
                type="text"
                required
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. CloudStream Pro"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900"
              />
              {fieldErrors.serviceName && (
                <p className="mt-1 text-xs text-red-700">
                  {fieldErrors.serviceName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="sub-plan-name"
                className="block text-xs font-medium text-slate-700"
              >
                Plan name *
              </label>
              <input
                id="sub-plan-name"
                type="text"
                required
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Creator Monthly"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900"
              />
              {fieldErrors.planName && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.planName}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="sub-account-label"
              className="block text-xs font-medium text-slate-700"
            >
              Masked account label *
            </label>
            <input
              id="sub-account-label"
              type="text"
              required
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              placeholder="e.g. alex.d***@example.com"
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900"
            />
            {fieldErrors.accountLabel && (
              <p className="mt-1 text-xs text-red-700">
                {fieldErrors.accountLabel}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="sub-amount"
                className="block text-xs font-medium text-slate-700"
              >
                Billing amount *
              </label>
              <input
                id="sub-amount"
                type="text"
                inputMode="decimal"
                required
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="19.99"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 font-mono text-sm text-slate-900 tabular-nums"
              />
              {fieldErrors.amountMinor && (
                <p className="mt-1 text-xs text-red-700">
                  {fieldErrors.amountMinor}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="sub-currency"
                className="block text-xs font-medium text-slate-700"
              >
                Currency (ISO) *
              </label>
              <select
                id="sub-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 font-mono text-sm text-slate-900"
              >
                {SUPPORTED_CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
              {fieldErrors.currency && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.currency}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="sub-cadence"
                className="block text-xs font-medium text-slate-700"
              >
                Billing cadence *
              </label>
              <select
                id="sub-cadence"
                value={cadence}
                onChange={(e) =>
                  setCadence(e.target.value as (typeof BILLING_CADENCES)[number])
                }
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm capitalize text-slate-900"
              >
                {BILLING_CADENCES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sub-renewal"
                className="block text-xs font-medium text-slate-700"
              >
                Next renewal date &amp; time (UTC) *
              </label>
              <input
                id="sub-renewal"
                type="datetime-local"
                required
                value={renewalLocal}
                onChange={(e) => setRenewalLocal(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 font-mono text-sm text-slate-900"
              />
              {fieldErrors.nextRenewalAt && (
                <p className="mt-1 text-xs text-red-700">
                  {fieldErrors.nextRenewalAt}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="sub-timezone"
                className="block text-xs font-medium text-slate-700"
              >
                Provider timezone *
              </label>
              <select
                id="sub-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 font-mono text-sm text-slate-900"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              {fieldErrors.timezone && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.timezone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="sub-policy-type"
                className="block text-xs font-medium text-slate-700"
              >
                Cancellation policy *
              </label>
              <select
                id="sub-policy-type"
                value={policyType}
                onChange={(e) => {
                  const next = e.target.value as (typeof POLICY_TYPES)[number];
                  setPolicyType(next);
                  if (next === "unknown") {
                    setPolicyConfidence("unknown");
                    setNoticePeriodDays("0");
                  } else if (policyConfidence === "unknown") {
                    setPolicyConfidence("user_provided");
                  }
                }}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900"
              >
                <option value="unknown">Unknown policy</option>
                <option value="immediate">Immediate effect</option>
                <option value="end_of_period">End of paid period</option>
                <option value="notice_period">Notice period required</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="sub-notice-days"
                className="block text-xs font-medium text-slate-700"
              >
                Notice period (days)
              </label>
              <input
                id="sub-notice-days"
                type="number"
                min={0}
                max={365}
                disabled={policyType !== "notice_period"}
                value={policyType === "notice_period" ? noticePeriodDays : "0"}
                onChange={(e) => setNoticePeriodDays(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 font-mono text-sm text-slate-900 disabled:bg-[#efece5] disabled:text-slate-500"
              />
              {fieldErrors.noticePeriodDays && (
                <p className="mt-1 text-xs text-red-700">
                  {fieldErrors.noticePeriodDays}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="sub-buffer-hours"
                className="block text-xs font-medium text-slate-700"
              >
                Safety buffer (hours)
              </label>
              <input
                id="sub-buffer-hours"
                type="number"
                min={0}
                max={336}
                value={safetyBufferHours}
                onChange={(e) => setSafetyBufferHours(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 font-mono text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sub-confidence"
                className="block text-xs font-medium text-slate-700"
              >
                Policy confidence
              </label>
              <select
                id="sub-confidence"
                disabled={policyType === "unknown"}
                value={policyType === "unknown" ? "unknown" : policyConfidence}
                onChange={(e) =>
                  setPolicyConfidence(
                    e.target.value as (typeof POLICY_CONFIDENCES)[number],
                  )
                }
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900 disabled:bg-[#efece5]"
              >
                <option value="unknown">Unknown</option>
                <option value="user_provided">User provided</option>
                <option value="verified">Verified provider terms</option>
              </select>
              {fieldErrors.policyConfidence && (
                <p className="mt-1 text-xs text-red-700">
                  {fieldErrors.policyConfidence}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="sub-fallback-url"
                className="block text-xs font-medium text-slate-700"
              >
                Official cancellation link (manual fallback)
              </label>
              <input
                id="sub-fallback-url"
                type="url"
                value={manualFallbackUrl}
                onChange={(e) => setManualFallbackUrl(e.target.value)}
                placeholder="https://provider.example/billing"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900"
              />
              {fieldErrors.manualFallbackUrl && (
                <p className="mt-1 text-xs text-red-700">
                  {fieldErrors.manualFallbackUrl}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="sub-policy-text"
              className="block text-xs font-medium text-slate-700"
            >
              Cancellation policy summary
            </label>
            <textarea
              id="sub-policy-text"
              rows={2}
              value={cancellationPolicyText}
              onChange={(e) => setCancellationPolicyText(e.target.value)}
              placeholder="Documented terms, access impact, or notice requirements..."
              className="mt-1.5 w-full rounded-lg border border-[#e4e1da] bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="sub-notes"
              className="block text-xs font-medium text-slate-700"
            >
              Notes (optional)
            </label>
            <input
              id="sub-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reminder context for why you plan to cancel..."
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#e4e1da] pt-4 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>Saving...</span>
                </>
              ) : isEdit ? (
                <span>Save changes</span>
              ) : (
                <span>Save subscription</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
