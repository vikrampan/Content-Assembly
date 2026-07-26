"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentItem, ContentPillar, Workspace } from "@/lib/types";
import { createPlannedPost, reschedule, deletePlannedPost } from "./actions";
import { PlanPostForm } from "./PlanPostForm";

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
  function remove(id: string, title: string) {
    if (!window.confirm(`Remove "${title}" from the calendar? This deletes the post.`)) return;
    startTransition(async () => {
      await deletePlannedPost(id);
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
                  <div key={it.id} className="group/chip relative">
                    <Link
                      href={`/dashboard/content/${it.id}`}
                      draggable
                      onDragStart={() => setDragId(it.id)}
                      className="block cursor-grab truncate rounded-md px-1.5 py-1 pr-5 text-[11px] leading-tight active:cursor-grabbing"
                      style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--ink)", ...(it.pillar_id && pillarColor.get(it.pillar_id) ? { borderLeft: `3px solid #${pillarColor.get(it.pillar_id)}` } : {}) }}
                      title={`${it.title} · ${wsName.get(it.workspace_id) ?? ""}`}
                    >
                      <span style={{ color: "var(--faint)" }}>{it.format[0].toUpperCase()}</span> {it.title}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(it.id, it.title)}
                      className="absolute right-0.5 top-0.5 rounded px-1 text-[11px] opacity-0 transition group-hover/chip:opacity-100"
                      style={{ color: "var(--danger)", background: "var(--panel)" }}
                      title="Remove from calendar"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {addDate ? (
        <PlanPostForm
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
