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
import type { Objective, Medium } from "@/lib/mendly/strategy";

export interface PlannedPost {
  day: number; // 1..daysInMonth
  title: string;
  objective: Objective;
  medium: Medium;
  pillar: string | null;
  hook: string;
  rationale: string;
}

export interface PlanResult {
  posts: PlannedPost[];
  provider: "claude" | "stub";
}

const OBJ = new Set(["launch", "educate", "vibe", "urgency"]);
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

  const system = [
    `You are the head of content strategy planning ${MONTHS[opts.month]} ${opts.year} for the brand "${ws.name}".`,
    "Plan a balanced month of social posts. Obey the brand book:",
    ws.voice_tone ? `Voice: ${ws.voice_tone}.` : "",
    ws.do_rules ? `Posts: ${ws.do_rules}.` : "",
    ws.never_rules ? `Never: ${ws.never_rules}.` : "",
    ws.locations ? `Locations: ${ws.locations} — weave in the real festivals, observances and food/health days that matter there this month.` : "",
    "Content pillars to balance across:",
    pillarList,
    opts.goals ? `This month's goals: ${opts.goals}.` : "",
    `Produce exactly ${opts.count} posts spread naturally across the ${daysInMonth} days (favour weekdays, avoid clustering).`,
    "Each post: a real calendar day, a title, an objective (launch|educate|vibe|urgency), a medium (post|reel), the EXACT pillar name it serves (copy it verbatim from the list above, name only — no description), a one-line hook, and a one-line rationale (why this, why now).",
    "Balance objectives and pillars across the month; tie posts to relevant dates where it makes sense.",
    `Return ONLY minified JSON: {"posts":[{"day":1,"title":"…","objective":"educate","medium":"post","pillar":"…","hook":"…","rationale":"…"}]}.`,
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
        const medium = (p.medium === "reel" ? "reel" : "post") as Medium;
        return {
          day,
          title: String(p.title ?? "").trim() || "Untitled post",
          objective,
          medium,
          pillar: p.pillar ? String(p.pillar).trim() : null,
          hook: String(p.hook ?? "").trim(),
          rationale: String(p.rationale ?? "").trim(),
        };
      })
      .filter((p) => p.day >= 1)
      .sort((a, b) => a.day - b.day);
    return { posts, provider: "claude" };
  } catch {
    return { posts: [], provider: "stub" };
  }
}
