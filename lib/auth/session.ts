import { createSupabaseServerClient } from "@/lib/db/supabase-server";

export interface AuthenticatedSession {
  userId: string;
  email: string;
  displayName: string;
  isDemoUser: boolean;
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || !user.email) {
      return null;
    }

    const demoEmail = (process.env.DEMO_USER_EMAIL || "demo@lastcall.app")
      .trim()
      .toLowerCase();
    const isDemoUser = user.email.trim().toLowerCase() === demoEmail;
    const metaName =
      typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : null;

    return {
      userId: user.id,
      email: user.email,
      displayName: metaName || (isDemoUser ? "Judge Demo Account" : user.email.split("@")[0]),
      isDemoUser,
    };
  } catch {
    return null;
  }
}
