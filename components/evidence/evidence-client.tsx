"use client";

import * as React from "react";
import {
  AlertCircle,
  ExternalLink,
  FileCheck2,
  Image as ImageIcon,
  Lock,
  ShieldAlert,
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
import { formatDateTimeInZone } from "@/lib/utils";

export interface VaultEvidenceItem {
  id: string;
  kind: "screenshot" | "report" | "ndjson_log" | "share_link";
  redacted: boolean;
  created_at: string;
}

export interface VaultAttemptRecord {
  id: string;
  job_id: string;
  service_name: string;
  account_label: string;
  timezone: string;
  attempt_number: number;
  kane_verdict: KaneVerdict | null;
  kane_run_id: string | null;
  kane_share_url: string | null;
  summary: string | null;
  finished_at: string | null;
  evidence_items: VaultEvidenceItem[];
}

export function EvidenceClient({
  records,
}: {
  records: VaultAttemptRecord[];
}) {
  const [openingId, setOpeningId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleOpenSignedEvidence(evidenceId: string) {
    setOpeningId(evidenceId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/signed-url`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        setErrorMsg(data.error || "Unable to generate signed evidence URL.");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setErrorMsg("Network error while requesting signed URL.");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="space-y-6 animate-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Cancellation Evidence Vault
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Privately stored Kane CLI verdicts, run identifiers, TestMu share reports, and 60-second signed screenshot links.
          </p>
        </div>
        <div className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#e4e1da] bg-white px-4 text-xs font-medium text-slate-700">
          <Lock className="h-4 w-4 text-[#1d4ed8]" aria-hidden />
          <span>Private bucket · RLS + 60s signed URLs</span>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[#e4e1da] bg-white p-4 text-xs text-slate-700">
        <ShieldAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
          aria-hidden
        />
        <p>
          A Kane-verified cancellation confirmation is strong visual &amp; DOM evidence, not a universal legal guarantee against billing errors. Always check your next billing statement.
        </p>
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

      {records.length === 0 ? (
        <EmptyState
          title="No verification evidence stored yet"
          description="Once the cancellation worker runs an authorised attempt and Kane CLI verifies the portal, every PASS and FAIL evidence record will be preserved here."
          actionLabel="View subscriptions"
          actionHref="/subscriptions"
        />
      ) : (
        <div className="space-y-5">
          {records.map((rec) => (
            <Card key={rec.id}>
              <CardHeader className="border-b border-[#e4e1da]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>
                        {rec.service_name} — Attempt {rec.attempt_number}
                      </CardTitle>
                      {rec.kane_verdict && (
                        <VerdictBadge verdict={rec.kane_verdict} />
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      Account:{" "}
                      <span className="font-mono">{rec.account_label}</span> ·{" "}
                      {rec.finished_at
                        ? formatDateTimeInZone(rec.finished_at, rec.timezone)
                        : "In progress"}
                    </CardDescription>
                  </div>
                  {rec.kane_run_id && (
                    <span className="font-mono text-xs text-slate-600">
                      Run: {rec.kane_run_id}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-5">
                {rec.summary && (
                  <p className="max-w-prose text-sm text-slate-700">
                    {rec.summary}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2.5">
                  {rec.kane_share_url && (
                    <a
                      href={rec.kane_share_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#0b1220] px-4 text-xs font-medium text-white hover:bg-[#1b2842]"
                    >
                      <FileCheck2 className="h-4 w-4" aria-hidden />
                      <span>Open Kane TestMu report</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}

                  {rec.evidence_items
                    .filter((item) => item.kind !== "share_link")
                    .map((item) => (
                      <Button
                        key={item.id}
                        variant="secondary"
                        size="sm"
                        disabled={openingId === item.id}
                        onClick={() => handleOpenSignedEvidence(item.id)}
                      >
                        <ImageIcon className="h-4 w-4" aria-hidden />
                        <span>
                          {openingId === item.id
                            ? "Signing URL..."
                            : `View private ${item.kind}`}
                        </span>
                      </Button>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
