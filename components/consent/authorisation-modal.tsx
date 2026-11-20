"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubscriptionRecord } from "@/lib/db/types";
import type { LastSafeMomentResult } from "@/lib/cancellation/last-safe-moment";
import { formatDateTimeInZone, formatMinorCurrency } from "@/lib/utils";

const REQUIRED_PHRASE = "Authorise cancellation for this subscription";

export interface AuthorisationRecord {
  id: string;
  subscription_id: string;
  action_type: string;
  scope_summary: string;
  approved_at: string;
  expires_at: string;
  revoked_at: string | null;
  confirmation_version: string;
}

export function AuthorisationModal({
  open,
  subscription,
  plan,
  onClose,
  onAuthorised,
}: {
  open: boolean;
  subscription: SubscriptionRecord;
  plan: LastSafeMomentResult;
  onClose: () => void;
  onAuthorised: (auth: AuthorisationRecord) => void;
}) {
  const [expiresInMinutes, setExpiresInMinutes] = React.useState(60);
  const [checked, setChecked] = React.useState(false);
  const [phrase, setPhrase] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setExpiresInMinutes(60);
    setChecked(false);
    setPhrase("");
    setErrorMessage(null);
  }, [open]);

  if (!open) return null;

  const phraseMatches =
    phrase.trim().toLowerCase() === REQUIRED_PHRASE.toLowerCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!checked || !phraseMatches) {
      setErrorMessage(
        `Check the confirmation box and type "${REQUIRED_PHRASE}" exactly.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/authorisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          expiresInMinutes,
          explicitConfirmation: true,
          confirmationPhrase: phrase.trim(),
          confirmationVersion: "v1",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to record scoped authorisation.");
        return;
      }
      onAuthorised(data.authorisation as AuthorisationRecord);
      onClose();
    } catch {
      setErrorMessage("Network error while recording authorisation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="fixed inset-0 bg-[#0b1220]/75"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl border border-[#e4e1da] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e4e1da] bg-[#0b1220] px-5 py-4 text-white rounded-t-xl sm:px-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-blue-400" aria-hidden />
            <div>
              <h2 id="auth-modal-title" className="text-base font-semibold">
                Explicit cancellation authorisation
              </h2>
              <p className="text-xs text-slate-300">
                Single service · Single action · Expiring &amp; revocable
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Close authorisation modal"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto px-5 py-5 sm:px-6 space-y-4"
          noValidate
        >
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Exact Scope Disclosure */}
          <div className="rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Service</span>
              <span className="font-semibold text-slate-900">
                {subscription.serviceName} ({subscription.planName})
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Account (masked)</span>
              <span className="font-mono font-medium text-slate-900">
                {subscription.accountLabel}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Next renewal</span>
              <span className="font-mono text-slate-900 tabular-nums">
                {formatDateTimeInZone(
                  subscription.nextRenewalAt,
                  subscription.timezone,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Recurring amount</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatMinorCurrency(
                  subscription.amountMinor,
                  subscription.currency,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#e4e1da] pt-2">
              <span className="text-slate-600">Authorised action</span>
              <span className="font-semibold text-[#1d4ed8]">
                Cancel this subscription only
              </span>
            </div>
          </div>

          {/* Consequences & Uncertainty */}
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden />
              <span>Expected access impact &amp; uncertainty</span>
            </div>
            <p>{plan.accessImpactSummary}</p>
            <p className="opacity-90">
              LASTCALL will NOT mark this subscription cancelled until Kane CLI independently verifies the post-cancellation state.
            </p>
          </div>

          {/* Agent Boundaries */}
          <div className="rounded-lg border border-[#e4e1da] bg-white p-3.5 text-xs text-slate-700 space-y-1">
            <p className="font-semibold text-slate-900">
              Strict agent boundaries:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Allowed: navigate cancellation steps on the target portal only.</li>
              <li>Forbidden: plan upgrades, upsells, retention offers, or account deletion.</li>
              <li>Automatic stop: pauses immediately if MFA, CAPTCHA, or ambiguous terms appear.</li>
            </ul>
          </div>

          <div>
            <label
              htmlFor="auth-expiry"
              className="block text-xs font-medium text-slate-700"
            >
              Authorisation expiry window
            </label>
            <select
              id="auth-expiry"
              value={expiresInMinutes}
              onChange={(e) => setExpiresInMinutes(Number(e.target.value))}
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour (recommended)</option>
              <option value={240}>4 hours</option>
              <option value={1440}>24 hours (maximum)</option>
            </select>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-3.5 text-xs text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-400 text-[#1d4ed8]"
            />
            <span>
              I confirm this is the exact account and service I want to cancel, I understand the access impact, and I grant a scoped, revocable authorisation for this single subscription.
            </span>
          </label>

          <div>
            <label
              htmlFor="auth-confirm-phrase"
              className="block text-xs font-medium text-slate-700"
            >
              Type{" "}
              <code className="rounded bg-[#efece5] px-1.5 py-0.5 font-mono text-slate-900">
                {REQUIRED_PHRASE}
              </code>
            </label>
            <input
              id="auth-confirm-phrase"
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={REQUIRED_PHRASE}
              autoComplete="off"
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3 text-sm text-slate-900"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#e4e1da] pt-4 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !checked || !phraseMatches}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>Recording approval...</span>
                </>
              ) : (
                <span>Grant scoped authorisation</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
