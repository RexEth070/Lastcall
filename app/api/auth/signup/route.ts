import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { authCredentialsSchema } from "@/lib/validation/subscription";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = authCredentialsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please fix the highlighted fields.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          display_name:
            parsed.data.displayName || parsed.data.email.split("@")[0],
          timezone: "UTC",
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      signedIn: Boolean(data.session),
      message: data.session
        ? "Account created and signed in."
        : "Account created. Confirm your email address in your inbox, or use the seeded demo account.",
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 },
    );
  }
}
