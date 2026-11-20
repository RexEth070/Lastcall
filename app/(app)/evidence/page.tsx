"use client";

import {
  CheckCircle2,
  FileCheck2,
  Lock,
  ShieldAlert,
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
import { DEMO_EVIDENCE_RECORDS } from "@/lib/demo-data";
import { formatDateTimeInZone } from "@/lib/utils";

export default function EvidencePage() {
  return (
    <div className="space-y-6 animate-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Cancellation Evidence Vault
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Immutable audit record of independent Kane CLI verdicts, postcondition checks, run identifiers, and privately stored evidence artifacts.
          </p>
        </div>
        <div className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#e4e1da] bg-white px-4 text-xs font-medium text-slate-700">
          <Lock className="h-4 w-4 text-[#1d4ed8]" aria-hidden />
          <span>Private Supabase Storage + signed URLs (Phase 5)</span>
        </div>
      </div>

      <PreviewStateGate
        emptyTitle="Evidence Vault is empty"
        emptyDescription="Completed Kane CLI verification runs — both PASS proofs and caught FAIL diagnostics — will be preserved here with timestamps and redacted evidence."
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-[#e4e1da] bg-white p-4 text-xs text-slate-700">
          <ShieldAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            aria-hidden
          />
          <p>
            A cancellation confirmation screen verified by Kane CLI is strong evidence, not a universal legal guarantee against billing errors. LASTCALL stores the proof and reminds you to verify your next bank statement.
          </p>
        </div>

        <div className="space-y-5">
          {DEMO_EVIDENCE_RECORDS.map((record) => (
            <Card key={record.id}>
              <CardHeader className="border-b border-[#e4e1da]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{record.serviceName}</CardTitle>
                      <VerdictBadge verdict={record.verdict} />
                      <StatusBadge status={record.finalStatus} />
                    </div>
                    <CardDescription className="mt-1">
                      Account: <span className="font-mono">{record.accountLabel}</span> · Verified:{" "}
                      <span className="font-mono tabular-nums">
                        {formatDateTimeInZone(record.verifiedAt, record.timezone)}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-xs font-medium text-slate-900">
                      {record.kaneRunId}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {record.redacted
                        ? "Redacted · Secrets excluded"
                        : "Pending redaction"}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-5">
                <p className="max-w-prose text-sm text-slate-700">
                  {record.summary}
                </p>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Independent postconditions checked by Kane CLI
                  </h4>
                  <ul className="mt-2.5 space-y-2">
                    {record.postconditionsChecked.map((check) => (
                      <li
                        key={check.label}
                        className="flex items-center gap-2.5 rounded-lg border border-[#e4e1da] bg-[#f7f6f2] px-3.5 py-2.5 text-xs text-slate-800"
                      >
                        {check.passed ? (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-emerald-700"
                            aria-hidden
                          />
                        ) : (
                          <XCircle
                            className="h-4 w-4 shrink-0 text-red-700"
                            aria-hidden
                          />
                        )}
                        <span>{check.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-2 rounded-lg border border-[#e4e1da] bg-[#0b1220] p-4 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-slate-400" aria-hidden />
                    <span>
                      Evidence bundle: Phase 1 demo placeholder (signed screenshot &amp; NDJSON pack attach in Phase 5)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    Job {record.jobId}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PreviewStateGate>
    </div>
  );
}
