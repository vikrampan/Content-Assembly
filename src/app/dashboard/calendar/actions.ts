"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decideFormat, type Medium, type Objective } from "@/lib/mendly/strategy";

export type ActionResult = { ok: true } | { error: string };

/** Plan a post on a date — creates a content item that enters the pipeline. */
export async function createPlannedPost(input: {
  workspaceId: string;
  title: string;
  objective: Objective;
  medium: Medium;
  date: string; // YYYY-MM-DD
}): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const title = input.title.trim();
  if (!title) return { error: "Give the post a title." };
  if (!input.date) return { error: "Pick a date." };

  const decision = decideFormat(input.objective, input.medium);
  const supabase = await createClient();
  const { error } = await supabase.from("content_items").insert({
    workspace_id: input.workspaceId,
    title,
    format: decision.dbFormat,
    status: "ideation",
    objective: input.objective,
    format_type: decision.formatType,
    format_rationale: decision.rationale,
    planned_date: input.date,
    created_by: session.userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

/** Reschedule a planned post (drag to another day). */
export async function reschedule(contentId: string, date: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ planned_date: date })
    .eq("id", contentId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}
