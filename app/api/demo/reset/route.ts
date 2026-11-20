import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { resetDemoAccountSubscriptions } from "@/lib/db/demo-account";

export async function POST() {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!session.isDemoUser) {
    return NextResponse.json(
      { error: "Demo reset is only available for the seeded demo account." },
      { status: 403 },
    );
  }

  try {
    const result = await resetDemoAccountSubscriptions(session.userId);
    return NextResponse.json({ ok: true, seededCount: result.count });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reset demo fixtures.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
