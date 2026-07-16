"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ContentStatus } from "@/lib/types";

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
