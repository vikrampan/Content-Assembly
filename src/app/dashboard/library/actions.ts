"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { userFunction } from "@/lib/mendly/access";
import Anthropic from "@anthropic-ai/sdk";
import type { Workspace } from "@/lib/types";
import { hasAnthropic } from "@/lib/ai/strategist";
import {
  buildMediaPrompt, createPrediction, getPrediction, hasReplicate, imageInput,
  outputUrl, pollPrediction, videoInput,
} from "@/lib/ai/mediaGen";

type Result<T = unknown> = ({ ok: true } & T) | { error: string };

async function requireCapture() {
  const session = await requireSession();
  const fn = userFunction(session.profile);
  if (fn === "client") throw new Error("Not authorized.");
  return session;
}

const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};

/** Download a rendered asset from the provider and store it privately. */
async function storeRemote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  url: string,
): Promise<{ path: string; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch rendered media failed (${res.status}).`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = EXT[contentType] ?? (contentType.startsWith("video") ? "mp4" : "png");
  const path = `${workspaceId}/gen-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("assets").upload(path, buf, { contentType });
  if (error) throw new Error(error.message);
  return { path, contentType };
}

/** Layer 1 — compose an on-brand generation prompt from a rough idea. */
export async function composePrompt(
  workspaceId: string,
  idea: string,
  kind: "image" | "video",
): Promise<Result<{ prompt: string; negative?: string; provider: string }>> {
  await requireCapture();
  if (!idea.trim()) return { error: "Describe what you want first." };
  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single<Workspace>();
  if (!ws) return { error: "Brand not found." };
  const r = await buildMediaPrompt(ws, idea, kind);
  return { ok: true, prompt: r.prompt, negative: r.negative, provider: r.provider };
}

