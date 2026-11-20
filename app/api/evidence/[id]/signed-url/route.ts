import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Generates a short-lived (60s) signed URL for a privately stored evidence artifact
 * strictly after verifying authenticated RLS ownership of the evidence_items row.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid evidence item ID." },
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

  // RLS ensures a user can ONLY fetch their own evidence_items row
  const { data: item, error } = await supabase
    .from("evidence_items")
    .select("id, kind, storage_path, content_type")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!item) {
    return NextResponse.json(
      { error: "Evidence item not found or access denied." },
      { status: 404 },
    );
  }

  if (item.kind === "share_link") {
    return NextResponse.json({ url: item.storage_path, kind: item.kind });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("cancellation-evidence")
    .createSignedUrl(item.storage_path, 60);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signError?.message || "Unable to create signed evidence URL." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: signed.signedUrl,
    expiresInSeconds: 60,
    kind: item.kind,
  });
}
