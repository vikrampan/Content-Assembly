"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isValidStage } from "@/lib/mendly/stages";
import { notifyChangesRequested } from "@/lib/email/resend";

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

  // Best-effort: nudge the team when the client asks for changes.
  if (decision === "request_changes") {
    const { data: item } = await supabase
      .from("content_items")
      .select("title")
      .eq("id", contentId)
      .single<{ title: string }>();
    await notifyChangesRequested(item?.title ?? "a post", comment?.trim() ?? "");
  }

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
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/content/${contentId}`);
  return { ok: true };
}