/** Layer 2 — render the media on Replicate and file it in the library. */
export async function renderMedia(input: {
  workspaceId: string;
  prompt: string;
  negative?: string;
  kind: "image" | "video";
  aspect: string;
  collection?: string;
}): Promise<Result<{ pending?: boolean; assetId?: string }>> {
  const session = await requireCapture();
  if (!input.prompt.trim()) return { error: "Prompt is empty." };
  if (!hasReplicate()) return { error: "Add REPLICATE_API_TOKEN on the server to render. The on-brand prompt above is ready to use." };

  const supabase = await createClient();
  try {
    const pred = await createPrediction(
      input.kind,
      input.kind === "image" ? imageInput(input.prompt, input.aspect, input.negative) : videoInput(input.prompt),
    );

    const base = {
      workspace_id: input.workspaceId,
      kind: "generated" as const,
      prompt: input.prompt,
      gen_provider: "replicate",
      collection: input.collection?.trim() || "AI Generated",
      uploaded_by: session.userId,
    };

    if (input.kind === "image") {
      const done = await pollPrediction(pred.id);
      const url = outputUrl(done);
      if (done.status !== "succeeded" || !url) return { error: done.error || "Generation failed." };
      const { path } = await storeRemote(supabase, input.workspaceId, url);
      const { data, error } = await supabase.from("assets").insert({ ...base, storage_path: path, label: input.prompt.slice(0, 60), gen_status: "ready" }).select("id").single();
      if (error) return { error: error.message };
      revalidatePath("/dashboard/library");
      return { ok: true, assetId: (data as { id: string }).id };
    }

    // Video is slow → store a pending placeholder + prediction id, poll later.
    const { data, error } = await supabase.from("assets").insert({
      ...base, storage_path: `pending/${pred.id}`, label: input.prompt.slice(0, 60), gen_status: "pending", gen_ref: pred.id,
    }).select("id").single();
    if (error) return { error: error.message };
    revalidatePath("/dashboard/library");
    return { ok: true, pending: true, assetId: (data as { id: string }).id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Generation failed." };
  }
}

/** Poll a pending video generation; when ready, store it and flip to ready. */
export async function checkGeneration(assetId: string): Promise<Result<{ status: string }>> {
  await requireCapture();
  const supabase = await createClient();
  const { data: a } = await supabase.from("assets").select("id, workspace_id, gen_ref, gen_status").eq("id", assetId).single<{ id: string; workspace_id: string; gen_ref: string | null; gen_status: string }>();
  if (!a) return { error: "Not found." };
  if (a.gen_status !== "pending" || !a.gen_ref) return { ok: true, status: a.gen_status };
  try {
    const pred = await getPrediction(a.gen_ref);
    if (pred.status === "succeeded") {
      const url = outputUrl(pred);
      if (!url) { await supabase.from("assets").update({ gen_status: "failed" }).eq("id", assetId); return { ok: true, status: "failed" }; }
      const { path } = await storeRemote(supabase, a.workspace_id, url);
      await supabase.from("assets").update({ storage_path: path, gen_status: "ready" }).eq("id", assetId);
      revalidatePath("/dashboard/library");
      return { ok: true, status: "ready" };
    }
    if (pred.status === "failed" || pred.status === "canceled") {
      await supabase.from("assets").update({ gen_status: "failed" }).eq("id", assetId);
      return { ok: true, status: "failed" };
    }
    return { ok: true, status: "pending" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Check failed." };
  }
}

/** AI capture brief — a directed shot list grounded in the brand book. */
export async function generateShotList(workspaceId: string, focus: string): Promise<Result> {
  const session = await requireCapture();
  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single<Workspace>();
  if (!ws) return { error: "Brand not found." };

  let shots: { shot: string; note?: string }[] = [];
  let title = focus.trim() || `${ws.name} shoot`;
  if (hasAnthropic()) {
    try {
      const client = new Anthropic();
      const msg = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1200,
        system: [
          `You are a photo/video director planning a shoot for "${ws.name}".`,
          ws.photography_style ? `Photography style: ${ws.photography_style}.` : "",
          ws.do_rules ? `Show: ${ws.do_rules}.` : "",
          ws.never_rules ? `Never show: ${ws.never_rules}.` : "",
          "Produce a concrete, directed shot list (8–12 shots). Each shot has a crisp direction and an optional note (lens/light/framing).",
          'Return ONLY minified JSON: {"title":"…","shots":[{"shot":"…","note":"…"}]}.',
        ].filter(Boolean).join("\n"),
        messages: [{ role: "user", content: `Focus for this shoot: ${focus || "a general brand shoot"}` }],
      });
      const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
      const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { title?: string; shots?: { shot: string; note?: string }[] };
      if (parsed.title) title = parsed.title;
      if (Array.isArray(parsed.shots)) shots = parsed.shots.filter((s) => s?.shot);
    } catch { /* fall through to empty */ }
  }
  if (shots.length === 0) return { error: hasAnthropic() ? "Could not draft a shot list — try again." : "Add ANTHROPIC_API_KEY to auto-draft shot lists." };

  const { error } = await supabase.from("capture_briefs").insert({
    workspace_id: workspaceId, title, focus: focus.trim() || null, shots, created_by: session.userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/library");
  return { ok: true };
}

/** Toggle a shot done / update a brief's shot list. */
export async function updateBriefShots(briefId: string, shots: { shot: string; note?: string; done?: boolean }[]): Promise<Result> {
  await requireCapture();
  const supabase = await createClient();
  const { error } = await supabase.from("capture_briefs").update({ shots }).eq("id", briefId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/library");
  return { ok: true };
}

export async function deleteBrief(briefId: string): Promise<Result> {
  await requireCapture();
  const supabase = await createClient();
  const { error } = await supabase.from("capture_briefs").delete().eq("id", briefId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/library");
  return { ok: true };
}

/** Delete a library asset — but keep the stored file if another row still uses it. */
export async function deleteLibraryAsset(assetId: string): Promise<Result> {
  await requireCapture();
  const supabase = await createClient();
  const { data: a } = await supabase.from("assets").select("id, storage_path").eq("id", assetId).single<{ id: string; storage_path: string }>();
  if (!a) return { error: "Not found." };
  const { count } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("storage_path", a.storage_path);
  await supabase.from("assets").delete().eq("id", assetId);
  if ((count ?? 0) <= 1 && !a.storage_path.startsWith("pending/")) {
    await supabase.storage.from("assets").remove([a.storage_path]);
  }
  revalidatePath("/dashboard/library");
  return { ok: true };
}
