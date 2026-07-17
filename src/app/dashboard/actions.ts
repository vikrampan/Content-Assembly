"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ContentStatus } from "@/lib/types";

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

const VALID_STATUSES: ContentStatus[] = [
  "ideation",
  "research",
  "copywriting",
  "visuals",
  "assembly",
  "admin_review",
  "ready_for_client_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
];

export type ActionResult = { ok: true } | { error: string };

export async function moveStage(
  contentId: string,
  toStatus: ContentStatus,
): Promise<ActionResult> {
  if (!VALID_STATUSES.includes(toStatus)) {
    return { error: `Invalid stage: ${toStatus}` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ status: toStatus })
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
  revalidatePath("/dashboard");
  return { ok: true };
}
