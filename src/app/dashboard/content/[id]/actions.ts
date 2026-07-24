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
import { notifyClientOf, notifyDepartments } from "@/lib/notify";
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

/** Remove a creative deliverable — keeps the file if another row still uses it. */
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
  // Only delete the stored object if this was the last row referencing it
  // (library picks share the file with their library row).
  const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("storage_path", asset.storage_path);
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) return { error: error.message };
  if ((count ?? 0) <= 1 && !asset.storage_path.startsWith("pending/")) {
    await supabase.storage.from("assets").remove([asset.storage_path]);
  }
  if (asset.content_id) await reval(asset.content_id);
  return { ok: true };
}

export interface LibraryPick {
  id: string;
  url: string | null;
  name: string;
  kind: string;
  isImage: boolean;
  isVideo: boolean;
}

const PICK_IMG = /\.(png|jpe?g|gif|webp|avif)$/i;
const PICK_VID = /\.(mp4|mov|webm|m4v)$/i;

/** List the brand's library media (shot or generated) to pick as a deliverable. */
export async function listLibraryPicks(workspaceId: string): Promise<LibraryPick[]> {
  const session = await requireSession();
  if (session.role === "client") return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("assets")
    .select("id, storage_path, kind, label")
    .eq("workspace_id", workspaceId)
    .is("content_id", null)
    .in("kind", ["raw", "generated", "final"])
    .eq("gen_status", "ready")
    .order("created_at", { ascending: false })
    .limit(60);
  const rows = (data as { id: string; storage_path: string; kind: string; label: string | null }[]) ?? [];
  return Promise.all(
    rows.map(async (a) => {
      const { data: signed } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
      return {
        id: a.id,
        url: signed?.signedUrl ?? null,
        name: a.label ?? (a.storage_path.split("/").pop() ?? "asset"),
        kind: a.kind,
        isImage: PICK_IMG.test(a.storage_path),
        isVideo: PICK_VID.test(a.storage_path),
      };
    }),
  );
}

/** Attach a library asset to a content card as a deliverable (shares the file). */
export async function attachLibraryAsset(contentId: string, assetId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: src } = await supabase
    .from("assets")
    .select("workspace_id, storage_path, label, kind")
    .eq("id", assetId)
    .single<{ workspace_id: string; storage_path: string; label: string | null; kind: string }>();
  if (!src) return { error: "Asset not found." };
  const { error } = await supabase.from("assets").insert({
    workspace_id: src.workspace_id,
    content_id: contentId,
    storage_path: src.storage_path,
    kind: "final",
    label: src.label,
    uploaded_by: session.userId,
  });
  if (error) return { error: error.message };
  await reval(contentId);
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
  const { data: item } = await supabase.from("content_items").select("workspace_id").eq("id", contentId).single<{ workspace_id: string }>();
  const { error } = await supabase
    .from("content_items")
    .update({ stage: "production", assignment_note: `QA rejected: ${composed}`, qa_reject_reasons: reasons.join(",") })
    .eq("id", contentId);
  if (error) return { error: error.message };
  if (item) {
    await supabase.from("qa_reviews").insert({ content_id: contentId, workspace_id: item.workspace_id, reviewer_id: session.userId, result: "rejected", reasons: composed });
    await notifyDepartments(["content", "design", "video", "image", "audio"], { workspaceId: item.workspace_id, type: "qa_reject", title: "QA sent a post back", body: composed.slice(0, 80), link: `/dashboard/content/${contentId}` });
  }
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

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("stage, title, workspace_id")
    .eq("id", contentId)
    .single<{ stage: string; title: string; workspace_id: string }>();
  if (!item) return { error: "Content not found or not accessible." };
  if (item.stage !== "qa") return { error: "This card isn't on the QA stage." };

  // Validate against THIS brand's firewall (or the default if none generated).
  const { data: cl } = await supabase.from("qa_checklists").select("groups").eq("workspace_id", item.workspace_id).maybeSingle<{ groups: { checks: { key: string }[] }[] }>();
  const requiredKeys = cl?.groups?.length ? cl.groups.flatMap((g) => g.checks.map((c) => c.key)) : QA_KEYS;
  const failed = requiredKeys.filter((k) => checklist[k] !== true);
  if (failed.length > 0) {
    return { error: `${failed.length} firewall check(s) still failing — cannot ship.` };
  }

  const { error } = await supabase
    .from("content_items")
    .update({ stage: "client_review", qa_checklist: checklist })
    .eq("id", contentId);
  if (error) return { error: error.message };

  await supabase.from("qa_reviews").insert({ content_id: contentId, workspace_id: item.workspace_id, reviewer_id: session.userId, result: "passed", passed: requiredKeys.length, total: requiredKeys.length });

  // Best-effort: email + in-app notify the client that something needs approval.
  await notifyClientReviewReady(item.workspace_id, item.title);
  await notifyClientOf(item.workspace_id, { type: "review", title: "A post is ready for your approval", body: item.title, link: "/dashboard/approvals" });

  await reval(contentId);
  return { ok: true, message: "Passed the firewall — sent to the client for sign-off." };
}

