// ===========================================================================
// AI Month Planner — draft a whole balanced month for a brand.
//
// Grounded in the locked brand book + the brand's content pillars + the real
// cultural moments (festivals / food & health days) for the brand's locations
// in that month. Returns a reviewable draft; nothing is persisted here.
// ===========================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { Workspace } from "@/lib/types";
import { hasAnthropic } from "@/lib/ai/strategist";
import type { Objective } from "@/lib/mendly/strategy";

export type PlanFormat = "post" | "carousel" | "reel" | "story";

/** A planned post is a full creative BRIEF, not just a title — this is what
 *  cascades to every desk so nobody downstream has to re-invent the idea. */
export interface PlannedPost {
  day: number; // 1..daysInMonth
  title: string;
  objective: Objective;
  format: PlanFormat;
  pillar: string | null;
  hook: string;
  angle: string;              // what the post is actually about — the point it makes
  keyMessage: string;         // the single takeaway
  creativeDirection: string;  // what to shoot / design (the direction for Production)
  cta: string;                // the call to action
  platform: string;           // where it runs (e.g. Instagram)
  plan: { purpose: string; note: string }[]; // per-slide/beat/frame plan
  rationale: string;          // why this, why now
}

export interface PlanResult {
  posts: PlannedPost[];
  provider: "claude" | "stub";
  usage?: { input: number; output: number };
}

const OBJ = new Set(["launch", "educate", "vibe", "urgency"]);
const FMT = new Set(["post", "carousel", "reel", "story"]);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export async function planMonth(
  ws: Workspace,
  opts: { year: number; month: number; count: number; pillars: { name: string; description?: string | null }[]; goals?: string; strategy?: string; performance?: string },
): Promise<PlanResult> {
  const daysInMonth = new Date(opts.year, opts.month + 1, 0).getDate();
  if (!hasAnthropic()) return { posts: [], provider: "stub" };

  const pillarList = opts.pillars.length
    ? opts.pillars.map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n")
    : "(no pillars defined — infer 3–4 sensible themes from the brand)";

  const subject = ws.subject ? `They make ${ws.subject}.` : "";
  const system = [
    `You are the head of content strategy planning ${MONTHS[opts.month]} ${opts.year} for the brand "${ws.name}". ${subject}`,
    "Plan a balanced, deliberate month. For EACH post write a complete creative brief AND a per-format plan the content and video teams can execute without guessing. Obey the brand book:",
    ws.voice_tone ? `Voice: ${ws.voice_tone}.` : "",
    ws.do_rules ? `Posts: ${ws.do_rules}.` : "",
    ws.never_rules ? `Never: ${ws.never_rules}.` : "",
    ws.locations ? `Locations: ${ws.locations} — weave in the real festivals, observances and food/health days that matter there this month.` : "",
    "Content pillars to balance across:",
    pillarList,
    opts.strategy ? `THIS MONTH'S MARKETING STRATEGY (follow it closely):\n${opts.strategy}` : "",
    opts.goals ? `Goals: ${opts.goals}.` : "",
    opts.performance ? `What performed recently (double down on what works):\n${opts.performance}` : "",
    `Produce exactly ${opts.count} posts spread naturally across the ${daysInMonth} days (favour weekdays, avoid clustering; don't put the same format twice in a row).`,
    "For each post provide:",
    "- day, title",
    "- objective: launch | educate | vibe | urgency",
    "- format: post | carousel | reel | story — CHOOSE deliberately (reels for motion/hooks, carousels for step-by-step or story, posts for a single strong image, stories for quick/interactive)",
    "- pillar: the EXACT pillar name from the list above (name only, verbatim)",
    "- hook, angle (the specific point), keyMessage (the one takeaway)",
    "- creativeDirection: concrete direction for what to SHOOT or DESIGN so Production knows exactly what to make",
    "- cta, platform (default Instagram), rationale (why now)",
    "- plan: an ARRAY describing the structure — for a carousel one entry per slide, for a reel one per beat, for a story one per frame, for a post one entry. Each entry: {\"purpose\":\"Hook|Point|Proof|CTA|Build|Payoff|…\",\"note\":\"what it says + what it looks like\"}. Order matters (slide 1 = hook, last = CTA).",
    "Balance objectives, formats and pillars; tie posts to relevant dates.",
    `Return ONLY minified JSON: {"posts":[{"day":1,"title":"…","objective":"educate","format":"carousel","pillar":"…","hook":"…","angle":"…","keyMessage":"…","creativeDirection":"…","cta":"…","platform":"Instagram","plan":[{"purpose":"Hook","note":"…"}],"rationale":"…"}]}.`,
  ].filter(Boolean).join("\n");

  try {
    const client = new Anthropic();
    // Fable 5 (most capable; thinking always on). Streamed so the longer reasoning
    // doesn't hit request timeouts.
    const stream = client.messages.stream({
      model: "claude-fable-5",
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: `Plan ${opts.count} posts for ${MONTHS[opts.month]} ${opts.year}. Follow the strategy.` }],
    });
    const msg = await stream.finalMessage();
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { posts?: unknown[] };
    const posts: PlannedPost[] = (parsed.posts ?? [])
      .map((raw) => {
        const p = raw as Record<string, unknown>;
        const day = Math.max(1, Math.min(daysInMonth, Math.round(Number(p.day) || 0)));
        const objective = (OBJ.has(String(p.objective)) ? p.objective : "educate") as Objective;
        const format = (FMT.has(String(p.format)) ? p.format : p.medium === "reel" ? "reel" : "post") as PlanFormat;
        const s = (v: unknown) => String(v ?? "").trim();
        const plan = Array.isArray(p.plan)
          ? (p.plan as unknown[]).map((r) => { const x = r as Record<string, unknown>; return { purpose: s(x.purpose), note: s(x.note) }; }).filter((r) => r.purpose || r.note)
          : [];
        return {
          day,
          title: s(p.title) || "Untitled post",
          objective,
          format,
          pillar: p.pillar ? s(p.pillar) : null,
          hook: s(p.hook),
          angle: s(p.angle),
          keyMessage: s(p.keyMessage),
          creativeDirection: s(p.creativeDirection),
          cta: s(p.cta),
          platform: s(p.platform) || "Instagram",
          plan,
          rationale: s(p.rationale),
        };
      })
      .filter((p) => p.day >= 1)
      .sort((a, b) => a.day - b.day);
    return { posts, provider: "claude", usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens } };
  } catch {
    return { posts: [], provider: "stub" };
  }
}
