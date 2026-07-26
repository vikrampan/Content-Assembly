"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentPillar } from "@/lib/types";
import { OBJECTIVE_LABELS, type Objective } from "@/lib/mendly/strategy";
import { commitMonthPlan, generateMonthPlan, auditMonth, type AuditFinding } from "./actions";
import type { PlannedPost, PlanFormat } from "@/lib/ai/planner";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;
const OBJS = Object.keys(OBJECTIVE_LABELS) as Objective[];
const FORMATS: PlanFormat[] = ["post", "carousel", "reel", "story"];
const FORMAT_ICON: Record<PlanFormat, string> = { post: "🖼️", carousel: "🎠", reel: "🎬", story: "⚡" };

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

const cellCls = "w-full rounded px-2 py-1 text-xs outline-none";

export function MonthPlanner({ workspaceId, pillars }: { workspaceId: string; pillars: ContentPillar[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [count, setCount] = useState(12);
  const [goals, setGoals] = useState("");
  const [strategy, setStrategy] = useState("");
  const [campaign, setCampaign] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [openBrief, setOpenBrief] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [phase, setPhase] = useState<"idle" | "generating" | "review" | "committing">("idle");
  const [audit, setAudit] = useState<{ summary: string; findings: AuditFinding[] } | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  const mine = pillars.filter((p) => p.workspace_id === workspaceId);
  const pillarNames = mine.map((p) => p.name);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  }
  function blankRow(): Row {
    return { day: 1, title: "", objective: OBJS[0], format: "post", pillar: pillarNames[0] ?? null, hook: "", angle: "", keyMessage: "", creativeDirection: "", cta: "", platform: "Instagram", plan: [], rationale: "" };
  }

  function runAudit() {
    setAudit(null); setAuditing(true);
    start(async () => {
      const res = await auditMonth({ workspaceId, year, month });
      setAuditing(false);
      if ("error" in res) setMsg({ kind: "err", text: res.error });
      else setAudit({ summary: res.summary, findings: res.findings });
    });
  }
  function startManual() { setMsg(null); setRows([blankRow()]); setPhase("review"); setOpenBrief(new Set([0])); }
  function addRow() {
    setRows((r) => {
      const next = r ? [...r] : [];
      const lastDay = next.length ? next[next.length - 1].day : 0;
      return [...next, { ...blankRow(), day: Math.min(lastDay + 2, 28) }];
    });
  }
  function toggleBrief(i: number) { setOpenBrief((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; }); }

  function generate() {
    setMsg(null); setPhase("generating"); setRows(null); setAudit(null);
    start(async () => {
      const res = await generateMonthPlan({ workspaceId, year, month, count, goals, strategy });
      if ("error" in res) { setMsg({ kind: "err", text: res.error }); setPhase("idle"); return; }
      setRows(res.posts); setPhase("review"); setOpenBrief(new Set());
    });
  }
  function commit() {
    if (!rows) return;
    setMsg(null); setPhase("committing");
    start(async () => {
      const res = await commitMonthPlan({ workspaceId, year, month, campaign, posts: rows });
      if ("error" in res) { setMsg({ kind: "err", text: res.error }); setPhase("review"); return; }
      setMsg({ kind: "ok", text: `${res.created} briefs placed on the calendar.` });
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
      format: by((p) => p.format),
    };
  }, [rows]);

  // Gaps / cadence warnings — the strategic quality check.
  const warnings = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const w: string[] = [];
    const sorted = [...rows].sort((a, b) => a.day - b.day);
    for (let i = 1; i < sorted.length; i++) if (sorted[i].format === sorted[i - 1].format && sorted[i].format === "reel") { w.push("Two reels back-to-back — vary the format."); break; }
    const missingBrief = rows.filter((p) => !p.angle?.trim()).length;
    if (missingBrief > 0) w.push(`${missingBrief} post${missingBrief > 1 ? "s" : ""} missing an angle — the desks need it.`);
    if (pillarNames.length > 0) { const used = new Set(rows.map((p) => p.pillar)); const unused = pillarNames.filter((n) => !used.has(n)); if (unused.length) w.push(`Pillar not covered: ${unused.join(", ")}.`); }
    return w;
  }, [rows, pillarNames]);

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
            <input value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="e.g. push the summer drop, grow reels reach" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
          <button type="button" onClick={generate} disabled={phase === "generating" || phase === "committing"} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {phase === "generating" ? "Briefing the month…" : "✦ Draft the month"}
          </button>
          <button type="button" onClick={startManual} disabled={phase === "generating" || phase === "committing"} className="rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:brightness-95 disabled:opacity-50" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>
            + Build manually
          </button>
          <button type="button" onClick={runAudit} disabled={auditing || phase === "generating"} className="rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:brightness-95 disabled:opacity-50" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>
            {auditing ? "Auditing…" : "🔍 Audit this month"}
          </button>
        </div>

        {/* Brief the copilot */}
        <label className="mt-3 block text-xs">
          <span className="mb-1 block font-semibold" style={{ color: "var(--accent-ink)" }}>✦ Brief the strategist (Fable 5)</span>
          <textarea value={strategy} onChange={(e) => setStrategy(e.target.value)} rows={2}
            placeholder="This month: summer alkaline-salt launch · lean on the Sambhar-Lake origin story · drive to puresol.in · heavy on reels for reach · one carousel/week for education · launch-countdown stories in week 1"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        </label>
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          Tell it your strategy — it plans the whole month as full <b>briefs</b> (format, angle, creative direction, and the slide/beat plan), grounded in your brand, calendar, and what performed. Everything cascades to the desks.
        </p>
      </div>

      {/* Audit report */}
      {audit ? (
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold">🔍 Month audit</span>
            <button type="button" onClick={() => setAudit(null)} className="ml-auto text-xs" style={{ color: "var(--faint)" }}>Dismiss</button>
          </div>
          {audit.summary ? <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>{audit.summary}</p> : null}
          <div className="space-y-2">
            {audit.findings.map((f, i) => {
              const tone = f.severity === "good" ? { bg: "var(--good-soft)", c: "var(--good)", icon: "✓" } : f.severity === "gap" ? { bg: "rgba(192,85,63,.12)", c: "var(--danger)", icon: "◆" } : { bg: "var(--accent-soft)", c: "var(--accent-ink)", icon: "!" };
              return (
                <div key={i} className="flex gap-2.5 rounded-lg p-2.5" style={{ background: tone.bg }}>
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: tone.c }}>{tone.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: tone.c }}>{f.title}</div>
                    {f.detail ? <div className="text-xs leading-relaxed" style={{ color: "var(--ink)" }}>{f.detail}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

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
              <Bars label="Format" data={balance.format} />
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
              {warnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          ) : null}

          <div className="space-y-2">
            {rows.map((p, i) => {
              const open = openBrief.has(i);
              return (
                <div key={i} className="card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="number" min={1} max={31} value={p.day} onChange={(e) => patch(i, { day: Number(e.target.value) })} className={`${cellCls} w-12 text-center`} style={inputStyle} />
                    <input value={p.title} onChange={(e) => patch(i, { title: e.target.value })} placeholder="Working title" className={`${cellCls} min-w-[140px] flex-1 font-medium`} style={inputStyle} />
                    <select value={p.objective} onChange={(e) => patch(i, { objective: e.target.value as Objective })} className={`${cellCls} w-32`} style={inputStyle}>
                      {OBJS.map((o) => <option key={o} value={o}>{OBJECTIVE_LABELS[o]}</option>)}
                    </select>
                    <select value={p.format} onChange={(e) => patch(i, { format: e.target.value as PlanFormat })} className={`${cellCls} w-28`} style={inputStyle}>
                      {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_ICON[f]} {f}</option>)}
                    </select>
                    <select value={p.pillar ?? ""} onChange={(e) => patch(i, { pillar: e.target.value || null })} className={`${cellCls} w-32`} style={inputStyle}>
                      <option value="">—</option>
                      {pillarNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button type="button" onClick={() => toggleBrief(i)} className="rounded px-2 py-1 text-[11px] font-semibold" style={{ border: "1px solid var(--line-2)", color: p.angle?.trim() ? "var(--accent-ink)" : "var(--danger)" }}>
                      Brief {open ? "▾" : "▸"}
                    </button>
                    <button type="button" onClick={() => removeRow(i)} style={{ color: "var(--faint)" }}>×</button>
                  </div>

                  {!open && p.angle?.trim() ? <div className="mt-1.5 truncate pl-1 text-[11px]" style={{ color: "var(--muted)" }}>{p.angle}</div> : null}

                  {open ? (
                    <div className="mt-2.5 grid gap-2 border-t pt-2.5 sm:grid-cols-2" style={{ borderColor: "var(--line)" }}>
                      <label className="block text-[11px] sm:col-span-2"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>Angle — what this post is about</span>
                        <input value={p.angle} onChange={(e) => patch(i, { angle: e.target.value })} className={cellCls} style={inputStyle} placeholder="The point this post makes" /></label>
                      <label className="block text-[11px]"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>Key message</span>
                        <input value={p.keyMessage} onChange={(e) => patch(i, { keyMessage: e.target.value })} className={cellCls} style={inputStyle} placeholder="The one takeaway" /></label>
                      <label className="block text-[11px]"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>Platform</span>
                        <input value={p.platform} onChange={(e) => patch(i, { platform: e.target.value })} className={cellCls} style={inputStyle} placeholder="Instagram" /></label>
                      <label className="block text-[11px] sm:col-span-2"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>Creative direction — what to shoot / design</span>
                        <textarea rows={2} value={p.creativeDirection} onChange={(e) => patch(i, { creativeDirection: e.target.value })} className={cellCls} style={inputStyle} placeholder="Concrete direction for the video/design team" /></label>
                      <label className="block text-[11px]"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>Hook</span>
                        <input value={p.hook} onChange={(e) => patch(i, { hook: e.target.value })} className={cellCls} style={inputStyle} placeholder="Scroll-stopping line" /></label>
                      <label className="block text-[11px]"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>CTA</span>
                        <input value={p.cta} onChange={(e) => patch(i, { cta: e.target.value })} className={cellCls} style={inputStyle} placeholder="The call to action" /></label>
                      {p.plan && p.plan.length > 0 ? (
                        <div className="sm:col-span-2">
                          <div className="mb-0.5 text-[11px]" style={{ color: "var(--muted)" }}>{p.format === "carousel" ? "Slide" : p.format === "reel" ? "Beat" : p.format === "story" ? "Frame" : "Step"} plan</div>
                          <div className="space-y-1">
                            {p.plan.map((s, k) => (
                              <div key={k} className="flex gap-1.5 text-[11px]">
                                <span className="shrink-0 rounded px-1.5 font-semibold" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--accent-ink)" }}>{k + 1} · {s.purpose}</span>
                                <span className="min-w-0 truncate" style={{ color: "var(--muted)" }}>{s.note}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <button type="button" onClick={addRow} className="w-full rounded-lg border border-dashed px-2 py-2 text-xs font-semibold transition hover:brightness-95" style={{ borderColor: "var(--line-2)", color: "var(--accent-ink)" }}>+ Add post</button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Campaign tag (optional)</span>
              <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="e.g. Summer 2026" className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
            <button type="button" onClick={commit} disabled={phase === "committing" || rows.length === 0} className="ml-auto rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--good)" }}>
              {phase === "committing" ? "Placing…" : `Commit ${rows.length} briefs to the calendar`}
            </button>
            <button type="button" onClick={() => { setRows(null); setPhase("idle"); }} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Discard</button>
          </div>
        </>
      ) : null}
    </div>
  );
}
