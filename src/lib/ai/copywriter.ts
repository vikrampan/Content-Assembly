// ===========================================================================
// The Content desk's AI copywriter — hooks, trigger-engineering, voice lint,
// and per-platform variants. All grounded in the locked brand book. Gated on
// ANTHROPIC_API_KEY; returns safe fallbacks without a key.
// ===========================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { ContentItem, HookCandidate, VoiceFlags, Workspace } from "@/lib/types";
import { hasAnthropic } from "@/lib/ai/strategist";
import { DEVICE_MAP, FRAMEWORK_MAP, HOOK_MAP, TRIGGER_MAP, labelOf } from "@/lib/mendly/copy";

function brandContext(ws: Workspace): string {
  return [
    `Brand: ${ws.name}.`,
    ws.voice_tone ? `Voice & tone: ${ws.voice_tone}.` : "",
    ws.voice_never ? `NEVER use these words/phrases: ${ws.voice_never}.` : "",
    ws.do_rules ? `The brand posts: ${ws.do_rules}.` : "",
    ws.never_rules ? `The brand would never post: ${ws.never_rules}.` : "",
    ws.brand_book?.voice?.attributes?.length ? `Voice attributes: ${ws.brand_book.voice.attributes.join(", ")}.` : "",
    ws.brand_book?.voice?.mechanics ? `Mechanics: ${ws.brand_book.voice.mechanics}.` : "",
    ws.brand_book?.social?.emoji_policy ? `Emoji policy: ${ws.brand_book.social.emoji_policy}.` : "",
  ].filter(Boolean).join("\n");
}

function subject(item: ContentItem): string {
  const brief = item.brief && typeof item.brief === "object" && "message" in item.brief ? String((item.brief as Record<string, unknown>).message ?? "") : "";
  return [
    `Title: ${item.title}.`,
    item.hook ? `Current hook: ${item.hook}.` : "",
    item.educational_shift ? `Value: ${item.educational_shift}.` : "",
    item.solution ? `CTA: ${item.solution}.` : "",
    brief ? `Brief: ${brief}.` : "",
    item.objective ? `Objective: ${item.objective}.` : "",
    item.format_type ? `Format: ${item.format_type}.` : "",
  ].filter(Boolean).join("\n");
}

function client() { return new Anthropic(); }
function jsonOf(text: string) { return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }
function textOf(msg: Anthropic.Message) { return msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim(); }

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/** Generate scored hook candidates using a chosen formula. */
export async function generateHooks(ws: Workspace, item: ContentItem, formulaKey: string, count = 6): Promise<HookCandidate[]> {
  if (!hasAnthropic()) return [];
  const formula = HOOK_MAP[formulaKey];
  try {
    const msg = await client().messages.create({
      model: "claude-opus-4-8", max_tokens: 1500, thinking: { type: "adaptive" },
      system: [
        "You are a world-class social copywriter engineering scroll-stopping hooks.",
        "Stay strictly on-brand:", brandContext(ws),
        formula ? `Use the "${formula.label}" hook formula — ${formula.hint}` : "Use a mix of the strongest hook formulas.",
        `Write ${count} distinct hooks (one line each). For each, score 0-100 on: stop (scroll-stopping power), curiosity, clarity, fit (brand fit).`,
        'Return ONLY minified JSON: {"hooks":[{"text":"…","stop":90,"curiosity":85,"clarity":80,"fit":88}]}.',
      ].join("\n"),
      messages: [{ role: "user", content: subject(item) }],
    });
    const parsed = jsonOf(textOf(msg)) as { hooks?: Record<string, unknown>[] };
    return (parsed.hooks ?? []).filter((h) => h.text).map((h) => ({
      text: String(h.text).trim(),
      formula: formulaKey || "mix",
      score: { stop: clamp(h.stop), curiosity: clamp(h.curiosity), clarity: clamp(h.clarity), fit: clamp(h.fit) },
    }));
  } catch { return []; }
}

