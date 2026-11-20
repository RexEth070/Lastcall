import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { KaneVerdict, SubscriptionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusMeta {
  label: string;
  className: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  spin?: boolean;
}

/**
 * Enforces LASTCALL color discipline:
 * - Green ONLY for `verified_cancelled`
 * - Red ONLY for `verification_failed`
 * - Amber for `needs_human_action` and `unverified_unknown`
 * - Always pairs icon + explicit sentence-case text label (never color alone)
 */
const STATUS_CONFIG: Record<SubscriptionStatus, StatusMeta> = {
  active: {
    label: "Active",
    className: "border-slate-300 bg-slate-100 text-slate-800",
    icon: Clock,
  },
  action_authorised: {
    label: "Action authorised",
    className: "border-blue-200 bg-blue-50 text-blue-900",
    icon: ShieldCheck,
  },
  agent_working: {
    label: "Agent working",
    className: "border-blue-200 bg-blue-50 text-blue-900",
    icon: Loader2,
    spin: true,
  },
  verification_failed: {
    label: "Verification failed",
    className: "border-red-200 bg-red-50 text-red-900",
    icon: XCircle,
  },
  needs_human_action: {
    label: "Needs human action",
    className: "border-amber-300 bg-amber-50 text-amber-950",
    icon: AlertTriangle,
  },
  verified_cancelled: {
    label: "Verified cancelled",
    className: "border-emerald-300 bg-emerald-50 text-emerald-900",
    icon: CheckCircle2,
  },
  unverified_unknown: {
    label: "Unverified / unknown",
    className: "border-amber-300 bg-amber-50 text-amber-950",
    icon: HelpCircle,
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: SubscriptionStatus;
  className?: string;
}) {
  const meta = STATUS_CONFIG[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", meta.spin && "animate-spin")}
        aria-hidden
      />
      <span>{meta.label}</span>
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: KaneVerdict }) {
  if (verdict === "PASS") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-900">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Kane PASS</span>
      </span>
    );
  }
  if (verdict === "FAIL") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 font-mono text-xs font-semibold text-red-900">
        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Kane FAIL</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono text-xs font-semibold text-amber-950">
      <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Kane unavailable</span>
    </span>
  );
}
