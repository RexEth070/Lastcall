import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CONSENT_RULES = [
  "LASTCALL only attempts cancellation after you explicitly approve that exact subscription.",
  "Every approval is scoped to one service and one action, expires automatically, and can be revoked.",
  "If a portal requires MFA, CAPTCHA, or unclear terms, the agent stops and hands control back to you.",
  "No subscription is marked Verified cancelled until Kane CLI independently proves the final state.",
];

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      <header className="border-b border-[#e4e1da] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b1220] text-white">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight">LASTCALL</span>
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span>Back to overview</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1d4ed8]">
            Onboarding &amp; authorisation model
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Choose how to enter LASTCALL
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Enter the seeded demo workspace immediately with zero payment setup, or sign in once Supabase authentication is connected in Phase 2.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card className="border-[#1d4ed8]/30">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#1d4ed8]">
                <UserCheck className="h-5 w-5" aria-hidden />
              </div>
              <CardTitle>Demo preview workspace</CardTitle>
              <CardDescription>
                Explore seeded subscriptions, Last Safe Moment deadlines, closed-loop recovery history, and the Evidence Vault right away.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-lg border border-amber-300/80 bg-amber-50 p-3 text-xs text-amber-950">
                Phase 1 displays clearly labelled demo preview data. Live Supabase persistence and seeded judge login wire up in Phase 2.
              </p>
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "primary" }), "w-full")}
              >
                <span>Enter demo dashboard</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[#efece5] text-slate-700">
                <Lock className="h-5 w-5" aria-hidden />
              </div>
              <CardTitle>Personal account sign-in</CardTitle>
              <CardDescription>
                Protected by Supabase Auth and strict Row Level Security so every user&apos;s subscriptions and private evidence stay isolated.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-3 text-xs text-slate-600">
                Authentication connects in Phase 2 (Supabase schema, RLS, and seeded judge credentials).
              </div>
              <span
                aria-disabled="true"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#e4e1da] bg-[#efece5] px-4 text-sm font-medium text-slate-500"
              >
                Available in Phase 2
              </span>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How agent authorisation works</CardTitle>
            <CardDescription>
              Before we ever touch a billing page, LASTCALL enforces four non-negotiable guardrails.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 text-sm text-slate-700">
              {CONSENT_RULES.map((rule) => (
                <li key={rule} className="flex items-start gap-2.5">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4ed8]"
                    aria-hidden
                  />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
