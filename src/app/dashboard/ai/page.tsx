import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthStartISO } from "@/lib/ai/usage";
import type { Profile } from "@/lib/types";
import { AIManagement, type IntegrationView, type MemberRow, type UsageByPurpose } from "./AIManagement";

export default async function AIPage() {
  const session = await requireAccess("ai");

  const supabase = await createClient();
  const monthStart = monthStartISO();

  const [{ data: integ }, { data: profiles }, { data: budgets }, { data: usage }] = await Promise.all([
    supabase.from("ai_integrations").select("provider, label, is_enabled, updated_at, secret"),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("ai_budgets").select("user_id, monthly_token_limit"),
    supabase.from("ai_usage").select("user_id, purpose, input_tokens, output_tokens, cost_usd, created_at").gte("created_at", monthStart),
  ]);

  // Integrations — never leak the secret; only whether it's set + last 4.
  const integRows = (integ as { provider: string; label: string | null; is_enabled: boolean; updated_at: string; secret: string | null }[]) ?? [];
  const integByProvider = new Map(integRows.map((r) => [r.provider, r]));
  const CATALOG: { key: string; label: string; note?: string }[] = [
    { key: "anthropic", label: "Anthropic (Claude) — copy, strategy, QA", note: "Currently active via your server env key." },
    { key: "image", label: "Image generation — Firefly / Replicate" },
    { key: "video", label: "Video generation — Runway" },
    { key: "audio", label: "Audio / voice — ElevenLabs" },
    { key: "scraper", label: "Local events scraper" },
    { key: "meta", label: "Meta Suite — publishing + analytics" },
  ];
  const integrations: IntegrationView[] = CATALOG.map((c) => {
    const row = integByProvider.get(c.key);
    const secret = row?.secret ?? null;
    return {
      provider: c.key,
      label: c.label,
      note: c.note,
      enabled: row?.is_enabled ?? false,
      hasSecret: Boolean(secret),
      last4: secret ? secret.slice(-4) : null,
    };
  });

  // Per-user usage this month.
  const usageRows = (usage as { user_id: string; purpose: string | null; input_tokens: number; output_tokens: number; cost_usd: number }[]) ?? [];
  const perUser = new Map<string, { tokens: number; cost: number }>();
  const perPurpose = new Map<string, { tokens: number; cost: number }>();
  let totalTokens = 0, totalCost = 0;
  for (const r of usageRows) {
    const tok = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    totalTokens += tok; totalCost += Number(r.cost_usd ?? 0);
    const u = perUser.get(r.user_id) ?? { tokens: 0, cost: 0 };
    u.tokens += tok; u.cost += Number(r.cost_usd ?? 0); perUser.set(r.user_id, u);
    const pk = r.purpose ?? "other";
    const p = perPurpose.get(pk) ?? { tokens: 0, cost: 0 };
    p.tokens += tok; p.cost += Number(r.cost_usd ?? 0); perPurpose.set(pk, p);
  }

  const budgetMap = new Map(((budgets as { user_id: string; monthly_token_limit: number }[]) ?? []).map((b) => [b.user_id, b.monthly_token_limit]));
  const team = ((profiles as Profile[]) ?? []).filter((p) => p.account_type === "team_incharge");
  const members: MemberRow[] = team.map((p) => {
    const u = perUser.get(p.id) ?? { tokens: 0, cost: 0 };
    return { id: p.id, name: p.full_name ?? "—", limit: budgetMap.get(p.id) ?? 0, usedTokens: u.tokens, usedCost: u.cost };
  });

  const byPurpose: UsageByPurpose[] = [...perPurpose.entries()]
    .map(([purpose, v]) => ({ purpose, tokens: v.tokens, cost: v.cost }))
    .sort((a, b) => b.tokens - a.tokens);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">AI Management</h1>
        <p className="text-sm opacity-60">
          Add provider keys once, cap each person&apos;s monthly tokens, and see who
          spent how much on what — so bills never surprise you.
        </p>
      </div>
      <AIManagement
        integrations={integrations}
        members={members}
        byPurpose={byPurpose}
        totalTokens={totalTokens}
        totalCost={totalCost}
      />
    </div>
  );
}
