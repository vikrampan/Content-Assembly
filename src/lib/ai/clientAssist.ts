// ===========================================================================
// Client-facing AI — one budget-guarded entry point for every client feature
// (home digest, insights narrative, explain-a-post, concierge chat).
//
// Cost control is strict and layered:
//   1. Every call is BUDGET-CHECKED before it runs and LOGGED after (ai_usage).
//   2. Clients are NEVER unlimited — with no explicit ai_budgets row they fall
//      back to DEFAULT_CLIENT_MONTHLY_TOKENS. An admin can raise/lower the cap
//      per client at /dashboard/ai.
//   3. Features are button-triggered (never auto), so nothing spends on load.
// ===========================================================================

import Anthropic from "@anthropic-ai/sdk";
import { hasAnthropic } from "@/lib/ai/strategist";
import { estimateCost, monthStartISO } from "@/lib/ai/usage";
import type { createClient } from "@/lib/supabase/server";

const MODEL = "claude-opus-4-8";
/** Strict default monthly token cap for a client with no explicit budget row. */
export const DEFAULT_CLIENT_MONTHLY_TOKENS = 150_000;

type Db = Awaited<ReturnType<typeof createClient>>;

export class BudgetError extends Error {}

export interface BudgetStatus { limit: number; used: number; remaining: number }

/** This client's monthly allowance + what they've used. Clients are never unlimited. */
export async function clientBudgetStatus(db: Db, userId: string): Promise<BudgetStatus> {
  const { data: budget } = await db
    .from("ai_budgets").select("monthly_token_limit").eq("user_id", userId)
    .maybeSingle<{ monthly_token_limit: number }>();
  let limit = budget?.monthly_token_limit ?? 0;
  if (!limit) limit = DEFAULT_CLIENT_MONTHLY_TOKENS; // 0/absent → default cap, not unlimited
  const { data: rows } = await db
    .from("ai_usage").select("input_tokens, output_tokens")
    .eq("user_id", userId).gte("created_at", monthStartISO());
  const used = (rows ?? []).reduce((n, r) => n + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
  return { limit, used, remaining: Math.max(0, limit - used) };
}

export interface AiResult { text: string; budget: BudgetStatus }

/**
 * The single guarded Claude call for every client feature. Throws BudgetError
 * when the client is out of allowance; otherwise runs, logs usage, and returns
 * the text plus the updated budget so the UI can show what's left.
 */
export async function runClientAi(opts: {
  db: Db; userId: string; workspaceId: string | null; purpose: string;
  system: string; user: string; maxTokens?: number;
}): Promise<AiResult> {
  if (!hasAnthropic()) throw new Error("AI isn't switched on yet — your team can enable it.");

  const before = await clientBudgetStatus(opts.db, opts.userId);
  if (before.remaining <= 0) {
    throw new BudgetError("You've used this month's AI allowance. It refreshes at the start of next month.");
  }

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 700,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("").trim();
  const input = msg.usage.input_tokens, output = msg.usage.output_tokens;

  await opts.db.from("ai_usage").insert({
    user_id: opts.userId,
    workspace_id: opts.workspaceId,
    purpose: opts.purpose,
    provider: "anthropic",
    model: MODEL,
    input_tokens: input,
    output_tokens: output,
    cost_usd: estimateCost(MODEL, input, output),
  });

  const after: BudgetStatus = { ...before, used: before.used + input + output, remaining: Math.max(0, before.remaining - input - output) };
  return { text, budget: after };
}
