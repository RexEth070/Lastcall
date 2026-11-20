"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const CONSENT_RULES = [
  "LASTCALL only attempts cancellation after you explicitly approve that exact subscription.",
  "Every approval is scoped to one service and one action, expires automatically, and can be revoked.",
  "If a portal requires MFA, CAPTCHA, or unclear terms, the agent stops and hands control back to you.",
  "No subscription is marked Verified cancelled until Kane CLI independently proves the final state.",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [authTab, setAuthTab] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [demoLoading, setDemoLoading] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});

  async function handleDemoSignIn() {
    setDemoLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Unable to enter seeded demo mode.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Network error while connecting to Supabase auth.");
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    setFieldErrors({});

    try {
      const endpoint =
        authTab === "login" ? "/api/auth/login" : "/api/auth/signup";
      const payload =
        authTab === "login"
          ? { email, password }
          : { email, password, displayName: displayName || undefined };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Authentication failed.");
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        return;
      }

      if (authTab === "signup" && !data.signedIn) {
        setInfoMessage(data.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Network error while signing in.");
    } finally {
      setAuthLoading(false);
    }
  }

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
            Authentication &amp; authorisation model
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Enter LASTCALL
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Sign straight into the seeded hackathon judge demo account with zero payment setup, or sign in with your own Supabase-isolated account.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div
            role="status"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4ed8]" aria-hidden />
            <span>{infoMessage}</span>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Seeded Judge Demo Mode */}
          <Card className="border-[#1d4ed8]/35 flex flex-col justify-between">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#1d4ed8]">
                <UserCheck className="h-5 w-5" aria-hidden />
              </div>
              <CardTitle>Seeded judge demo account</CardTitle>
              <CardDescription>
                One-click sign-in backed by a real Supabase Auth user and full Row Level Security — preloaded with realistic subscription fixtures.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-300/80 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1">
                <p className="font-semibold">Included demo fixtures:</p>
                <p>
                  CloudStream Pro (Controlled Demo Billing Portal), DesignForge trial, NoteSync AI (unknown policy guardrail), and FocusRead (MFA handoff sample).
                </p>
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={handleDemoSignIn}
                disabled={demoLoading || authLoading}
              >
                {demoLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    <span>Signing into seeded demo...</span>
                  </>
                ) : (
                  <>
                    <span>Enter seeded demo account</span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Personal Supabase Account */}
          <Card>
            <CardHeader>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#efece5] text-slate-800">
                  <Lock className="h-5 w-5" aria-hidden />
                </div>
                <div className="inline-flex rounded-lg border border-[#e4e1da] bg-[#f7f6f2] p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("login");
                      setFieldErrors({});
                      setErrorMessage(null);
                    }}
                    className={`min-h-[36px] rounded-md px-3 text-xs font-medium cursor-pointer ${
                      authTab === "login"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab("signup");
                      setFieldErrors({});
                      setErrorMessage(null);
                    }}
                    className={`min-h-[36px] rounded-md px-3 text-xs font-medium cursor-pointer ${
                      authTab === "signup"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Create account
                  </button>
                </div>
              </div>
              <CardTitle>
                {authTab === "login"
                  ? "Sign in with email"
                  : "Create isolated account"}
              </CardTitle>
              <CardDescription>
                Every subscription, authorisation, and evidence record is isolated to your account via Supabase Row Level Security.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuthSubmit} className="space-y-4" noValidate>
                {authTab === "signup" && (
                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Display name
                    </label>
                    <input
                      id="auth-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3.5 text-sm text-slate-900"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Email address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3.5 text-sm text-slate-900"
                  />
                  {fieldErrors.email?.[0] && (
                    <p className="mt-1 text-xs text-red-700">
                      {fieldErrors.email[0]}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Password (min 8 characters)
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    autoComplete={
                      authTab === "login" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#e4e1da] bg-white px-3.5 text-sm text-slate-900"
                  />
                  {fieldErrors.password?.[0] && (
                    <p className="mt-1 text-xs text-red-700">
                      {fieldErrors.password[0]}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="dark"
                  className="w-full"
                  disabled={authLoading || demoLoading}
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      <span>Please wait...</span>
                    </>
                  ) : authTab === "login" ? (
                    <span>Sign in</span>
                  ) : (
                    <span>Create account</span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How agent authorisation works</CardTitle>
            <CardDescription>
              Before LASTCALL touches any billing page, four non-negotiable guardrails apply.
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
