"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { userFunction } from "@/lib/mendly/access";
import { QA_FIREWALL } from "@/lib/mendly/pipeline";
import { STAGE_LABEL, deskStage, isValidStage, nextStage, prevStage } from "@/lib/mendly/stages";
import { draftCopy } from "@/lib/ai/strategist";
import { decideFormat, type Objective, type Medium } from "@/lib/mendly/strategy";
import { notifyClientReviewReady } from "@/lib/email/resend";
import type { ContentItem, Workspace } from "@/lib/types";

export type ActionResult = { ok: true; message?: string } | { error: string };

/** Snapshot the current copy into content_versions before it's overwritten. */
async function snapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  item: Pick<ContentItem, "id" | "workspace_id" | "hook" | "educational_shift" | "solution" | "tone">,
  authorId: string,
  note: string,
) {
  if (!item.hook && !item.educational_shift && !item.solution) return; // nothing to keep
  await supabase.from("content_versions").insert({
    content_id: item.id,
    workspace_id: item.workspace_id,
    hook: item.hook,
    educational_shift: item.educational_shift,
    solution: item.solution,
    tone: item.tone,
    note,
    author_id: authorId,
  });
}

async function reval(id: string) {
  revalidatePath(`/dashboard/content/${id}`);
  revalidatePath("/dashboard");
}

/** Admin routes a card to any stage (with an optional brief). */
export async function routeStage(
  contentId: string,
  stage: string,
  note: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "admin") return { error: "Only admin can route work." };
  if (!isValidStage(stage)) return { error: "Invalid stage." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ stage, assignment_note: note.trim() || null })
    .eq("id", contentId);
  if (error) return { error: error.message };
  await reval(contentId);
  return { ok: true, message: `Routed to ${STAGE_LABEL[stage]}.` };
}

/** The desk holding a card (or admin) advances it to the next stage. */
export async function advanceStage(contentId: string, note: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const fn = userFunction(session.profile);

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("stage")
    .eq("id", contentId)
    .single<{ stage: string }>();
  if (!item) return { error: "Not found." };
  if (item.stage === "qa") return { error: "Pass this through the QA firewall below." };
  if (fn !== "admin" && deskStage(fn) !== item.stage) return { error: "This item isn't on your desk." };

  const to = nextStage(item.stage);
  if (!to) return { error: "Already at the final stage." };
  const { error } = await supabase
    .from("content_items")
    .update({ stage: to, assignment_note: note.trim() || null })
    .eq("id", contentId);
  if (error) return { error: error.message };
  await reval(contentId);
  return { ok: true, message: `Sent to ${STAGE_LABEL[to]}.` };
}

/** Send a card back one stage (rework). */
export async function returnStage(contentId: string, note: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const fn = userFunction(session.profile);

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("stage")
    .eq("id", contentId)
    .single<{ stage: string }>();
  if (!item) return { error: "Not found." };
  if (fn !== "admin" && deskStage(fn) !== item.stage) return { error: "This item isn't on your desk." };

  const to = prevStage(item.stage);
  if (!to) return { error: "Already at the first stage." };
  const { error } = await supabase
    .from("content_items")
    .update({ stage: to, assignment_note: note.trim() || null })
    .eq("id", contentId);
  if (error) return { error: error.message };
  await reval(contentId);
  return { ok: true, message: `Sent back to ${STAGE_LABEL[to]}.` };
}

/**
 * Refine the AI-drafted content: title + the three-tier copy. Team/admin only
 * (RLS enforces workspace). The objective/format decision stays read-only — it
 * came from the strategy desk and is "never by taste".
 */
export async function updateContent(input: {
  id: string;
  title: string;
  hook: string;
  educationalShift: string;
  solution: string;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };

  const title = input.title.trim();
  if (!title) return { error: "Title cannot be empty." };
  const norm = (s: string) => (s.trim() === "" ? null : s.trim());

  const supabase = await createClient();
  // Snapshot the copy as it was, so edits are always reversible.
  const { data: prev } = await supabase
    .from("content_items")
    .select("id, workspace_id, hook, educational_shift, solution, tone")
    .eq("id", input.id)
    .single<Pick<ContentItem, "id" | "workspace_id" | "hook" | "educational_shift" | "solution" | "tone">>();
  if (prev) await snapshot(supabase, prev, session.userId, "Manual edit");

  const { error } = await supabase
    .from("content_items")
    .update({
      title,
      hook: norm(input.hook),
      educational_shift: norm(input.educationalShift),
      solution: norm(input.solution),
    })
    .eq("id", input.id);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/content/${input.id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved." };
}

/**
 * Re-run the AI copy desk against the brand book with a chosen tone/angle.
 * Snapshots the current copy first, then overwrites with the fresh draft.
 */
export async function regenerateCopy(
  contentId: string,
  tone: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", contentId)
    .single<ContentItem>();
  if (!item) return { error: "Not found." };

  const { data: ws } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", item.workspace_id)
    .single<Workspace>();
  if (!ws) return { error: "Brand not found." };

  await snapshot(supabase, item, session.userId, `Before regenerate${tone ? ` (${tone})` : ""}`);

  const objective = (item.objective as Objective) || "educate";
  const medium: Medium = item.format === "reel" ? "reel" : "post";
  const decision = decideFormat(objective, medium);
  const briefText =
    (item.brief && typeof item.brief === "object" && "message" in item.brief
      ? String((item.brief as Record<string, unknown>).message ?? "")
      : "") || item.title;

  const draft = await draftCopy(ws, briefText, decision, null, tone);

  const { error } = await supabase
    .from("content_items")
    .update({
      hook: draft.hook,
      educational_shift: draft.valueBridge,
      solution: draft.cta,
      tone: tone.trim() || null,
    })
    .eq("id", contentId);
  if (error) return { error: error.message };

  await reval(contentId);
  return {
    ok: true,
    message: draft.provider === "claude" ? "Regenerated with Claude." : "Regenerated (AI key not set — used the on-brand stub).",
  };
}

/** Restore a previous copy version (also snapshots the current one first). */
export async function restoreVersion(versionId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: v } = await supabase
    .from("content_versions")
    .select("*")
    .eq("id", versionId)
    .single<{ content_id: string; hook: string | null; educational_shift: string | null; solution: string | null; tone: string | null }>();
  if (!v) return { error: "Version not found." };

  const { data: cur } = await supabase
    .from("content_items")
    .select("id, workspace_id, hook, educational_shift, solution, tone")
    .eq("id", v.content_id)
    .single<Pick<ContentItem, "id" | "workspace_id" | "hook" | "educational_shift" | "solution" | "tone">>();
  if (cur) await snapshot(supabase, cur, session.userId, "Before restore");

  const { error } = await supabase
    .from("content_items")
    .update({
      hook: v.hook,
      educational_shift: v.educational_shift,
      solution: v.solution,
      tone: v.tone,
    })
    .eq("id", v.content_id);
  if (error) return { error: error.message };

  await reval(v.content_id);
  return { ok: true, message: "Restored." };
}

