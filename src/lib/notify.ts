// ===========================================================================
// In-app notifications (server-only). Inserts run through the service-role
// client so a client's action can notify staff (and vice-versa) without RLS
// getting in the way. Reads are RLS-scoped to the recipient. No key = no-op.
// ===========================================================================

import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

interface Payload { workspaceId?: string | null; type: string; title: string; body?: string; link?: string }

async function insert(userIds: string[], p: Payload) {
  if (!hasServiceRole() || userIds.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert(
      userIds.map((user_id) => ({ user_id, workspace_id: p.workspaceId ?? null, type: p.type, title: p.title, body: p.body ?? null, link: p.link ?? null })),
    );
  } catch (e) {
    console.error("[notify] failed:", e);
  }
}

export async function notifyUsers(userIds: string[], p: Payload) {
  await insert(userIds, p);
}

/** Notify every staff member in one or more departments. */
export async function notifyDepartments(departments: string[], p: Payload) {
  if (!hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("id").in("department", departments);
    await insert(((data as { id: string }[]) ?? []).map((r) => r.id), p);
  } catch (e) {
    console.error("[notify] dept lookup failed:", e);
  }
}

/** Notify the client owner of a workspace. */
export async function notifyClientOf(workspaceId: string, p: Payload) {
  if (!hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("memberships").select("user_id").eq("workspace_id", workspaceId).eq("role", "client");
    await insert(((data as { user_id: string }[]) ?? []).map((r) => r.user_id), { ...p, workspaceId });
  } catch (e) {
    console.error("[notify] client lookup failed:", e);
  }
}