/** Re-engineer the three-tier copy with triggers + framework + devices. */
export async function engineerCopy(
  ws: Workspace, item: ContentItem,
  opts: { triggers: string[]; framework: string | null; devices: string[]; tone?: string | null },
): Promise<{ hook: string; valueBridge: string; cta: string } | null> {
  if (!hasAnthropic()) return null;
  const triggers = opts.triggers.map((t) => labelOf(TRIGGER_MAP, t));
  const devices = opts.devices.map((d) => `${labelOf(DEVICE_MAP, d)} (${DEVICE_MAP[d]?.hint ?? ""})`);
  const fw = opts.framework ? FRAMEWORK_MAP[opts.framework] : null;
  try {
    const msg = await client().messages.create({
      model: "claude-opus-4-8", max_tokens: 1024, thinking: { type: "adaptive" },
      system: [
        "You are a conversion copywriter. Rewrite the three-tier copy (hook, value bridge, CTA), staying on-brand:",
        brandContext(ws),
        fw ? `Structure it with the ${fw.label} framework: ${fw.hint}` : "",
        triggers.length ? `Weave in these psychological triggers naturally (don't name them): ${triggers.join(", ")}.` : "",
        devices.length ? `Use these engagement devices: ${devices.join("; ")}.` : "",
        opts.tone?.trim() ? `Tone/angle: ${opts.tone.trim()}.` : "",
        "Keep it tasteful and true to the brand — never spammy or clickbait that betrays the voice.",
        'Return ONLY minified JSON: {"hook":"…","valueBridge":"…","cta":"…"}.',
      ].filter(Boolean).join("\n"),
      messages: [{ role: "user", content: subject(item) }],
    });
    const p = jsonOf(textOf(msg)) as { hook?: string; valueBridge?: string; cta?: string };
    if (!p.hook && !p.valueBridge && !p.cta) return null;
    return { hook: p.hook ?? item.hook ?? "", valueBridge: p.valueBridge ?? item.educational_shift ?? "", cta: p.cta ?? item.solution ?? "" };
  } catch { return null; }
}

/** Lint the copy against the brand voice — a score + specific issues. */
export async function lintVoice(ws: Workspace, item: ContentItem): Promise<VoiceFlags> {
  const copy = [item.hook, item.educational_shift, item.solution].filter(Boolean).join("\n");
  // Deterministic pass: exact "never" words always flagged.
  const issues: { term: string; why: string }[] = [];
  const never = (ws.voice_never ?? "").split(/[,;\n]/).map((s) => s.trim()).filter((s) => s.length > 2);
  const low = copy.toLowerCase();
  for (const term of never) if (low.includes(term.toLowerCase())) issues.push({ term, why: "On the brand's never-use list." });

  if (!hasAnthropic() || !copy.trim()) {
    const score = Math.max(0, 100 - issues.length * 25);
    return { score, issues };
  }
  try {
    const msg = await client().messages.create({
      model: "claude-opus-4-8", max_tokens: 800,
      system: [
        "You are a brand-voice QA reviewer. Judge whether the copy matches this brand's voice and rules:",
        brandContext(ws),
        "Score 0-100 for brand-voice fit. List concrete issues (word/phrase + why it's off-brand). Be strict but fair.",
        'Return ONLY minified JSON: {"score":85,"issues":[{"term":"…","why":"…"}]}.',
      ].join("\n"),
      messages: [{ role: "user", content: copy }],
    });
    const p = jsonOf(textOf(msg)) as { score?: number; issues?: { term: string; why: string }[] };
    const aiIssues = Array.isArray(p.issues) ? p.issues.filter((i) => i?.term) : [];
    const merged = [...issues, ...aiIssues.filter((a) => !issues.some((i) => i.term.toLowerCase() === String(a.term).toLowerCase()))];
    return { score: clamp(p.score ?? (100 - merged.length * 15)), issues: merged };
  } catch {
    return { score: Math.max(0, 100 - issues.length * 25), issues };
  }
}

/** Produce a platform-native variant of the post. */
export async function generateVariant(ws: Workspace, item: ContentItem, platform: string, platformHint: string): Promise<string | null> {
  if (!hasAnthropic()) return null;
  try {
    const msg = await client().messages.create({
      model: "claude-opus-4-8", max_tokens: 1024, thinking: { type: "adaptive" },
      system: [
        `You are adapting one post for ${platform}. Platform norms: ${platformHint}`,
        "Stay on-brand:", brandContext(ws),
        "Rewrite the full post natively for this platform (not a copy-paste). Return ONLY the post text, no preamble.",
      ].join("\n"),
      messages: [{ role: "user", content: subject(item) }],
    });
    return textOf(msg) || null;
  } catch { return null; }
}
