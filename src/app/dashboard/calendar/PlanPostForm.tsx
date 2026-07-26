"use client";

import { useState } from "react";
import type { ContentPillar, Workspace } from "@/lib/types";
import { OBJECTIVE_LABELS, type Objective } from "@/lib/mendly/strategy";
import type { PlanFormat } from "@/lib/ai/planner";

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

const FORMATS: { k: PlanFormat; label: string; icon: string }[] = [
  { k: "post", label: "Post", icon: "🖼️" },
  { k: "carousel", label: "Carousel", icon: "🎠" },
  { k: "reel", label: "Reel", icon: "🎬" },
  { k: "story", label: "Story", icon: "⚡" },
];
const PURPOSES: Record<PlanFormat, string[]> = {
  post: [],
  carousel: ["Hook", "Context", "Point", "Proof", "Story", "CTA"],
  reel: ["Hook (0–3s)", "Build", "Payoff", "CTA"],
  story: ["Hook", "Content", "Interact", "CTA"],
};
const DEFAULT_PLAN: Record<PlanFormat, string[]> = {
  post: [],
  carousel: ["Hook", "Point", "Point", "Proof", "CTA"],
  reel: ["Hook (0–3s)", "Build", "Payoff", "CTA"],
  story: ["Hook", "Content", "CTA"],
};
const PLAN_NOUN: Record<PlanFormat, string> = { post: "", carousel: "slide", reel: "beat", story: "frame" };

export interface PlanPayload {
  workspaceId: string; title: string; objective: Objective; format: PlanFormat; date: string; pillarId: string | null;
  platform: string; angle: string; contentBrief: string; designBrief: string; cta: string;
  plan: { purpose: string; note: string }[];
}

export function PlanPostForm({ workspaces, pillars, date, pending, onClose, onCreate }: {
  workspaces: Workspace[]; pillars: ContentPillar[]; date: string; pending: boolean;
  onClose: () => void; onCreate: (p: PlanPayload) => void;
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState<Objective>("launch");
  const [format, setFormat] = useState<PlanFormat>("post");
  const [pillarId, setPillarId] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [angle, setAngle] = useState("");
  const [contentBrief, setContentBrief] = useState("");
  const [designBrief, setDesignBrief] = useState("");
  const [cta, setCta] = useState("");
  const [plan, setPlan] = useState<{ purpose: string; note: string }[]>([]);
  const myPillars = pillars.filter((p) => p.workspace_id === workspaceId);
  const noun = PLAN_NOUN[format];

  function changeFormat(f: PlanFormat) {
    setFormat(f);
    setPlan(DEFAULT_PLAN[f].map((purpose) => ({ purpose, note: "" })));
  }
  function setCount(n: number) {
    setPlan((cur) => {
      const next = cur.slice(0, n);
      while (next.length < n) next.push({ purpose: "Point", note: "" });
      return next;
    });
  }
  const patch = (i: number, p: Partial<{ purpose: string; note: string }>) => setPlan((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const addRow = () => setPlan((cur) => [...cur, { purpose: PURPOSES[format][1] ?? PURPOSES[format][0] ?? "", note: "" }]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--line)" }}>
        <h3 className="text-sm font-semibold">Plan a post · {date}</h3>
        <button type="button" onClick={onClose} className="text-xs" style={{ color: "var(--muted)" }}>Cancel</button>
      </div>

      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Brand</span>
            <select className={inputCls} style={inputStyle} value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Title</span>
            <input className={inputCls} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diwali teaser" />
          </label>
        </div>

        {/* Format picker */}
        <div className="block text-xs">
          <span className="mb-1 block" style={{ color: "var(--muted)" }}>Format</span>
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <button key={f.k} type="button" onClick={() => changeFormat(f.k)} className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                style={format === f.k ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Objective</span>
            <select className={inputCls} style={inputStyle} value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
              {(Object.keys(OBJECTIVE_LABELS) as Objective[]).map((o) => <option key={o} value={o}>{OBJECTIVE_LABELS[o]}</option>)}
            </select>
          </label>
          <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Platform</span>
            <input className={inputCls} style={inputStyle} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Instagram" />
          </label>
          <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Pillar</span>
            <select className={inputCls} style={inputStyle} value={pillarId} onChange={(e) => setPillarId(e.target.value)}>
              <option value="">— none —</option>
              {myPillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>

        {/* The brief */}
        <div className="space-y-2 rounded-xl p-3" style={{ background: "var(--accent-soft)" }}>
          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--accent-ink)" }}>The brief — cascades to the desks</div>
          <label className="block text-xs"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>What&apos;s this about? (angle)</span>
            <input className={inputCls} style={inputStyle} value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="The point this post makes" />
          </label>
          <label className="block text-xs"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>Content brief — what it should say</span>
            <textarea className={inputCls} style={inputStyle} rows={2} value={contentBrief} onChange={(e) => setContentBrief(e.target.value)} placeholder="Key message + talking points for the copywriter" />
          </label>
          <label className="block text-xs"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>Design brief — what it should look like</span>
            <textarea className={inputCls} style={inputStyle} rows={2} value={designBrief} onChange={(e) => setDesignBrief(e.target.value)} placeholder="Visual direction for the design/video team — what to shoot/make" />
          </label>
          <label className="block text-xs"><span className="mb-0.5 block" style={{ color: "var(--muted)" }}>CTA</span>
            <input className={inputCls} style={inputStyle} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="The call to action" />
          </label>
        </div>

        {/* Per-format plan */}
        {format !== "post" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{noun} plan ({plan.length})</span>
              {format === "carousel" ? (
                <label className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: "var(--muted)" }}>Slides
                  <input type="number" min={3} max={10} value={plan.length} onChange={(e) => setCount(Math.max(3, Math.min(10, Number(e.target.value) || 3)))} className="w-14 rounded px-2 py-1 text-xs" style={inputStyle} />
                </label>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {plan.map((row, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg p-2" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold" style={{ color: "var(--accent-ink)" }}>{i + 1}</span>
                  <select value={row.purpose} onChange={(e) => patch(i, { purpose: e.target.value })} className="w-28 shrink-0 rounded px-1.5 py-1 text-xs" style={inputStyle}>
                    {[...new Set([row.purpose, ...PURPOSES[format]])].filter(Boolean).map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input value={row.note} onChange={(e) => patch(i, { note: e.target.value })} placeholder={`What this ${noun} says + looks like`} className="min-w-0 flex-1 rounded px-2 py-1 text-xs outline-none" style={inputStyle} />
                  {format !== "carousel" ? <button type="button" onClick={() => setPlan((cur) => cur.filter((_, j) => j !== i))} style={{ color: "var(--faint)" }}>✕</button> : null}
                </div>
              ))}
              {format !== "carousel" ? (
                <button type="button" onClick={addRow} className="w-full rounded-lg border border-dashed px-2 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--line-2)", color: "var(--accent-ink)" }}>+ Add {noun}</button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t p-4" style={{ borderColor: "var(--line)" }}>
        <button type="button"
          onClick={() => onCreate({ workspaceId, title, objective, format, date, pillarId: pillarId || null, platform, angle, contentBrief, designBrief, cta, plan })}
          disabled={pending || !title.trim() || !workspaceId}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {pending ? "Adding…" : "Add to calendar"}
        </button>
      </div>
    </div>
  );
}
