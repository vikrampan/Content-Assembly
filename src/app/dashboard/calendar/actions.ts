"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decideFormat, type Objective } from "@/lib/mendly/strategy";
import type { PlanFormat } from "@/lib/ai/planner";
import type { ContentBody } from "@/lib/types";

export type ActionResult = { ok: true } | { error: string };

/**
 * Plan a post on a date — creates a content item carrying a full brief (angle,
 * content + design direction) and a per-format plan (slide/beat/frame purposes),
 * and seeds an empty format-shaped body sized to the plan so the Content desk
 * opens pre-structured.
 */
export async function createPlannedPost(input: {
  workspaceId: string;
  title: string;
  objective: Objective;
  format: PlanFormat;
  date: string; // YYYY-MM-DD
  pillarId?: string | null;
  platform?: string;
  angle?: string;
  contentBrief?: string;
  designBrief?: string;
  cta?: string;
  plan?: { purpose: string; note: string }[];
}): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const title = input.title.trim();
  if (!title) return { error: "Give the post a title." };
  if (!input.date) return { error: "Pick a date." };

  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("subject").eq("id", input.workspaceId).maybeSingle<{ subject: string | null }>();
  const decision = decideFormat(input.objective, input.format === "reel" ? "reel" : "post", ws?.subject ?? null);

  const t = (s?: string) => (s && s.trim() ? s.trim() : null);
  const plan = (input.plan ?? []).filter((p) => (p.purpose || p.note));
  const brief = {
    angle: t(input.angle), key_message: t(input.contentBrief), creative_direction: t(input.designBrief),
    cta: t(input.cta), platform: t(input.platform), format: input.format, plan,
  };

  let content_body: ContentBody | null = null;
  if (input.format === "carousel") content_body = { slides: plan.map(() => ({ heading: "", body: "" })), caption: "", hashtags: [] };
  else if (input.format === "reel") content_body = { hook_text: "", beats: plan.map(() => ({ time: "", scene: "", on_screen: "", voiceover: "" })), caption: "", hashtags: [] };
  else if (input.format === "story") content_body = { frames: plan.map(() => ({ text: "", sticker: "" })) };

  const { error } = await supabase.from("content_items").insert({
    workspace_id: input.workspaceId,
    title,
    format: input.format,
    status: "ideation",
    stage: "planning",
    objective: input.objective,
    format_type: decision.formatType,
    format_rationale: decision.rationale,
    planned_date: input.date,
    pillar_id: input.pillarId || null,
    created_by: session.userId,
    brief,
    content_direction: t(input.angle),
    platform: t(input.platform),
    ...(content_body ? { content_body } : {}),
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Reschedule a planned post (drag to another day). */
export async function reschedule(contentId: string, date: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.from("content_items").update({ planned_date: date }).eq("id", contentId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

/** Remove a planned post from the calendar. */
export async function deletePlannedPost(contentId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.from("content_items").delete().eq("id", contentId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}
