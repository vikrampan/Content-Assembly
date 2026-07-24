"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isValidStage } from "@/lib/mendly/stages";
import { notifyChangesRequested } from "@/lib/email/resend";
import { notifyClientOf, notifyDepartments } from "@/lib/notify";

/** Client signs off (or requests changes) on a month's calendar. */
export async function reviewCalendar(
  workspaceId: string,
  month: string, // YYYY-MM-01
  decision: "approve" | "request_changes",
  note?: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (session.role !== "client") return { error: "Only the client approves the calendar." };
  const status = decision === "approve" ? "approved" : "changes_requested";
  if (status === "changes_requested" && !note?.trim())
    return { error: "Please add a note about what to change." };

  const supabase = await createClient();
  const { error } = await supabase.from("calendar_approvals").upsert(
    {
      workspace_id: workspaceId,
      month,
      status,
      note: note?.trim() || null,
      decided_by: session.userId,
      decided_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,month" },
  );
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Server actions backing the interactive Kanban.
 *
 * `moveStage` is used by team / admin only. It relies on the content_items
 * UPDATE policy from 0001 (is_team_member_of) as the real security boundary —
 * a client calling it gets nothing back from RLS. The client's own mutation
 * path is `clientReview`, which goes through the column-restricted RPC.
 */

export type ActionResult = { ok: true } | { error: string };

/** Admin/strategy drag a card between stage columns on the board. */
export async function moveStage(
  contentId: string,
  toStage: string,
): Promise<ActionResult> {
  if (!isValidStage(toStage)) return { error: `Invalid stage: ${toStage}` };
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ stage: toStage })
    .eq("id", contentId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function clientReview(
  contentId: string,
  decision: "approve" | "request_changes",
  comment?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_review_content", {
    p_content_id: contentId,
    p_decision: decision,
    p_comment: comment?.trim() ? comment.trim() : null,
  });

  if (error) return { error: error.message };

  const { data: item } = await supabase.from("content_items").select("title, workspace_id").eq("id", contentId).single<{ title: string; workspace_id: string }>();
  if (decision === "request_changes") {
    await notifyChangesRequested(item?.title ?? "a post", comment?.trim() ?? "");
  } else if (decision === "approve") {
    // Approved → hand off to the Account Manager to schedule.
    await notifyDepartments(["social"], { workspaceId: item?.workspace_id, type: "approved", title: "Client approved a post", body: item?.title, link: `/dashboard/content/${contentId}` });
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Client requests a change on a post, tagged by type — the DB function routes
 * the card to the right desk (content / production) and notifies the team.
 */
export async function requestPostChange(
  contentId: string,
  changeType: "media" | "content" | "editing" | "combination",
  note: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_request_change", {
    p_content_id: contentId,
    p_change_type: changeType,
    p_note: note.trim() || null,
  });
  if (error) return { error: error.message };

  const { data: item } = await supabase.from("content_items").select("title, workspace_id").eq("id", contentId).single<{ title: string; workspace_id: string }>();
  await notifyChangesRequested(item?.title ?? "a post", `[${changeType}] ${note.trim()}`);
  // Route the notification to the desk that will do the rework.
  const depts = changeType === "content" || changeType === "combination" ? ["content"] : ["design", "video", "image", "audio"];
  await notifyDepartments(depts, { workspaceId: item?.workspace_id, type: "change", title: `Client change (${changeType})`, body: item?.title, link: `/dashboard/content/${contentId}` });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/plan");
  return { ok: true };
}

/** Global search across brands + posts (staff only; RLS scopes results). */
export async function globalSearch(q: string): Promise<{ brands: { id: string; name: string }[]; posts: { id: string; title: string; stage: string }[] }> {
  const session = await requireSession();
  const term = q.trim();
  if (session.role === "client" || term.length < 2) return { brands: [], posts: [] };
  const supabase = await createClient();
  const [{ data: b }, { data: p }] = await Promise.all([
    supabase.from("workspaces").select("id, name").ilike("name", `%${term}%`).limit(6),
    supabase.from("content_items").select("id, title, stage").ilike("title", `%${term}%`).order("updated_at", { ascending: false }).limit(10),
  ]);
  return { brands: (b as { id: string; name: string }[]) ?? [], posts: (p as { id: string; title: string; stage: string }[]) ?? [] };
}

/** Mark all of the current user's notifications read. */
export async function markNotificationsRead(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Granular calendar review: a client leaves a suggestion on a single planned
 * post. Stored as a non-internal comment (RLS lets the client insert on their
 * own workspace); the desks see it on the content detail page.
 */
export async function suggestPost(
  contentId: string,
  body: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  const text = body.trim();
  if (!text) return { error: "Write a suggestion first." };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("workspace_id")
    .eq("id", contentId)
    .single<{ workspace_id: string }>();
  if (!item) return { error: "Post not found." };

  const { error } = await supabase.from("comments").insert({
    content_id: contentId,
    workspace_id: item.workspace_id,
    author_id: session.userId,
    body: text,
    internal: false,
  });
  if (error) return { error: error.message };

  // Notify the other side of the conversation.
  if (session.role === "client") {
    await notifyDepartments(["content", "design", "video"], { workspaceId: item.workspace_id, type: "message", title: "Client sent a message", body: text.slice(0, 80), link: `/dashboard/content/${contentId}` });
  } else {
    await notifyClientOf(item.workspace_id, { type: "reply", title: "Your team replied", body: text.slice(0, 80), link: `/dashboard/plan` });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/content/${contentId}`);
  return { ok: true };
}
