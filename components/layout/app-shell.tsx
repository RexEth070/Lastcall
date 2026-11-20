"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CreditCard,
  FileCheck2,
  FlaskConical,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { DEMO_DATA_BANNER_LABEL } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageLoadingSkeleton } from "@/components/ui/state-views";

export type PreviewMode = "default" | "loading" | "empty" | "error";

const PreviewModeContext = React.createContext<{
  mode: PreviewMode;
  setMode: (mode: PreviewMode) => void;
}>({
  mode: "default",
  setMode: () => {},
});

export function usePreviewMode() {
  return React.useContext(PreviewModeContext);
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/evidence", label: "Evidence", icon: FileCheck2 },
] as const;

export function PreviewStateGate({
  emptyTitle,
  emptyDescription,
  children,
}: {
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  const { mode, setMode } = usePreviewMode();

  if (mode === "loading") {
    return <PageLoadingSkeleton />;
  }

  if (mode === "empty") {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel="Restore demo preview records"
        onAction={() => setMode("default")}
      />
    );
  }

  if (mode === "error") {
    return (
      <ErrorState
        title="Simulated preview error state"
        description="LASTCALL failed to fetch subscription data. No cancellation was started and no status was modified."
        onRetry={() => setMode("default")}
      />
    );
  }

  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("default");

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-white focus-visible:outline-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1d4ed8] text-white">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <span className="block text-sm font-semibold tracking-tight">
                LASTCALL
              </span>
              <span className="block text-[11px] text-slate-400">
                Proof-first cancellation
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white lg:hidden cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Main navigation" className="mt-4 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/12 text-white"
                    : "text-slate-300 hover:bg-white/8 hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-lg border border-white/10 bg-[#111b2e] p-3.5 text-xs text-slate-300">
          <p className="font-medium text-white">Seeded demo mode</p>
          <p className="mt-1 text-slate-400 leading-relaxed">
            Explicit consent required before any browser action. Kane CLI verifies every outcome.
          </p>
          <Link
            href="/onboarding"
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-white/15 px-3 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            Account &amp; consent rules
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <PreviewModeContext.Provider
      value={{ mode: previewMode, setMode: setPreviewMode }}
    >
      <div className="min-h-screen bg-[#f7f6f2] lg:flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 lg:bg-[#0b1220] lg:text-white">
          {navContent}
        </aside>

        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex min-h-[60px] items-center justify-between border-b border-white/10 bg-[#0b1220] px-4 text-white lg:hidden">
          <Link href="/" className="flex items-center gap-2.5 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1d4ed8]">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight">LASTCALL</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 cursor-pointer"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {/* Mobile Drawer (solid scrim, no heavy GPU blur) */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 flex lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div
              className="fixed inset-0 bg-[#0b1220]/75"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-[#0b1220] text-white">
              {navContent}
            </div>
          </div>
        )}

        {/* Main Workspace */}
        <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
          {/* Honest Demo Data Banner + Phase 1 UI State Inspector */}
          <div className="border-b border-amber-300/80 bg-amber-50 px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-2.5 text-xs text-amber-950 sm:items-center">
                <FlaskConical
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 sm:mt-0"
                  aria-hidden
                />
                <span>{DEMO_DATA_BANNER_LABEL}</span>
              </div>
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="UI state preview controls"
              >
                <span className="mr-1 text-[11px] font-medium text-amber-900">
                  UI state:
                </span>
                {(["default", "loading", "empty", "error"] as const).map(
                  (stateKey) => (
                    <button
                      key={stateKey}
                      type="button"
                      onClick={() => setPreviewMode(stateKey)}
                      className={cn(
                        "min-h-[32px] rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors cursor-pointer",
                        previewMode === stateKey
                          ? "bg-[#0b1220] text-white"
                          : "border border-amber-300 bg-white text-amber-950 hover:bg-amber-100",
                      )}
                      aria-pressed={previewMode === stateKey}
                    >
                      {stateKey}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </PreviewModeContext.Provider>
  );
}
