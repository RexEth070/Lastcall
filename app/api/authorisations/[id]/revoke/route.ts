import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid authorisation identifier." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: revoked, error } = await supabase
    .from("authorisations")
    .update({ revoked_at: nowIso })
    .eq("id", id)
    .is("revoked_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!revoked) {
    return NextResponse.json(
      { error: "Active authorisation not found." },
      { status: 404 },
    );
  }

  // Return subscription to 'active' if it was waiting in 'action_authorised'
  await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("id", revoked.subscription_id)
    .eq("status", "action_authorised");

  await supabase.from("audit_events").insert({
    user_id: user.id,
    subscription_id: revoked.subscription_id,
    event_type: "authorisation_revoked",
    actor: "user",
    details_json: { authorisation_id: id },
  });

  return NextResponse.json({ authorisation: revoked });
}
