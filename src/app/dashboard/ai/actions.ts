"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };

async function requireAdmin() {
  const s = await requireSession();
  if (s.role !== "admin") throw new Error("Forbidden: admin only");
  return s;
}

/** Add / update a provider key (secret is write-only, never read back to a browser). */
export async function setIntegration(input: {
  provider: string;
  label?: string;
  secret?: string;
  enabled: boolean;
}): Promise<ActionResult> {
  const s = await requireAdmin();
  const supabase = await createClient();
  const row: Record<string, unknown> = {
    provider: input.provider,
    label: input.label ?? null,
    is_enabled: input.enabled,
    updated_by: s.userId,
    updated_at: new Date().toISOString(),
  };
  // Only overwrite the secret when a new one is actually provided.
  if (input.secret && input.secret.trim()) row.secret = input.secret.trim();
  const { error } = await supabase.from("ai_integrations").upsert(row, { onConflict: "provider" });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/ai");
  return { ok: true };
}

/** Set a team member's monthly token budget (0 = unlimited). */
export async function setBudget(userId: string, limit: number): Promise<ActionResult> {
  const s = await requireAdmin();
  if (!Number.isFinite(limit) || limit < 0) return { error: "Limit must be 0 or more." };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_budgets").upsert(
    { user_id: userId, monthly_token_limit: Math.floor(limit), updated_by: s.userId, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/dashboard/ai");
  return { ok: true };
}