// ===========================================================================
// Content desk (0018) — hook engine, copy engineering, voice lint, variants.
// ===========================================================================
import { generateHooks, engineerCopy, lintVoice, generateVariant } from "@/lib/ai/copywriter";
import { PLATFORMS } from "@/lib/mendly/copy";
import type { HookCandidate, VoiceFlags } from "@/lib/types";

async function loadItemWs(contentId: string) {
  const supabase = await createClient();
  const { data: item } = await supabase.from("content_items").select("*").eq("id", contentId).single<ContentItem>();
  if (!item) return null;
  const { data: ws } = await supabase.from("workspaces").select("*").eq("id", item.workspace_id).single<Workspace>();
  if (!ws) return null;
  return { supabase, item, ws };
}

/** Generate scored hook candidates and stash them on the item. */
export async function generateHooksAction(contentId: string, formula: string): Promise<{ ok: true; hooks: HookCandidate[] } | { error: string }> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const ctx = await loadItemWs(contentId);
  if (!ctx) return { error: "Not found." };
  const hooks = await generateHooks(ctx.ws, ctx.item, formula);
  if (hooks.length === 0) return { error: "Hook engine needs ANTHROPIC_API_KEY on the server." };
  await ctx.supabase.from("content_items").update({ hook_options: hooks }).eq("id", contentId);
  await reval(contentId);
  return { ok: true, hooks };
}

/** Apply a chosen hook as the post's hook (snapshots first). */
export async function applyHook(contentId: string, hookText: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const ctx = await loadItemWs(contentId);
  if (!ctx) return { error: "Not found." };
  await snapshot(ctx.supabase, ctx.item, session.userId, "Applied hook");
  const { error } = await ctx.supabase.from("content_items").update({ hook: hookText }).eq("id", contentId);
  if (error) return { error: error.message };
  await reval(contentId);
  return { ok: true, message: "Hook applied." };
}

/** Re-engineer the three-tier copy with triggers + framework + devices. */
export async function engineerCopyAction(
  contentId: string,
  opts: { triggers: string[]; framework: string | null; devices: string[]; tone?: string },
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const ctx = await loadItemWs(contentId);
  if (!ctx) return { error: "Not found." };
  const out = await engineerCopy(ctx.ws, ctx.item, opts);
  if (!out) return { error: "Copy engine needs ANTHROPIC_API_KEY on the server." };
  await snapshot(ctx.supabase, ctx.item, session.userId, "Engineered copy");
  const { error } = await ctx.supabase.from("content_items").update({
    hook: out.hook, educational_shift: out.valueBridge, solution: out.cta,
    triggers: opts.triggers, framework: opts.framework, devices: opts.devices,
    tone: opts.tone?.trim() || ctx.item.tone,
  }).eq("id", contentId);
  if (error) return { error: error.message };
  await reval(contentId);
  return { ok: true, message: "Copy re-engineered." };
}

/** Run the brand-voice lint and store the result. */
export async function lintVoiceAction(contentId: string): Promise<{ ok: true; flags: VoiceFlags } | { error: string }> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const ctx = await loadItemWs(contentId);
  if (!ctx) return { error: "Not found." };
  const flags = await lintVoice(ctx.ws, ctx.item);
  await ctx.supabase.from("content_items").update({ voice_flags: flags }).eq("id", contentId);
  await reval(contentId);
  return { ok: true, flags };
}

