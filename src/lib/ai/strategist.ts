// ===========================================================================
// AI Employee: The Strategist / Copy desk (Mendly Stages 04–05)
//
// Reads the workspace's Brand DNA (the constitution) and drafts the three-tier
// copy framework (deck page 9): Hook → Value bridge → Frictionless CTA.
//
// The brand-rule injection is REAL: every draft is grounded in the locked voice,
// do/never rules, and objective — the desk never invents on the fly. The model
// call is gated on ANTHROPIC_API_KEY; without a key a deterministic stub keeps
// the whole flow exercisable. Swap nothing at the call sites when a key lands.
// ===========================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { Workspace } from "@/lib/types";
import type { FormatDecision } from "@/lib/mendly/strategy";

export interface CopyDraft {
  hook: string; // Tier 1 — one punchy line that stops the scroll
  valueBridge: string; // Tier 2 — taste/sourcing/experience in two sentences
  cta: string; // Tier 3 — one clear directive
  provider: string; // "claude" | "stub"
  model?: string;
  usage?: { input: number; output: number };
}

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** The Brand DNA, compiled into the system prompt every desk builds from. */
function brandSystemPrompt(ws: Workspace): string {
  return [
    `You are the Mendly Labs copy desk writing for the brand "${ws.name}".`,
    `Everything you write MUST obey this brand book — never invent off-brand.`,
    ws.voice_tone ? `Voice & tone: ${ws.voice_tone}` : "",
    ws.voice_never ? `Never use: ${ws.voice_never}` : "",
    ws.do_rules ? `The brand posts: ${ws.do_rules}` : "",
    ws.never_rules ? `The brand would never post: ${ws.never_rules}` : "",
    ws.locations ? `Locations: ${ws.locations}` : "",
    `Rules: no unsupported claims, no competitor bashing, no hype words or emoji spam.`,
    `Return ONLY minified JSON: {"hook": "...", "valueBridge": "...", "cta": "..."}.`,
    `hook = one scroll-stopping line. valueBridge = 2 sentences on taste/sourcing/experience. cta = one clear directive.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function userPrompt(brief: string, decision: FormatDecision, tone?: string | null): string {
  return [
    `Objective: ${decision.goal}.`,
    `Chosen format: ${decision.formatType} (${decision.medium}).`,
    `Brief from the client: ${brief}`,
    tone?.trim() ? `Lean into this tone/angle for this pass: ${tone.trim()}.` : "",
    `Write the three-tier copy for this asset.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function stubDraft(brief: string, decision: FormatDecision): CopyDraft {
  const subject = brief.trim() || decision.goal;
  return {
    hook: `${subject} — the one your regulars will screenshot.`,
    valueBridge: `Built the Mendly way: ${decision.formatType.toLowerCase()}. On-brand voice, brand book obeyed, nothing invented on the fly.`,
    cta: "Directions pinned in bio.",
    provider: "stub",
  };
}

/** An optional AI persona (a department's tuned "brain") layered onto a draft. */
export interface Persona {
  personality: string;
  guidance?: string | null;
  model?: string | null;
}

/**
 * Compose the system prompt: the persona's stance FIRST (how to think & write),
 * then the brand book (the non-negotiable rules + output format), then any extra
 * direction. The brand book always wins — the persona shapes tone, not truth.
 */
function composeSystem(ws: Workspace, persona?: Persona | null): string {
  const parts: string[] = [];
  if (persona?.personality?.trim()) parts.push(persona.personality.trim());
  parts.push(brandSystemPrompt(ws));
  if (persona?.guidance?.trim()) parts.push(`Extra direction: ${persona.guidance.trim()}`);
  return parts.join("\n\n");
}

export async function draftCopy(
  ws: Workspace,
  brief: string,
  decision: FormatDecision,
  persona?: Persona | null,
  tone?: string | null,
): Promise<CopyDraft> {
  if (!hasAnthropic()) return stubDraft(brief, decision);

  try {
    const client = new Anthropic();
    const model = persona?.model?.trim() || "claude-opus-4-8";
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: composeSystem(ws, persona),
      messages: [{ role: "user", content: userPrompt(brief, decision, tone) }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    // The model returns JSON; pull the object out defensively.
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as Partial<CopyDraft>;
    if (!parsed.hook || !parsed.valueBridge || !parsed.cta) {
      return stubDraft(brief, decision);
    }
    return {
      hook: parsed.hook,
      valueBridge: parsed.valueBridge,
      cta: parsed.cta,
      provider: "claude",
      model,
      usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
    };
  } catch {
    // Any failure (no network, bad key, parse) degrades to the stub so the
    // pipeline never blocks on the AI desk.
    return stubDraft(brief, decision);
  }
}
