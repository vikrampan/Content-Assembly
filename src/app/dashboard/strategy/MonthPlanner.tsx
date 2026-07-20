"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentPillar } from "@/lib/types";
import { OBJECTIVE_LABELS, type Medium, type Objective } from "@/lib/mendly/strategy";
import { commitMonthPlan, generateMonthPlan } from "./actions";
import type { PlannedPost } from "@/lib/ai/planner";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;
const OBJS = Object.keys(OBJECTIVE_LABELS) as Objective[];

type Row = PlannedPost;

function Bars({ label, data }: { label: string; data: [string, number][] }) {
  const max = Math.max(...data.map((d) => d[1]), 1);
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="space-y-1">
        {data.map(([k, n]) => (
          <div key={k} className="flex items-center gap-2 text-[11px]">
            <span className="w-20 shrink-0 truncate" style={{ color: "var(--muted)" }}>{k}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: "var(--accent)" }} />
            </div>
            <span className="tabular-nums" style={{ color: "var(--muted)" }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthPlanner({ workspaceId, pillars }: { workspaceId: string; pillars: ContentPillar[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [count, setCount] = useState(12);
  const [goals, setGoals] = useState("");
  const [campaign, setCampaign] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [phase, setPhase] = useState<"idle" | "generating" | "review" | "committing">("idle");
  const [, start] = useTransition();
  const router = useRouter();

  const mine = pillars.filter((p) => p.workspace_id === workspaceId);
  const pillarNames = mine.map((p) => p.name);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  }

  function generate() {
    setMsg(null); setPhase("generating"); setRows(null);
    start(async () => {
      const res = await generateMonthPlan({ workspaceId, year, month, count, goals });
      if ("error" in res) { setMsg({ kind: "err", text: res.error }); setPhase("idle"); return; }
      setRows(res.posts); setPhase("review");
    });
  }

  function commit() {
    if (!rows) return;
    setMsg(null); setPhase("committing");
    start(async () => {
      const res = await commitMonthPlan({ workspaceId, year, month, campaign, posts: rows });
      if ("error" in res) { setMsg({ kind: "err", text: res.error }); setPhase("review"); return; }
      setMsg({ kind: "ok", text: `${res.created} posts placed on the calendar.` });
      setPhase("idle"); setRows(null);
      router.refresh();
    });
  }

  const patch = (i: number, f: Partial<Row>) => setRows((r) => (r ? r.map((x, j) => (j === i ? { ...x, ...f } : x)) : r));
  const removeRow = (i: number) => setRows((r) => (r ? r.filter((_, j) => j !== i) : r));

  const balance = useMemo(() => {
    if (!rows) return null;
    const by = (key: (p: Row) => string) => {
      const m = new Map<string, number>();
      for (const p of rows) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      objective: by((p) => OBJECTIVE_LABELS[p.objective] ?? p.objective),
      pillar: by((p) => p.pillar ?? "—"),
      medium: by((p) => p.medium),
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shift(-1)} className="rounded-lg px-2.5 py-1.5 text-sm" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>‹</button>
            <div className="min-w-[150px] text-center text-sm font-semibold">{MONTHS[month]} {year}</div>
            <button type="button" onClick={() => shift(1)} className="rounded-lg px-2.5 py-1.5 text-sm" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>›</button>
          </div>
          <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Posts</span>
            <input type="number" min={1} max={40} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-20 rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
          <label className="block flex-1 text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>This month&apos;s goals (optional)</span>
            <input value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="e.g. push the Diwali menu, grow reels reach" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
          <button type="button" onClick={generate} disabled={phase === "generating" || phase === "committing"} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {phase === "generating" ? "Planning the month…" : "✦ Draft the month"}
          </button>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          Grounded in the locked brand book{pillarNames.length ? `, your ${pillarNames.length} pillars,` : ""} and the real cultural moments for the brand&apos;s locations.
        </p>
      </div>

      {msg ? (
        <div className="rounded-lg px-3 py-2 text-xs" style={
          msg.kind === "ok" ? { background: "var(--good-soft)", color: "var(--good)" }
          : msg.kind === "err" ? { background: "rgba(192,85,63,.12)", color: "var(--danger)" }
          : { background: "var(--panel-2)", color: "var(--muted)" }
        }>{msg.text} {msg.kind === "ok" ? <Link href="/dashboard/calendar" className="underline">Open the calendar →</Link> : null}</div>
      ) : null}

      {rows && phase !== "idle" ? (
        <>
          {balance ? (
            <div className="card grid gap-4 p-4 sm:grid-cols-3">
              <Bars label="Objectives" data={balance.objective} />
              <Bars label="Pillars" data={balance.pillar} />
              <Bars label="Format" data={balance.medium} />
            </div>
          ) : null}

          <div className="card overflow-x-auto p-2">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[46px_1.6fr_120px_90px_130px_1.6fr_28px] gap-2 border-b px-2 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: "var(--line)", color: "var(--faint)" }}>
                <span>Day</span><span>Title</span><span>Objective</span><span>Format</span><span>Pillar</span><span>Hook</span><span></span>
              </div>
              {rows.map((p, i) => (
                <div key={i} className="grid grid-cols-[46px_1.6fr_120px_90px_130px_1.6fr_28px] items-center gap-2 border-b px-2 py-1.5" style={{ borderColor: "var(--line)" }}>
                  <input type="number" min={1} max={31} value={p.day} onChange={(e) => patch(i, { day: Number(e.target.value) })} className="w-full rounded px-1.5 py-1 text-xs outline-none" style={inputStyle} />
                  <input value={p.title} onChange={(e) => patch(i, { title: e.target.value })} className="w-full rounded px-2 py-1 text-xs outline-none" style={inputStyle} />
                  <select value={p.objective} onChange={(e) => patch(i, { objective: e.target.value as Objective })} className="w-full rounded px-1.5 py-1 text-xs outline-none" style={inputStyle}>
                    {OBJS.map((o) => <option key={o} value={o}>{OBJECTIVE_LABELS[o]}</option>)}
                  </select>
                  <select value={p.medium} onChange={(e) => patch(i, { medium: e.target.value as Medium })} className="w-full rounded px-1.5 py-1 text-xs outline-none" style={inputStyle}>
                    <option value="post">Post</option><option value="reel">Reel</option>
                  </select>
                  <select value={p.pillar ?? ""} onChange={(e) => patch(i, { pillar: e.target.value || null })} className="w-full rounded px-1.5 py-1 text-xs outline-none" style={inputStyle}>
                    <option value="">—</option>
                    {pillarNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <input value={p.hook} onChange={(e) => patch(i, { hook: e.target.value })} placeholder="hook" className="w-full rounded px-2 py-1 text-xs outline-none" style={inputStyle} title={p.rationale} />
                  <button type="button" onClick={() => removeRow(i)} style={{ color: "var(--faint)" }}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Campaign tag (optional)</span>
              <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="e.g. Diwali 2026" className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
            <button type="button" onClick={commit} disabled={phase === "committing" || rows.length === 0} className="ml-auto rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--good)" }}>
              {phase === "committing" ? "Placing…" : `Commit ${rows.length} posts to the calendar`}
            </button>
            <button type="button" onClick={() => { setRows(null); setPhase("idle"); }} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Discard</button>
          </div>
        </>
      ) : null}
    </div>
  );
}
