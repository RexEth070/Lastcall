import { NextResponse } from "next/server";
import {
  ensureSeededDemoAccount,
  getDemoCredentials,
} from "@/lib/db/demo-account";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

export async function POST() {
  try {
    const { schemaReady } = await ensureSeededDemoAccount();
    const { email, password } = getDemoCredentials();

    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: `Demo sign-in failed: ${signInError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      email,
      schemaReady,
      message: schemaReady
        ? "Signed into seeded demo account."
        : "Signed in, but Supabase tables are not created yet. Run supabase/migrations/202611200001_initial_schema.sql in Supabase SQL Editor.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to enter seeded demo mode.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