/** Generate (or regenerate) a per-platform variant. */
export async function generateVariantAction(contentId: string, platform: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const ctx = await loadItemWs(contentId);
  if (!ctx) return { error: "Not found." };
  const hint = PLATFORMS.find((p) => p.key === platform)?.hint ?? "";
  const body = await generateVariant(ctx.ws, ctx.item, platform, hint);
  if (!body) return { error: "Variants need ANTHROPIC_API_KEY on the server." };
  const { error } = await ctx.supabase.from("content_variants").upsert(
    { content_id: contentId, workspace_id: ctx.item.workspace_id, platform, body, created_by: session.userId, updated_at: new Date().toISOString() },
    { onConflict: "content_id,platform" },
  );
  if (error) return { error: error.message };
  await reval(contentId);
  return { ok: true, message: `${platform} variant ready.` };
}

/** Save a manually edited variant. */
export async function saveVariant(contentId: string, workspaceId: string, platform: string, body: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.from("content_variants").upsert(
    { content_id: contentId, workspace_id: workspaceId, platform, body, created_by: session.userId, updated_at: new Date().toISOString() },
    { onConflict: "content_id,platform" },
  );
  if (error) return { error: error.message };
  await reval(contentId);
  return { ok: true };
}

export async function deleteVariant(variantId: string, contentId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.from("content_variants").delete().eq("id", variantId);
  if (error) return { error: error.message };
  await reval(contentId);
  return { ok: true };
}

// ===========================================================================
// QA desk (0019) — brand-specific firewall + AI review + review log.
// ===========================================================================
import { generateChecklist, runAiReview } from "@/lib/ai/qaReviewer";
import type { QaGroup } from "@/lib/types";

const QA_IMG = /\.(png|jpe?g|gif|webp|avif)$/i;

/** Generate a brand-specific firewall from the brand book (admin/QA). */
export async function generateBrandChecklist(workspaceId: string): Promise<{ ok: true; groups: QaGroup[] } | { error: string }> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single<Workspace>();
  if (!ws) return { error: "Brand not found." };
  const groups = await generateChecklist(ws);
  if (groups.length === 0) return { error: "Firewall generation needs ANTHROPIC_API_KEY on the server." };
  const { error } = await supabase.from("qa_checklists").upsert(
    { workspace_id: workspaceId, groups, ai_generated: true, updated_by: session.userId, updated_at: new Date().toISOString() },
    { onConflict: "workspace_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/dashboard/desk/qa");
  return { ok: true, groups };
}

/** Run the AI reviewer over the copy + deliverable images. */
export async function runAiQa(contentId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const ctx = await loadItemWs(contentId);
  if (!ctx) return { error: "Not found." };

  // Resolve the brand's checklist (or the default firewall).
  const { data: cl } = await ctx.supabase.from("qa_checklists").select("groups").eq("workspace_id", ctx.item.workspace_id).maybeSingle<{ groups: QaGroup[] }>();
  const groups = cl?.groups?.length ? cl.groups : QA_FIREWALL;

  // Signed URLs for the deliverable images.
  const { data: assetRows } = await ctx.supabase.from("assets").select("storage_path").eq("content_id", contentId);
  const imgs: string[] = [];
  for (const a of (assetRows as { storage_path: string }[]) ?? []) {
    if (!QA_IMG.test(a.storage_path)) continue;
    const { data } = await ctx.supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
    if (data?.signedUrl) imgs.push(data.signedUrl);
  }

  const result = await runAiReview(ctx.ws, ctx.item, groups, imgs);
  if (!result) return { error: "AI review needs ANTHROPIC_API_KEY on the server." };
  await ctx.supabase.from("content_items").update({ qa_ai: result }).eq("id", contentId);
  await reval(contentId);
  return { ok: true };
}

// ===========================================================================
// Social desk (0020) — multi-platform scheduling + publish seam.
// ===========================================================================
import { publish } from "@/lib/social/publish";

/** Recompute the item's primary scheduled time + stage from its platform rows. */
async function syncSchedule(supabase: Awaited<ReturnType<typeof createClient>>, contentId: string) {
  const { data: rows } = await supabase.from("scheduled_posts").select("scheduled_at, status").eq("content_id", contentId);
  const list = (rows as { scheduled_at: string; status: string }[]) ?? [];
  const queued = list.filter((r) => r.status === "queued");
  const earliest = queued.map((r) => r.scheduled_at).sort()[0] ?? null;
  const allPublished = list.length > 0 && list.every((r) => r.status === "published");
  const patch: Record<string, unknown> = { scheduled_at: earliest };
  if (allPublished) patch.stage = "published";
  await supabase.from("content_items").update(patch).eq("id", contentId);
}

