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
      status: "research", // enters the pipeline at the Strategy desk
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