/** Remove a creative deliverable (asset row + the stored object). Team/admin only. */
export async function removeAsset(assetId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("id, storage_path, content_id")
    .eq("id", assetId)
    .single<{ id: string; storage_path: string; content_id: string | null }>();
  if (!asset) return { error: "Not found." };
  await supabase.storage.from("assets").remove([asset.storage_path]);
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) return { error: error.message };
  if (asset.content_id) await reval(asset.content_id);
  return { ok: true };
}

/** Every firewall check key — the full set that must pass to ship. */
const QA_KEYS: string[] = QA_FIREWALL.flatMap((g) => g.checks.map((c) => c.key));

/** Save firewall progress + per-check notes. Team/admin only (RLS enforces workspace). */
export async function saveQaChecklist(
  contentId: string,
  checklist: Record<string, boolean>,
  notes?: Record<string, string>,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ qa_checklist: checklist, qa_notes: notes ?? {} })
    .eq("id", contentId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/content/${contentId}`);
  return { ok: true };
}

/** QA fails a card: tag reasons + note, send it back to Production for rework. */
export async function sendBackFromQa(
  contentId: string,
  reasons: string[],
  note: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  if (reasons.length === 0 && !note.trim()) return { error: "Pick at least one reason or add a note." };

  const supabase = await createClient();
  const composed = [reasons.join(", "), note.trim()].filter(Boolean).join(" — ");
  const { error } = await supabase
    .from("content_items")
    .update({ stage: "production", assignment_note: `QA rejected: ${composed}`, qa_reject_reasons: reasons.join(",") })
    .eq("id", contentId);
  if (error) return { error: error.message };
  await reval(contentId);
  return { ok: true, message: "Sent back to Production for rework." };
}

/** Social schedules a queued post (stage 'scheduling'). Team/admin only. */
export async function schedulePost(contentId: string, whenIso: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const when = new Date(whenIso);
  if (Number.isNaN(when.getTime())) return { error: "Pick a valid date & time." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ scheduled_at: when.toISOString() })
    .eq("id", contentId);
  if (error) return { error: error.message };
  await reval(contentId);
  revalidatePath("/dashboard/desk/social");
  return { ok: true, message: `Scheduled for ${when.toLocaleString()}.` };
}

/** Mark a scheduled post live (until Meta auto-publish lands, this is manual). */
export async function markPublished(contentId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ stage: "published" })
    .eq("id", contentId);
  if (error) return { error: error.message };
  await reval(contentId);
  revalidatePath("/dashboard/desk/social");
  return { ok: true, message: "Marked as published." };
}

/**
 * The firewall gate: pass to Client review ONLY if all 16 checks pass AND the
 * card is on the QA stage. Enforced server-side — the boundary, not the UI.
 */
export async function submitForClientReview(
  contentId: string,
  checklist: Record<string, boolean>,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };

  const failed = QA_KEYS.filter((k) => checklist[k] !== true);
  if (failed.length > 0) {
    return { error: `${failed.length} firewall check(s) still failing — cannot ship.` };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("stage, title, workspace_id")
    .eq("id", contentId)
    .single<{ stage: string; title: string; workspace_id: string }>();
  if (!item) return { error: "Content not found or not accessible." };
  if (item.stage !== "qa") return { error: "This card isn't on the QA stage." };

  const { error } = await supabase
    .from("content_items")
    .update({ stage: "client_review", qa_checklist: checklist })
    .eq("id", contentId);
  if (error) return { error: error.message };

  // Best-effort: email the client that something needs their approval.
  await notifyClientReviewReady(item.workspace_id, item.title);

  await reval(contentId);
  return { ok: true, message: "Passed the firewall — sent to the client for sign-off." };
}
