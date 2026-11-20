import Link from "next/link";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "./button";
import { Card } from "./card";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#e4e1da] bg-[#f7f6f2] text-slate-700">
        <Inbox className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-600">{description}</p>
      <div className="mt-6">
        {actionHref ? (
          <Link
            href={actionHref}
            className={cn(buttonVariants({ variant: "primary" }))}
          >
            {actionLabel}
          </Link>
        ) : (
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function ErrorState({
  title = "Unable to load this view",
  description = "A temporary issue prevented LASTCALL from loading these records. No subscription status was changed.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Card
      role="alert"
      className="flex flex-col items-start justify-between gap-4 border-red-200 bg-red-50/60 p-6 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-red-950">{title}</h3>
          <p className="mt-1 max-w-prose text-sm text-red-900/90">{description}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="shrink-0">
          <RefreshCw className="h-4 w-4" aria-hidden />
          <span>Try again</span>
        </Button>
      )}
    </Card>
  );
}

export function PageLoadingSkeleton({
  cards = 4,
  rows = 3,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading view">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-[#e4e1da]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-[#efece5]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, idx) => (
          <div
            key={idx}
            className="h-32 animate-pulse rounded-xl border border-[#e4e1da] bg-white p-5"
          >
            <div className="h-3.5 w-28 rounded bg-[#efece5]" />
            <div className="mt-4 h-8 w-20 rounded bg-[#e4e1da]" />
            <div className="mt-3 h-3 w-36 rounded bg-[#efece5]" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="h-24 animate-pulse rounded-xl border border-[#e4e1da] bg-white p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 w-48 rounded bg-[#e4e1da]" />
                <div className="h-3 w-64 max-w-full rounded bg-[#efece5]" />
              </div>
              <div className="h-7 w-28 rounded-md bg-[#efece5]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
