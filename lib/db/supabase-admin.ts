import { createClient } from "@supabase/supabase-js";

/**
 * Server-only admin client using SUPABASE_SECRET_KEY.
 * Used strictly for provisioning/resetting the seeded hackathon demo account.
 * NEVER import into client components; NEVER bypass RLS for normal user CRUD.
 */
export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createSupabaseAdminClient must only run on the server.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in server environment.",
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
