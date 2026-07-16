"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccountType } from "@/lib/types";

export type ActionResult = { ok: true; message?: string } | { error: string };

async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") {
    throw new Error("Forbidden: admin only");
  }
  return session;
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  accountType: AccountType;
  workspaceId?: string | null; // required unless accountType === 'admin'
  department?: string | null; // the desk, for team_incharge
}

/**
 * Onboard a new user: creates the auth account (auto-confirmed), sets their
 * account-level role, and — for team_incharge / client — grants a membership
 * on the chosen workspace. Admin-guarded.
 */
export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  await requireAdmin();

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const { password, accountType } = input;
  const needsWorkspace = accountType !== "admin";
  const workspaceId = input.workspaceId?.trim() || null;

  if (!email) return { error: "Email is required." };
  if (!password || password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (needsWorkspace && !workspaceId)
    return { error: "Select a workspace for this role." };

  const admin = createAdminClient();

  // 1. Create the auth user (email pre-confirmed so they can log in immediately).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email },
  });
  if (createErr) return { error: createErr.message };
  const userId = created.user.id;

  // 2. Set account role + name on the profile (row auto-created by trigger).
  const { error: profErr } = await admin
    .from("profiles")
    .update({ account_type: accountType, full_name: fullName || email })
    .eq("id", userId);
  if (profErr) {
    // Roll back the orphaned auth user so a retry is clean.
    await admin.auth.admin.deleteUser(userId);
    return { error: `Profile update failed: ${profErr.message}` };
  }

  // 3. Grant workspace membership for non-admin roles.
  if (needsWorkspace && workspaceId) {
    const { error: memErr } = await admin.from("memberships").insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: accountType, // 'team_incharge' | 'client' — matches membership_role
      department: accountType === "team_incharge" ? input.department ?? null : null,
    });
    if (memErr) {
      await admin.auth.admin.deleteUser(userId);
      return { error: `Membership grant failed: ${memErr.message}` };
    }
  }

  revalidatePath("/dashboard/team");
  return { ok: true, message: `Created ${email} as ${accountType}.` };
}

/** Grant an existing user access to another workspace. Admin-guarded. */
export async function addMembership(
  userId: string,
  workspaceId: string,
  role: "team_incharge" | "client",
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .upsert(
      { user_id: userId, workspace_id: workspaceId, role },
      { onConflict: "workspace_id,user_id" },
    );
  if (error) return { error: error.message };
  revalidatePath("/dashboard/team");
  return { ok: true };
}

/** Delete a user entirely (auth + cascaded profile/memberships). Admin-guarded. */
export async function deleteUser(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (session.userId === userId) return { error: "You can't delete yourself." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/team");
  return { ok: true };
}
