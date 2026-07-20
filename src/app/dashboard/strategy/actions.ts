"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decideFormat, type Medium, type Objective } from "@/lib/mendly/strategy";
import { draftCopy, hasAnthropic } from "@/lib/ai/strategist";
import { estimateCost, monthStartISO } from "@/lib/ai/usage";
import type { Workspace } from "@/lib/types";

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

  const decision = decideFormat(input.objective, input.medium);
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
import { planMonth, type PlannedPost } from "@/lib/ai/planner";

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
  workspaceId: string; year: number; month: number; count: number; goals?: string;
}): Promise<{ ok: true; posts: PlannedPost[]; provider: string } | { error: string }> {
  await requireStrategist();
  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("*").eq("id", input.workspaceId).single<Workspace>();
  if (!ws) return { error: "Brand not found." };
  const { data: pillarRows } = await supabase.from("content_pillars").select("name, description").eq("workspace_id", input.workspaceId).order("sort");
  const pillars = (pillarRows as { name: string; description: string | null }[]) ?? [];

  const res = await planMonth(ws, { year: input.year, month: input.month, count: Math.max(1, Math.min(40, input.count)), pillars, goals: input.goals });
  if (res.provider === "stub") return { error: "Month planning needs ANTHROPIC_API_KEY on the server." };
  if (res.posts.length === 0) return { error: "Couldn't draft a plan — try again." };

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
  posts: { day: number; title: string; objective: Objective; medium: Medium; pillar: string | null; hook: string }[];
}): Promise<{ ok: true; created: number } | { error: string }> {
  const session = await requireStrategist();
  if (input.posts.length === 0) return { error: "Nothing to commit." };
  const supabase = await createClient();

  // Map pillar names → ids for this brand.
  const { data: pillarRows } = await supabase.from("content_pillars").select("id, name").eq("workspace_id", input.workspaceId);
  const pillarId = new Map(((pillarRows as ContentPillar[]) ?? []).map((p) => [p.name.toLowerCase(), p.id]));

  const rows = input.posts.map((p) => {
    const decision = decideFormat(p.objective, p.medium);
    const date = `${input.year}-${String(input.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    return {
      workspace_id: input.workspaceId,
      title: p.title.trim() || "Untitled post",
      format: decision.dbFormat,
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
    };
  });

  const { error } = await supabase.from("content_items").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/strategy");
  return { ok: true, created: rows.length };
}