/** Schedule a post to one or more platforms (each at its own time). */
export async function schedulePlatforms(
  contentId: string,
  entries: { platform: string; scheduledAt: string; firstComment?: string }[],
  utm?: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  if (entries.length === 0) return { error: "Pick at least one platform." };

  const supabase = await createClient();
  const { data: item } = await supabase.from("content_items").select("workspace_id, stage").eq("id", contentId).single<{ workspace_id: string; stage: string }>();
  if (!item) return { error: "Not found." };

  for (const e of entries) {
    const when = new Date(e.scheduledAt);
    if (Number.isNaN(when.getTime())) return { error: `Invalid time for ${e.platform}.` };
    const { error } = await supabase.from("scheduled_posts").upsert(
      { content_id: contentId, workspace_id: item.workspace_id, platform: e.platform, scheduled_at: when.toISOString(), status: "queued", first_comment: e.firstComment?.trim() || null, utm: utm?.trim() || null, created_by: session.userId },
      { onConflict: "content_id,platform" },
    );
    if (error) return { error: error.message };
  }
  if (item.stage !== "published" && item.stage !== "scheduling") {
    await supabase.from("content_items").update({ stage: "scheduling" }).eq("id", contentId);
  }
  await syncSchedule(supabase, contentId);
  await reval(contentId);
  revalidatePath("/dashboard/desk/social");
  return { ok: true, message: `Scheduled to ${entries.length} platform(s).` };
}

export async function reschedulePlatform(scheduledId: string, whenIso: string, contentId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const when = new Date(whenIso);
  if (Number.isNaN(when.getTime())) return { error: "Invalid time." };
  const supabase = await createClient();
  const { error } = await supabase.from("scheduled_posts").update({ scheduled_at: when.toISOString(), status: "queued" }).eq("id", scheduledId);
  if (error) return { error: error.message };
  await syncSchedule(supabase, contentId);
  await reval(contentId);
  revalidatePath("/dashboard/desk/social");
  return { ok: true };
}

export async function cancelScheduled(scheduledId: string, contentId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.from("scheduled_posts").delete().eq("id", scheduledId);
  if (error) return { error: error.message };
  await syncSchedule(supabase, contentId);
  await reval(contentId);
  revalidatePath("/dashboard/desk/social");
  return { ok: true };
}

/** Publish a scheduled platform now — via Meta if connected, else mark live. */
export async function publishScheduled(scheduledId: string, contentId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: sp } = await supabase.from("scheduled_posts").select("platform, content_id").eq("id", scheduledId).single<{ platform: string; content_id: string }>();
  if (!sp) return { error: "Not found." };
  const { data: variant } = await supabase.from("content_variants").select("body").eq("content_id", sp.content_id).eq("platform", sp.platform).maybeSingle<{ body: string }>();

  const res = await publish(sp.platform, variant?.body ?? "");
  const patch = res.ok
    ? { status: "published", external_id: res.externalId ?? null, published_at: new Date().toISOString() }
    : { status: "published", published_at: new Date().toISOString() }; // manual fallback until Meta connects
  const { error } = await supabase.from("scheduled_posts").update(patch).eq("id", scheduledId);
  if (error) return { error: error.message };
  await syncSchedule(supabase, contentId);
  await reval(contentId);
  revalidatePath("/dashboard/desk/social");
  return { ok: true, message: res.ok ? "Published." : "Marked live (connect Meta for auto-publish)." };
}

// ===========================================================================
// Ownership (Phase 3) — assign a card to a person + set a due date.
// ===========================================================================
import { notifyUsers } from "@/lib/notify";

export async function setOwnership(
  contentId: string,
  assignedTo: string | null,
  dueDate: string | null,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const supabase = await createClient();
  const { data: prev } = await supabase.from("content_items").select("assigned_to, title, workspace_id").eq("id", contentId).single<{ assigned_to: string | null; title: string; workspace_id: string }>();
  const { error } = await supabase.from("content_items").update({ assigned_to: assignedTo, due_date: dueDate || null }).eq("id", contentId);
  if (error) return { error: error.message };
  if (assignedTo && assignedTo !== prev?.assigned_to && assignedTo !== session.userId) {
    await notifyUsers([assignedTo], { workspaceId: prev?.workspace_id, type: "assigned", title: "You were assigned a post", body: prev?.title, link: `/dashboard/content/${contentId}` });
  }
  await reval(contentId);
  return { ok: true, message: "Saved." };
}
