"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decideFormat, type Medium, type Objective } from "@/lib/mendly/strategy";
import { draftCopy, hasAnthropic } from "@/lib/ai/strategist";
import { estimateCost, monthStartISO } from "@/lib/ai/usage";
import type { Workspace } from "@/lib/types";
import Anthropic from "@anthropic-ai/sdk";

type Db = Awaited<ReturnType<typeof createClient>>;

/** A short summary of what performed recently — grounds the planner + audit. */
async function recentPerformance(supabase: Db, workspaceId: string): Promise<string> {
  try {
    const { data: posts } = await supabase.from("content_items").select("id, title, format, objective").eq("workspace_id", workspaceId).in("stage", ["scheduling", "published"]).limit(120);
    const list = (posts as { id: string; title: string; format: string; objective: string | null }[]) ?? [];
    if (!list.length) return "";
    const { data: metrics } = await supabase.from("post_metrics").select("content_id, reach, engagement").in("content_id", list.map((p) => p.id));
    const m = (metrics as { content_id: string; reach: number; engagement: number }[]) ?? [];
    if (!m.length) return "";
    const meta = new Map(list.map((p) => [p.id, p]));
    const agg = new Map<string, { reach: number; eng: number }>();
    for (const x of m) { const c = agg.get(x.content_id) ?? { reach: 0, eng: 0 }; c.reach += x.reach; c.eng += x.engagement; agg.set(x.content_id, c); }
    return [...agg.entries()].map(([id, v]) => ({ ...meta.get(id)!, ...v })).sort((a, b) => b.reach - a.reach).slice(0, 6)
      .map((r) => `"${r.title}" (${r.format}/${r.objective}): reach ${r.reach}, engagements ${r.eng}`).join("\n");
  } catch { return ""; }
}

async function logAiUsage(supabase: Db, userId: string, workspaceId: string, purpose: string, usage: { input: number; output: number }) {
  try {
    await supabase.from("ai_usage").insert({
      user_id: userId, workspace_id: workspaceId, purpose, provider: "anthropic", model: "claude-fable-5",
      input_tokens: usage.input, output_tokens: usage.output, cost_usd: estimateCost("claude-fable-5", usage.input, usage.output),
    });
  } catch { /* metering is best-effort */ }
}

export interface StrategyResult {
  ok: true;
  contentId: string;
  title: string;
  objective: Objective;
  medium: Medium;
  formatType: string;
  rationale: string;
  hook: string;
  valueBridge: string;
  cta: string;
  provider: string;
}
export type StrategyActionResult = StrategyResult | { error: string };

/**
 * Run a brief through the Strategy Desk (Stage 04):
 *   1. Decide the format deterministically (objective → format, never by taste).
 *   2. The AI Strategist drafts the three-tier copy, grounded in Brand DNA.
 *   3. Persist a content item at the "research" status — a Draft entering the
 *      human-in-the-loop pipeline. RLS (is_team_member_of) is the boundary.
 */
