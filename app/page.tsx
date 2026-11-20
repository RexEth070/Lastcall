import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Lock,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    number: "01",
    title: "Compute the Last Safe Moment",
    body: "Combine renewal timestamp, provider timezone, documented notice period, and a configurable safety buffer. If terms are unknown, LASTCALL never invents a safe date.",
    icon: CalendarClock,
  },
  {
    number: "02",
    title: "Authorise one exact action",
    body: "Review the service, masked account identifier, next renewal, and access impact. Grant a scoped, expiring, revocable approval for that single subscription.",
    icon: ShieldCheck,
  },
  {
    number: "03",
    title: "Verify independently with Kane CLI",
    body: "A button click is not proof. After the browser agent acts on the controlled demo portal, Kane CLI opens an independent browser check to confirm the post-cancellation state.",
    icon: FileCheck2,
  },
  {
    number: "04",
    title: "Recover safely or hand off",
    body: "If Kane catches a missed confirmation, structured failure feedback triggers up to two bounded recovery retries — or stops safely into Needs human action.",
    icon: RefreshCcw,
  },
];

const PRIVACY_PILLARS = [
  "Never stores bank credentials, card numbers, raw passwords, cookies, or OTPs.",
  "Never bypasses CAPTCHA, MFA, or anti-bot protections — pauses cleanly for human control.",
  "Never labels an unverified or timed-out attempt as cancelled.",
  "Uses an owned controlled demo billing portal fixture for hackathon verification.",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f6f2] text-slate-900">
      {/* Deep Ink Navigation + Hero */}
      <div className="bg-[#0b1220] text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1d4ed8]">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-tight">
              LASTCALL
            </span>
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              href="/onboarding"
              className="hidden min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Consent rules
            </Link>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "primary" }))}
            >
              <span>Try demo</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </nav>
        </header>

        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7 animate-enter">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-[#111b2e] px-3 py-1.5 text-xs font-medium text-slate-200">
                <Lock className="h-3.5 w-3.5 text-amber-400" aria-hidden />
                <span>Proof before status · Verified independently by Kane CLI</span>
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Your subscriptions have an expiry date. Your AI makes sure they respect it.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                LASTCALL tracks upcoming renewals, calculates your conservative Last Safe Moment, requires explicit per-subscription approval, and refuses to call a cancellation complete until Kane CLI independently proves the final browser state.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/onboarding"
                  className={cn(
                    buttonVariants({ variant: "primary", size: "lg" }),
                  )}
                >
                  <span>Try demo workspace</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/20 px-6 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  How verification works
                </a>
              </div>

              <p className="mt-5 text-xs text-slate-400">
                Hackathon prototype: browser cancellation runs against an owned controlled demo billing portal fixture, not live third-party providers.
              </p>
            </div>

            {/* Proof-before-status visual ledger card */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-white/12 bg-[#111b2e] p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Closed-loop verification contract
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-white">
                      CloudStream Pro (Demo Portal)
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-medium text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    <span>Kane PASS</span>
                  </span>
                </div>

                <ol className="mt-4 space-y-3 text-xs">
                  <li className="rounded-lg border border-white/10 bg-[#0b1220] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200">
                        1. Attempt 1 — Agent clicks Cancel
                      </span>
                      <span className="font-mono text-amber-300">Unverified</span>
                    </div>
                    <p className="mt-1 text-slate-400">
                      Extra confirmation step stayed unchecked on the billing portal.
                    </p>
                  </li>
                  <li className="rounded-lg border border-red-400/25 bg-red-950/35 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-red-200">
                        2. Kane CLI catches missed confirmation
                      </span>
                      <span className="font-mono text-red-300">FAIL</span>
                    </div>
                    <p className="mt-1 text-red-200/80">
                      Structured failure assertions fed back to agent for bounded recovery.
                    </p>
                  </li>
                  <li className="rounded-lg border border-emerald-400/25 bg-emerald-950/35 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-200">
                        3. Attempt 2 + Kane re-verification
                      </span>
                      <span className="font-mono text-emerald-300">VERIFIED</span>
                    </div>
                    <p className="mt-1 text-emerald-200/80">
                      Status confirmed Cancelled, renewal removed, evidence sealed in vault.
                    </p>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* How it works */}
      <section
        id="how-it-works"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1d4ed8]">
            Architecture of trust
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
            Not another reminder list. A verified closed loop.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Every step is separated so a misclick, retention dark pattern, or network timeout can never silently mark a subscription as cancelled.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="rounded-xl border border-[#e4e1da] bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e4e1da] bg-[#f7f6f2] text-slate-900">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-400">
                    {step.number}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Privacy & Boundaries */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#e4e1da] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800">
                <ShieldAlert className="h-4 w-4" aria-hidden />
                <span>Security, consent &amp; honest limits</span>
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                Built with explicit boundaries from day one
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Cancellation carries financial and access consequences. LASTCALL treats user consent and evidence verification as first-class product features.
              </p>
            </div>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "dark" }), "shrink-0")}
            >
              <span>Inspect demo dashboard</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PRIVACY_PILLARS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-4 text-sm text-slate-800"
              >
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4ed8]"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
