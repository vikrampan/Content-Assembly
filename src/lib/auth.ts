import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, Membership, Profile } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
  role: AccountType;
  /** Workspaces this user can access (empty for admins — they see all). */
  memberships: Membership[];
}

/**
 * Resolves the signed-in user's profile + role + workspace memberships on the
 * server. Redirects to /login if there is no session. RLS still enforces the
 * data boundaries — this is for routing/UX, not the security boundary.
 */
export async function requireSession(): Promise<SessionContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // A profile is auto-created by trigger on signup; guard just in case.
  if (!profile) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("*")
    .eq("user_id", user.id);

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    role: profile.account_type,
    memberships: (memberships as Membership[]) ?? [],
  };
}
