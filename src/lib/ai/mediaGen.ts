// ===========================================================================
// AI Media generation — two layers.
//   Layer 1 (Claude): turn a rough idea + the brand book into a precise,
//                     on-brand generation prompt. Always available.
//   Layer 2 (Replicate): render the actual image / video from that prompt.
//                     Gated on REPLICATE_API_TOKEN. Isolated behind this module
//                     so swapping providers is a one-file change.
// ===========================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { Workspace } from "@/lib/types";
import { hasAnthropic } from "@/lib/ai/strategist";

export function hasReplicate(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

// Model IDs are env-overridable so a deprecated model never breaks the desk.
const IMAGE_MODEL = process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-1.1-pro";
const VIDEO_MODEL = process.env.REPLICATE_VIDEO_MODEL || "minimax/video-01";

// ---- Layer 1: on-brand prompt (Claude) ---------------------------------
export interface PromptResult {
  prompt: string;
  negative?: string;
  provider: "claude" | "stub";
}

function brandContext(ws: Workspace): string {
  return [
    `Brand: ${ws.name}.`,
    ws.photography_style ? `Photography / visual style: ${ws.photography_style}.` : "",
    ws.ai_style_suffix ? `Visual keywords: ${ws.ai_style_suffix}.` : "",
    ws.primary_hex ? `Primary colour #${ws.primary_hex}.` : "",
    ws.secondary_hex ? `Secondary colour #${ws.secondary_hex}.` : "",
    ws.accent_hex ? `Accent colour #${ws.accent_hex}.` : "",
    ws.do_rules ? `The brand shows: ${ws.do_rules}.` : "",
    ws.never_rules ? `The brand NEVER shows: ${ws.never_rules}.` : "",
  ].filter(Boolean).join("\n");
}

/** Compose an on-brand image/video prompt from a rough idea. */
export async function buildMediaPrompt(ws: Workspace, idea: string, kind: "image" | "video"): Promise<PromptResult> {
  const fallback = [idea.trim(), ws.photography_style, ws.ai_style_suffix].filter(Boolean).join(", ");
  if (!hasAnthropic()) return { prompt: fallback || idea, provider: "stub" };
  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 600,
      system: [
        `You are an art director writing a single ${kind}-generation prompt for a text-to-${kind} model.`,
        "Ground it strictly in this brand book — style, palette, and rules are non-negotiable:",
        brandContext(ws),
        `Write ONE vivid, concrete ${kind} prompt (${kind === "video" ? "describe motion & a short scene" : "describe the shot, light, composition, lens"}).`,
        'Return ONLY minified JSON: {"prompt":"…","negative":"things to avoid"}.',
      ].join("\n"),
      messages: [{ role: "user", content: `Idea: ${idea}` }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { prompt?: string; negative?: string };
    if (!parsed.prompt) return { prompt: fallback || idea, provider: "stub" };
    return { prompt: parsed.prompt, negative: parsed.negative, provider: "claude" };
  } catch {
    return { prompt: fallback || idea, provider: "stub" };
  }
}

// ---- Layer 2: Replicate rendering --------------------------------------
export interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error?: string | null;
}

async function replicate(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.replicate.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function createPrediction(kind: "image" | "video", input: Record<string, unknown>): Promise<Prediction> {
  const model = kind === "image" ? IMAGE_MODEL : VIDEO_MODEL;
  const res = await replicate(`/models/${model}/predictions`, { method: "POST", body: JSON.stringify({ input }) });
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);
  return (await res.json()) as Prediction;
}

export async function getPrediction(id: string): Promise<Prediction> {
  const res = await replicate(`/predictions/${id}`);
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);
  return (await res.json()) as Prediction;
}

/** Poll a prediction until it's terminal or the timeout elapses. */
export async function pollPrediction(id: string, timeoutMs = 55_000): Promise<Prediction> {
  const start = Date.now();
  let p = await getPrediction(id);
  while (["starting", "processing"].includes(p.status) && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2500));
    p = await getPrediction(id);
  }
  return p;
}

/** First output URL from a prediction, whatever its output shape. */
export function outputUrl(p: Prediction): string | null {
  if (!p.output) return null;
  return Array.isArray(p.output) ? (p.output[0] ?? null) : p.output;
}

export function imageInput(prompt: string, aspect: string, negative?: string): Record<string, unknown> {
  return { prompt, aspect_ratio: aspect, ...(negative ? { negative_prompt: negative } : {}) };
}
export function videoInput(prompt: string): Record<string, unknown> {
  return { prompt };
}
