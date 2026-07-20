"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentItem, ContentPillar, Workspace } from "@/lib/types";
import { OBJECTIVE_LABELS, type Medium, type Objective } from "@/lib/mendly/strategy";
import { createPlannedPost, reschedule } from "./actions";

const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function Calendar({
  workspaces,
  items,
  pillars,
}: {
  workspaces: Workspace[];
  items: ContentItem[];
  pillars: ContentPillar[];
}) {
  const today = new Date();
  const pillarColor = useMemo(() => new Map(pillars.map((p) => [p.id, p.color])), [pillars]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [addDate, setAddDate] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const wsName = useMemo(() => new Map(workspaces.map((w) => [w.id, w.name])), [workspaces]);
  const byDay = useMemo(() => {
    const m = new Map<string, ContentItem[]>();
    for (const it of items) {
      if (!it.planned_date) continue;
      const list = m.get(it.planned_date) ?? [];
      list.push(it);
      m.set(it.planned_date, list);
    }
    return m;
  }, [items]);

  // Build the grid: leading blanks (Mon-start) then days.
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setAddDate(null);
  }
  function drop(date: string) {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    startTransition(async () => {
      await reschedule(id, date);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => shift(-1)} className="rounded-lg border border-black/15 px-2.5 py-1 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">‹</button>
        <div className="min-w-[190px] text-center font-semibold">{MONTHS[month]} {year}</div>
        <button onClick={() => shift(1)} className="rounded-lg border border-black/15 px-2.5 py-1 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">›</button>
        <span className="ml-auto text-xs opacity-55">Drag a post to another day to reschedule</span>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/5 text-sm dark:border-white/10 dark:bg-white/10">
        {DOW.map((d) => (
          <div key={d} className="bg-[var(--background)] px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide opacity-55">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-[92px] bg-[var(--background)] opacity-40" />;
          const date = iso(year, month, day);
          const dayItems = byDay.get(date) ?? [];
          const isToday = date === iso(today.getFullYear(), today.getMonth(), today.getDate());
          return (
            <div
              key={i}
              onDragOver={(e) => { if (dragId) e.preventDefault(); }}
              onDrop={() => drop(date)}
              className="group relative min-h-[92px] bg-[var(--background)] p-1.5"
            >
              <div className="mb-1 flex items-center gap-1">
                <span className={`text-xs ${isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 font-semibold text-white" : "opacity-55"}`}>{day}</span>
                <button
                  onClick={() => setAddDate(date)}
                  className="ml-auto rounded px-1 text-xs opacity-0 transition hover:bg-black/10 group-hover:opacity-60 dark:hover:bg-white/10"
                  title="Plan a post"
                >+</button>
              </div>
              <div className="space-y-1">
                {dayItems.map((it) => (
                  <Link
                    key={it.id}
                    href={`/dashboard/content/${it.id}`}
                    draggable
                    onDragStart={() => setDragId(it.id)}
                    className="block cursor-grab truncate rounded-md border border-black/10 bg-white px-1.5 py-1 text-[11px] leading-tight active:cursor-grabbing dark:border-white/10 dark:bg-white/10"
                    style={it.pillar_id && pillarColor.get(it.pillar_id) ? { borderLeft: `3px solid #${pillarColor.get(it.pillar_id)}` } : undefined}
                    title={`${it.title} · ${wsName.get(it.workspace_id) ?? ""}`}
                  >
                    <span className="opacity-45">{it.format[0].toUpperCase()}</span> {it.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {addDate ? (
        <AddForm
          workspaces={workspaces}
          pillars={pillars}
          date={addDate}
          pending={pending}
          onClose={() => setAddDate(null)}
          onCreate={(payload) =>
            startTransition(async () => {
              const res = await createPlannedPost(payload);
              if (!("error" in res)) { setAddDate(null); router.refresh(); }
            })
          }
        />
      ) : null}
    </div>
  );
}

function AddForm({
  workspaces, pillars, date, pending, onClose, onCreate,
}: {
  workspaces: Workspace[];
  pillars: ContentPillar[];
  date: string;
  pending: boolean;
  onClose: () => void;
  onCreate: (p: { workspaceId: string; title: string; objective: Objective; medium: Medium; date: string; pillarId: string | null }) => void;
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState<Objective>("launch");
  const [medium, setMedium] = useState<Medium>("post");
  const [pillarId, setPillarId] = useState("");
  const myPillars = pillars.filter((p) => p.workspace_id === workspaceId);

  return (
    <div className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Plan a post · {date}</h3>
        <button onClick={onClose} className="text-xs opacity-60 hover:underline">Cancel</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs"><span className="mb-1 block opacity-70">Brand</span>
          <select className={inputCls} value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label className="block text-xs"><span className="mb-1 block opacity-70">Title</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diwali teaser" />
        </label>
        <label className="block text-xs"><span className="mb-1 block opacity-70">Objective</span>
          <select className={inputCls} value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
            {(Object.keys(OBJECTIVE_LABELS) as Objective[]).map((o) => <option key={o} value={o}>{OBJECTIVE_LABELS[o]}</option>)}
          </select>
        </label>
        <label className="block text-xs"><span className="mb-1 block opacity-70">Medium</span>
          <select className={inputCls} value={medium} onChange={(e) => setMedium(e.target.value as Medium)}>
            <option value="post">Post</option><option value="reel">Reel</option>
          </select>
        </label>
        {myPillars.length > 0 ? (
          <label className="block text-xs"><span className="mb-1 block opacity-70">Pillar</span>
            <select className={inputCls} value={pillarId} onChange={(e) => setPillarId(e.target.value)}>
              <option value="">— none —</option>
              {myPillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <button
        onClick={() => onCreate({ workspaceId, title, objective, medium, date, pillarId: pillarId || null })}
        disabled={pending || !title.trim() || !workspaceId}
        className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add to calendar"}
      </button>
    </div>
  );
}
