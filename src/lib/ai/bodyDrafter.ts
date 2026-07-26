// ===========================================================================
// Format-aware draft — turns Strategy's brief into a complete, format-shaped
// content body: a reel becomes a beat sheet, a carousel becomes slides, a post
// becomes a caption. Grounded in the brand voice + the strategic brief so the
// creator never faces a blank post.
// ===========================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { Workspace, ContentBody, ContentFormat, ReelBody, CarouselBody, StoryBody, PostBody } from "@/lib/types";
import { hasAnthropic } from "@/lib/ai/strategist";

export interface DraftBrief {
  title: string;
  objective?: string | null;
  angle?: string | null;
  keyMessage?: string | null;
  creativeDirection?: string | null;
  cta?: string | null;
  platform?: string | null;
  hook?: string | null;
}

const SHAPE: Record<ContentFormat, string> = {
  post: `{"hook":"one scroll-stopping line","body":"the value/proof, 1-2 sentences","cta":"one directive","caption":"the full caption","hashtags":["#tag"]}`,
  carousel: `{"slides":[{"heading":"slide title","body":"slide text"}],"caption":"the full caption","hashtags":["#tag"]}`,
  reel: `{"hook_text":"on-screen hook (0-3s)","beats":[{"time":"0-3s","scene":"what's shown","on_screen":"on-screen text","voiceover":"what's said"}],"audio":"suggested audio style","duration_sec":15,"caption":"short caption","hashtags":["#tag"]}`,
  story: `{"frames":[{"text":"short frame text","sticker":"poll/quiz/link idea"}],"link":""}`,
};

const GUIDE: Record<ContentFormat, string> = {
  post: "Write a single feed post: a strong hook, a value body, a clear CTA, then a full caption that ties them together.",
  carousel: "Write 5–7 slides: slide 1 is the hook, the middle slides carry the story/steps, the last slide is the CTA. Then one caption.",
  reel: "Write a reel SCRIPT: an on-screen hook for the first 3 seconds, then 4–6 beats (each = time · what's shown · on-screen text · voiceover). Follow the creative direction for what to shoot. Suggest an audio style + a target duration. Then a short hook-led caption.",
  story: "Write 3–5 quick story frames (very short text) with an interactive sticker idea per frame, and a link if useful.",
};

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => s(x).replace(/^#/, "")).filter(Boolean).map((x) => `#${x}`) : []);

/* eslint-disable @typescript-eslint/no-explicit-any */
function coerce(format: ContentFormat, raw: any): ContentBody {
  if (format === "carousel") {
    const b: CarouselBody = {
      slides: Array.isArray(raw.slides) ? raw.slides.map((x: any) => ({ heading: s(x?.heading), body: s(x?.body) })).filter((x: any) => x.heading || x.body) : [],
      caption: s(raw.caption), hashtags: arr(raw.hashtags),
    };
    return b;
  }
  if (format === "reel") {
    const b: ReelBody = {
      hook_text: s(raw.hook_text),
      beats: Array.isArray(raw.beats) ? raw.beats.map((x: any) => ({ time: s(x?.time), scene: s(x?.scene), on_screen: s(x?.on_screen), voiceover: s(x?.voiceover) })).filter((x: any) => x.scene || x.on_screen || x.voiceover) : [],
      audio: s(raw.audio), duration_sec: Number(raw.duration_sec) || undefined, caption: s(raw.caption), hashtags: arr(raw.hashtags),
    };
    return b;
  }
  if (format === "story") {
    const b: StoryBody = {
      frames: Array.isArray(raw.frames) ? raw.frames.map((x: any) => ({ text: s(x?.text), sticker: s(x?.sticker) })).filter((x: any) => x.text || x.sticker) : [],
      link: s(raw.link),
    };
    return b;
  }
  const b: PostBody = { hook: s(raw.hook), body: s(raw.body), cta: s(raw.cta), caption: s(raw.caption), hashtags: arr(raw.hashtags) };
  return b;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function draftBody(ws: Workspace, format: ContentFormat, brief: DraftBrief, tone?: string): Promise<ContentBody | null> {
  if (!hasAnthropic()) return null;
  const facts = [
    `Brand: ${ws.name}.`,
    ws.subject ? `They make ${ws.subject}.` : "",
    ws.voice_tone ? `Voice: ${ws.voice_tone}.` : "",
    ws.never_rules ? `Never: ${ws.never_rules}.` : "",
    ws.voice_never ? `Never say: ${ws.voice_never}.` : "",
  ].filter(Boolean).join(" ");

  const briefText = [
    `Title: ${brief.title}`,
    brief.objective && `Objective: ${brief.objective}`,
    brief.angle && `Angle: ${brief.angle}`,
    brief.keyMessage && `Key message: ${brief.keyMessage}`,
    brief.creativeDirection && `Creative direction (what to shoot/design): ${brief.creativeDirection}`,
    brief.cta && `CTA: ${brief.cta}`,
    brief.platform && `Platform: ${brief.platform}`,
    brief.hook && `Starter hook: ${brief.hook}`,
    tone && `Tone: ${tone}`,
  ].filter(Boolean).join("\n");

  const system = [
    `You are an expert social copywriter for ${ws.name}. ${facts}`,
    GUIDE[format],
    "Stay on brand voice and never contradict the brief. Be specific and punchy.",
    `Return ONLY minified JSON matching exactly this shape (no prose): ${SHAPE[format]}`,
  ].join("\n");

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: `Write the ${format} for this brief:\n${briefText}` }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return coerce(format, parsed);
  } catch {
    return null;
  }
}
