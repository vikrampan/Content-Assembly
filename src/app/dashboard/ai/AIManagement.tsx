"use client";

import { useState, useTransition } from "react";
import { setBudget, setIntegration } from "./actions";

export interface IntegrationView {
  provider: string;
  label: string;
  note?: string;
  enabled: boolean;
  hasSecret: boolean;
  last4: string | null;
}
export interface MemberRow {
  id: string;
  name: string;
  limit: number;
  usedTokens: number;
  usedCost: number;
}
export interface UsageByPurpose {
  purpose: string;
  tokens: number;
  cost: number;
}

const fmt = (n: number) => n.toLocaleString();
const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

export function AIManagement({
  integrations,
  members,
  byPurpose,
  totalTokens,
  totalCost,
}: {
  integrations: IntegrationView[];
  members: MemberRow[];
  byPurpose: UsageByPurpose[];
  totalTokens: number;
  totalCost: number;
}) {
  return (
    <div className="space-y-8">
      {/* Usage summary */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">This month</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Tokens used" value={fmt(totalTokens)} />
          <Stat label="Est. cost" value={usd(totalCost)} />
          <Stat label="Team members" value={fmt(members.length)} />
          <Stat label="Over budget" value={fmt(members.filter((m) => m.limit > 0 && m.usedTokens >= m.limit).length)} />
        </div>
        {byPurpose.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {byPurpose.map((p) => (
              <span key={p.purpose} className="rounded-full border border-black/10 px-3 py-1 text-xs dark:border-white/10">
                <span className="capitalize opacity-70">{p.purpose}</span> · {fmt(p.tokens)} tok · {usd(p.cost)}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* API keys */}
      <section>
        <h2 className="mb-1 text-sm font-semibold">API keys</h2>
        <p className="mb-3 text-xs opacity-60">
          Added once here, used by the whole team. Keys are write-only — never shown again.
        </p>
        <div className="space-y-2">
          {integrations.map((i) => <IntegrationRow key={i.provider} integ={i} />)}
        </div>
      </section>

      {/* Budgets & per-user usage */}
      <section>
        <h2 className="mb-1 text-sm font-semibold">Team budgets &amp; usage</h2>
        <p className="mb-3 text-xs opacity-60">Monthly token cap per person (0 = unlimited). Enforced before every AI call.</p>
        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-6 text-center text-xs opacity-55 dark:border-white/15">
            No team members yet. Onboard them in Team &amp; Access.
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => <BudgetRow key={m.id} member={m} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide opacity-55">{label}</div>
    </div>
  );
}

function IntegrationRow({ integ }: { integ: IntegrationView }) {
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(integ.enabled);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const res = await setIntegration({ provider: integ.provider, secret, enabled });
      setMsg("error" in res ? res.error : "Saved.");
      if (!("error" in res)) setSecret("");
    });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px]">
          <div className="text-sm font-medium">{integ.label}</div>
          <div className="text-[11px] opacity-55">
            {integ.hasSecret ? `Key set ····${integ.last4}` : "No key set"}
            {integ.note ? ` · ${integ.note}` : ""}
          </div>
        </div>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={integ.hasSecret ? "Replace key…" : "Paste API key…"}
          className="min-w-[180px] flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5"
        />
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
        <button onClick={save} disabled={pending} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50">
          Save
        </button>
      </div>
      {msg ? <div className="mt-2 text-[11px] opacity-70">{msg}</div> : null}
    </div>
  );
}

function BudgetRow({ member }: { member: MemberRow }) {
  const [limit, setLimit] = useState(String(member.limit));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pct = member.limit > 0 ? Math.min(100, Math.round((member.usedTokens / member.limit) * 100)) : 0;
  const over = member.limit > 0 && member.usedTokens >= member.limit;

  function save() {
    setMsg(null);
    start(async () => {
      const res = await setBudget(member.id, Number(limit));
      setMsg("error" in res ? res.error : "Saved.");
    });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[140px] text-sm font-medium">{member.name}</div>
        <div className="min-w-[150px] flex-1">
          <div className="flex items-center justify-between text-[11px] opacity-60">
            <span>{fmt(member.usedTokens)} used</span>
            <span>{member.limit > 0 ? `${pct}% of ${fmt(member.limit)}` : "unlimited"} · {usd(member.usedCost)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className={`h-full ${over ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${member.limit > 0 ? pct : 0}%` }} />
          </div>
        </div>
        <input
          type="number"
          min={0}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          className="w-32 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5"
          title="Monthly token limit (0 = unlimited)"
        />
        <button onClick={save} disabled={pending} className="rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10">
          Set
        </button>
      </div>
      {msg ? <div className="mt-1.5 text-[11px] opacity-70">{msg}</div> : null}
    </div>
  );
}