export async function runStrategyDesk(input: {
  workspaceId: string;
  objective: Objective;
  medium: Medium;
  brief: string;
  title: string;
  personaId?: string | null;
}): Promise<StrategyActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Clients cannot run the strategy desk." };

  const supabase = await createClient();

  // Load the workspace's Brand DNA (RLS ensures the user may access it).
  const { data: ws } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", input.workspaceId)
    .single<Workspace>();
  if (!ws) return { error: "Workspace not found or not accessible." };

  // Optional AI persona (a department's tuned brain).
  let persona = null;
  if (input.personaId) {
    const { data } = await supabase
      .from("ai_personas")
      .select("personality, guidance, model")
      .eq("id", input.personaId)
      .single<{ personality: string; guidance: string | null; model: string }>();
    persona = data;
  }

  // Budget gate: block the call if the user is over their monthly token limit.
  if (hasAnthropic()) {
    const { data: budget } = await supabase
      .from("ai_budgets")
      .select("monthly_token_limit")
      .eq("user_id", session.userId)
      .maybeSingle<{ monthly_token_limit: number }>();
    const limit = budget?.monthly_token_limit ?? 0;
    if (limit > 0) {
      const { data: rows } = await supabase
        .from("ai_usage")
        .select("input_tokens, output_tokens")
        .eq("user_id", session.userId)
        .gte("created_at", monthStartISO());
      const used = (rows ?? []).reduce(
        (n, r) => n + (r.input_tokens ?? 0) + (r.output_tokens ?? 0),
        0,
      );
      if (used >= limit) {
        return {
          error: `You've reached your monthly AI budget (${limit.toLocaleString()} tokens). Ask an admin to raise it.`,
        };
      }
    }
  }

  const decision = decideFormat(input.objective, input.medium, ws.subject);
  const copy = await draftCopy(ws, input.brief, decision, persona);

  // Meter the spend so admin can see who used how much, on what.
  if (copy.provider === "claude" && copy.usage) {
    await supabase.from("ai_usage").insert({
      user_id: session.userId,
      workspace_id: input.workspaceId,
      purpose: "content",
      provider: "anthropic",
      model: copy.model ?? "claude-opus-4-8",
      input_tokens: copy.usage.input,
      output_tokens: copy.usage.output,
      cost_usd: estimateCost(copy.model ?? "claude-opus-4-8", copy.usage.input, copy.usage.output),
    });
  }

  const title = input.title.trim() || `${decision.goal} — ${ws.name}`;

  const { data: created, error } = await supabase
    .from("content_items")
    .insert({
      workspace_id: input.workspaceId,
      title,
      format: decision.dbFormat,
      status: "research", // legacy status column (vestigial)
      stage: "content", // AI has drafted copy → lands on the Content desk to refine
      objective: input.objective,
      format_type: decision.formatType,
      format_rationale: decision.rationale,
      hook: copy.hook,
      educational_shift: copy.valueBridge,
      solution: copy.cta,
      brief: {
        message: input.brief,
        medium: input.medium,
        drafted_by: copy.provider,
      },
      created_by: session.userId,
      assigned_to: session.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");

  return {
    ok: true,
    contentId: created!.id,
    title,
    objective: input.objective,
    medium: input.medium,
    formatType: decision.formatType,
    rationale: decision.rationale,
    hook: copy.hook,
    valueBridge: copy.valueBridge,
    cta: copy.cta,
    provider: copy.provider,
  };
}

// ===========================================================================
// Strategy / Monthly Plan desk (0017) — pillars + AI month planner.
// ===========================================================================
import type { ContentPillar } from "@/lib/types";
import { planMonth, type PlannedPost, type PlanFormat } from "@/lib/ai/planner";
import { notifyClientOf } from "@/lib/notify";

async function requireStrategist() {
  const session = await requireSession();
  if (session.role === "client") throw new Error("Not authorized.");
  return session;
}

export async function createPillar(input: { workspaceId: string; name: string; description?: string; color?: string }): Promise<{ ok: true } | { error: string }> {
  const session = await requireStrategist();
  const name = input.name.trim();
  if (!name) return { error: "Name the pillar." };
  const supabase = await createClient();
  const { count } = await supabase.from("content_pillars").select("id", { count: "exact", head: true }).eq("workspace_id", input.workspaceId);
  const { error } = await supabase.from("content_pillars").insert({
    workspace_id: input.workspaceId, name, description: input.description?.trim() || null,
    color: (input.color ?? "").replace(/^#/, "") || null, sort: count ?? 0, created_by: session.userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/strategy");
  return { ok: true };
}

export async function deletePillar(pillarId: string): Promise<{ ok: true } | { error: string }> {
  await requireStrategist();
  const supabase = await createClient();
  const { error } = await supabase.from("content_pillars").delete().eq("id", pillarId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/strategy");
  return { ok: true };
}

/** Draft a whole month (not persisted) — returns a reviewable plan. */
export async function generateMonthPlan(input: {
  workspaceId: string; year: number; month: number; count: number; goals?: string; strategy?: string;
}): Promise<{ ok: true; posts: PlannedPost[]; provider: string } | { error: string }> {
  const session = await requireStrategist();
  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("*").eq("id", input.workspaceId).single<Workspace>();
  if (!ws) return { error: "Brand not found." };
  const { data: pillarRows } = await supabase.from("content_pillars").select("name, description").eq("workspace_id", input.workspaceId).order("sort");
  const pillars = (pillarRows as { name: string; description: string | null }[]) ?? [];

  const performance = await recentPerformance(supabase, input.workspaceId);
  const res = await planMonth(ws, { year: input.year, month: input.month, count: Math.max(1, Math.min(40, input.count)), pillars, goals: input.goals, strategy: input.strategy, performance });
  if (res.provider === "stub") return { error: "Month planning needs ANTHROPIC_API_KEY on the server." };
  if (res.posts.length === 0) return { error: "Couldn't draft a plan — try again." };
  if (res.usage) await logAiUsage(supabase, session.userId, input.workspaceId, "strategy_plan", res.usage);

  // Normalise each post's pillar to a canonical pillar name (Claude sometimes
  // echoes "Name: description"), so the review dropdown + commit map cleanly.
  const names = pillars.map((p) => p.name);
  const canon = (raw: string | null): string | null => {
    if (!raw) return null;
    const low = raw.toLowerCase();
    return names.find((n) => n.toLowerCase() === low)
      ?? names.find((n) => low.includes(n.toLowerCase()) || n.toLowerCase().includes(low))
      ?? null;
  };
  const posts = res.posts.map((p) => ({ ...p, pillar: canon(p.pillar) }));
  return { ok: true, posts, provider: res.provider };
}

/** Commit a reviewed month plan — creates every post on the calendar/pipeline. */
export async function commitMonthPlan(input: {
  workspaceId: string; year: number; month: number; campaign?: string;
  posts: {
    day: number; title: string; objective: Objective; format: PlanFormat; pillar: string | null; hook: string;
    angle?: string; keyMessage?: string; creativeDirection?: string; cta?: string; platform?: string;
    plan?: { purpose: string; note: string }[];
  }[];
}): Promise<{ ok: true; created: number } | { error: string }> {
  const session = await requireStrategist();
  if (input.posts.length === 0) return { error: "Nothing to commit." };
  const supabase = await createClient();

  // Map pillar names → ids for this brand, and read the brand's subject noun.
  const [{ data: pillarRows }, { data: wsRow }] = await Promise.all([
    supabase.from("content_pillars").select("id, name").eq("workspace_id", input.workspaceId),
    supabase.from("workspaces").select("subject").eq("id", input.workspaceId).maybeSingle<{ subject: string | null }>(),
  ]);
  const pillarId = new Map(((pillarRows as ContentPillar[]) ?? []).map((p) => [p.name.toLowerCase(), p.id]));
  const subject = wsRow?.subject ?? null;

  const t = (s?: string) => (s && s.trim() ? s.trim() : null);
  const rows = input.posts.map((p) => {
    // Format is chosen deliberately by Strategy; decideFormat only supplies the
    // archetype description/rationale (reel/carousel/story map to its post|reel axis).
    const decision = decideFormat(p.objective, p.format === "reel" ? "reel" : "post", subject);
    const date = `${input.year}-${String(input.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    const plan = (p.plan ?? []).filter((x) => x.purpose || x.note);
    const brief = {
      angle: t(p.angle), key_message: t(p.keyMessage), creative_direction: t(p.creativeDirection),
      cta: t(p.cta), platform: t(p.platform), format: p.format, plan,
    };
    // Seed an empty format-shaped body sized to the plan so the Content desk opens pre-structured.
    let content_body: Record<string, unknown> | null = null;
    if (p.format === "carousel") content_body = { slides: plan.map(() => ({ heading: "", body: "" })), caption: "", hashtags: [] };
    else if (p.format === "reel") content_body = { hook_text: "", beats: plan.map(() => ({ time: "", scene: "", on_screen: "", voiceover: "" })), caption: "", hashtags: [] };
    else if (p.format === "story") content_body = { frames: plan.map(() => ({ text: "", sticker: "" })) };
    return {
      workspace_id: input.workspaceId,
      title: p.title.trim() || "Untitled post",
      format: p.format,
      status: "ideation",
      stage: "planning",
      objective: p.objective,
      format_type: decision.formatType,
      format_rationale: decision.rationale,
      hook: p.hook?.trim() || null,
      planned_date: date,
      pillar_id: p.pillar ? pillarId.get(p.pillar.toLowerCase()) ?? null : null,
      campaign: input.campaign?.trim() || null,
      created_by: session.userId,
      // The strategic brief that cascades to every desk.
      brief,
      content_direction: t(p.angle),
      platform: t(p.platform),
      ...(content_body ? { content_body } : {}),
    };
  });

  const { error } = await supabase.from("content_items").insert(rows);
  if (error) return { error: error.message };

  // Let the client know their monthly calendar is ready to review.
  const monthName = new Date(input.year, input.month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  await notifyClientOf(input.workspaceId, {
    type: "calendar",
    title: `Your ${monthName} content plan is ready`,
    body: `Your team has drafted ${rows.length} post${rows.length === 1 ? "" : "s"} for ${monthName}. Open your portal to review the calendar and share any feedback.`,
    link: `/dashboard/plan?m=${input.year}-${String(input.month + 1).padStart(2, "0")}`,
  });

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/strategy");
  return { ok: true, created: rows.length };
}

// ---------------------------------------------------------------------------
// Audit — deep Fable 5 analysis of a committed month (balance, cadence, gaps).
// ---------------------------------------------------------------------------
export interface AuditFinding { severity: "good" | "warn" | "gap"; title: string; detail: string }

export async function auditMonth(input: { workspaceId: string; year: number; month: number }): Promise<{ ok: true; summary: string; findings: AuditFinding[] } | { error: string }> {
  const session = await requireStrategist();
  if (!hasAnthropic()) return { error: "Audit needs ANTHROPIC_API_KEY on the server." };
  const supabase = await createClient();
  const mm = String(input.month + 1).padStart(2, "0");
  const start = `${input.year}-${mm}-01`;
  const end = `${input.year}-${mm}-${String(new Date(input.year, input.month + 1, 0).getDate()).padStart(2, "0")}`;

  const [{ data: items }, { data: pillarRows }, { data: ws }] = await Promise.all([
    supabase.from("content_items").select("title, format, objective, planned_date, pillar_id").eq("workspace_id", input.workspaceId).gte("planned_date", start).lte("planned_date", end).order("planned_date"),
    supabase.from("content_pillars").select("id, name").eq("workspace_id", input.workspaceId),
    supabase.from("workspaces").select("name").eq("id", input.workspaceId).maybeSingle<{ name: string }>(),
  ]);
  const posts = (items as { title: string; format: string; objective: string | null; planned_date: string; pillar_id: string | null }[]) ?? [];
  if (!posts.length) return { error: "No posts on the calendar this month to audit." };

  const pmap = new Map(((pillarRows as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name]));
  const pillarNames = ((pillarRows as { name: string }[]) ?? []).map((p) => p.name).join(", ");
  const performance = await recentPerformance(supabase, input.workspaceId);
  const rows = posts.map((p) => `${p.planned_date} · ${p.format} · ${p.objective ?? "?"} · pillar:${p.pillar_id ? pmap.get(p.pillar_id) ?? "?" : "none"} · ${p.title}`).join("\n");
  const monthName = new Date(input.year, input.month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  const system = [
    `You are a senior content strategist auditing ${ws?.name ?? "the brand"}'s ${monthName} content calendar.`,
    "Analyse it in depth: pillar balance, objective spread, format mix, cadence (gaps, clustering, same format back-to-back), coverage (pillars/objectives not used), and whether it reflects what performs.",
    pillarNames ? `Pillars: ${pillarNames}.` : "",
    performance ? `Recent performance:\n${performance}` : "",
    "Return ONLY minified JSON: {\"summary\":\"1-2 sentences\",\"findings\":[{\"severity\":\"good|warn|gap\",\"title\":\"short\",\"detail\":\"what is wrong + the concrete fix\"}]}. 3-7 findings, most important first.",
  ].filter(Boolean).join("\n");

  try {
    const client = new Anthropic();
    const stream = client.messages.stream({ model: "claude-fable-5", max_tokens: 8000, system, messages: [{ role: "user", content: `This month's calendar (${posts.length} posts):\n${rows}` }] });
    const msg = await stream.finalMessage();
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { summary?: string; findings?: { severity?: string; title?: string; detail?: string }[] };
    await logAiUsage(supabase, session.userId, input.workspaceId, "strategy_audit", { input: msg.usage.input_tokens, output: msg.usage.output_tokens });
    const findings: AuditFinding[] = (parsed.findings ?? [])
      .map((f) => ({ severity: (["good", "warn", "gap"].includes(String(f.severity)) ? f.severity : "warn") as AuditFinding["severity"], title: String(f.title ?? "").trim(), detail: String(f.detail ?? "").trim() }))
      .filter((f) => f.title || f.detail);
    return { ok: true, summary: String(parsed.summary ?? "").trim(), findings };
  } catch {
    return { error: "The audit couldn't complete — try again." };
  }
}
