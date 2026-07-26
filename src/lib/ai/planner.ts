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
  rationale: string;          // why this, why now
}

export interface PlanResult {
  posts: PlannedPost[];
  provider: "claude" | "stub";
}

const OBJ = new Set(["launch", "educate", "vibe", "urgency"]);
const FMT = new Set(["post", "carousel", "reel", "story"]);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export async function planMonth(
  ws: Workspace,
  opts: { year: number; month: number; count: number; pillars: { name: string; description?: string | null }[]; goals?: string },
): Promise<PlanResult> {
  const daysInMonth = new Date(opts.year, opts.month + 1, 0).getDate();
  if (!hasAnthropic()) return { posts: [], provider: "stub" };

  const pillarList = opts.pillars.length
    ? opts.pillars.map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n")
    : "(no pillars defined — infer 3–4 sensible themes from the brand)";

  const subject = ws.subject ? `They make ${ws.subject}.` : "";
  const system = [
    `You are the head of content strategy planning ${MONTHS[opts.month]} ${opts.year} for the brand "${ws.name}". ${subject}`,
    "Plan a balanced month of social posts. For EACH post write a complete creative brief the content and video teams can execute without guessing. Obey the brand book:",
    ws.voice_tone ? `Voice: ${ws.voice_tone}.` : "",
    ws.do_rules ? `Posts: ${ws.do_rules}.` : "",
    ws.never_rules ? `Never: ${ws.never_rules}.` : "",
    ws.locations ? `Locations: ${ws.locations} — weave in the real festivals, observances and food/health days that matter there this month.` : "",
    "Content pillars to balance across:",
    pillarList,
    opts.goals ? `This month's goals: ${opts.goals}.` : "",
    `Produce exactly ${opts.count} posts spread naturally across the ${daysInMonth} days (favour weekdays, avoid clustering; don't put the same format twice in a row).`,
    "For each post provide:",
    "- day: a real calendar day",
    "- title: a short working title",
    "- objective: launch | educate | vibe | urgency",
    "- format: post | carousel | reel | story — CHOOSE deliberately (reels for motion/hooks, carousels for step-by-step or story, posts for a single strong image, stories for quick/interactive)",
    "- pillar: the EXACT pillar name from the list above (name only, verbatim)",
    "- hook: one scroll-stopping opening line",
    "- angle: what this post is actually about — the specific point it makes (1 sentence)",
    "- keyMessage: the single takeaway the viewer should remember",
    "- creativeDirection: concrete direction for what to SHOOT or DESIGN (e.g. 'macro pour of the salt crystals in raking light; hands only') so the video/design team knows exactly what to make",
    "- cta: the call to action",
    "- platform: the primary platform (default Instagram)",
    "- rationale: why this, why now (1 line)",
    "Balance objectives, formats and pillars across the month; tie posts to relevant dates where it makes sense.",
    `Return ONLY minified JSON: {"posts":[{"day":1,"title":"…","objective":"educate","format":"carousel","pillar":"…","hook":"…","angle":"…","keyMessage":"…","creativeDirection":"…","cta":"…","platform":"Instagram","rationale":"…"}]}.`,
  ].filter(Boolean).join("\n");

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: `Plan ${opts.count} posts for ${MONTHS[opts.month]} ${opts.year}.` }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { posts?: unknown[] };
    const posts: PlannedPost[] = (parsed.posts ?? [])
      .map((raw) => {
        const p = raw as Record<string, unknown>;
        const day = Math.max(1, Math.min(daysInMonth, Math.round(Number(p.day) || 0)));
        const objective = (OBJ.has(String(p.objective)) ? p.objective : "educate") as Objective;
        const format = (FMT.has(String(p.format)) ? p.format : p.medium === "reel" ? "reel" : "post") as PlanFormat;
        const s = (v: unknown) => String(v ?? "").trim();
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
          rationale: s(p.rationale),
        };
      })
      .filter((p) => p.day >= 1)
      .sort((a, b) => a.day - b.day);
    return { posts, provider: "claude" };
  } catch {
    return { posts: [], provider: "stub" };
  }
}
