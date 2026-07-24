"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { STAGES } from "@/lib/mendly/stages";
import type { ContentItem } from "@/lib/types";
import { moveStage } from "@/app/dashboard/actions";

const FORMAT_ICON: Record<string, string> = { post: "▢", carousel: "▧", reel: "▷" };

/**
 * The control-room board. Columns are the pipeline stages; a card sits in the
 * column of the desk it's on and moves as it's routed. Drag a card to reroute.
 */
const initialsOf = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length === 0 ? "·" : p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

export function KanbanBoard({
  items: initial,
  wsName,
  staffName,
}: {
  items: ContentItem[];
  wsName?: Record<string, string>;
  staffName?: Record<string, string>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [items, setItems] = useState(initial);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => setItems(initial), [initial]);

  function move(id: string, toStage: string) {
    const cur = items.find((i) => i.id === id);
    if (!cur || cur.stage === toStage) return;
    setError(null);
    const prev = items;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, stage: toStage } : i)));
    start(async () => {
      const res = await moveStage(id, toStage);
      if ("error" in res) { setItems(prev); setError(res.error); }
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div>
      ) : null}
      <div className="lane-scroll overflow-x-auto pb-4">
        <div className="flex min-w-max gap-3">
          {STAGES.map((s) => {
            const cards = items.filter((i) => i.stage === s.key);
            const active = dragOver === s.key;
            return (
              <div
                key={s.key}
                onDragOver={(e) => { e.preventDefault(); setDragOver(s.key); }}
                onDragLeave={() => setDragOver((k) => (k === s.key ? null : k))}
                onDrop={(e) => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, s.key); }}
                className={`flex w-64 shrink-0 flex-col rounded-2xl p-3 transition ${active ? "bg-amber-500/10 outline outline-2 outline-amber-400/60" : "bg-black/[0.03] dark:bg-white/[0.03]"}`}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold">{s.label}</h3>
                  <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs tabular-nums dark:bg-white/10">{cards.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {cards.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-black/10 px-3 py-6 text-center text-xs opacity-40 dark:border-white/10">
                      {active ? "Drop here" : "—"}
                    </div>
                  ) : (
                    cards.map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                        className="cursor-grab rounded-xl border border-black/10 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="mb-1 flex items-center gap-2 text-xs opacity-50">
                          <span aria-hidden>{FORMAT_ICON[item.format] ?? "▢"}</span>
                          <span className="uppercase tracking-wide">{item.format}</span>
                          {wsName ? <span className="ml-auto truncate">{wsName[item.workspace_id] ?? ""}</span> : null}
                        </div>
                        <Link href={`/dashboard/content/${item.id}`} onClick={(e) => e.stopPropagation()} draggable={false} className="text-sm font-medium leading-snug hover:underline">
                          {item.title}
                        </Link>
                        {item.assignment_note ? (
                          <div className="mt-1.5 line-clamp-2 text-[11px] opacity-55">{item.assignment_note}</div>
                        ) : null}
                        {item.due_date || (item.assigned_to && staffName?.[item.assigned_to]) ? (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {item.due_date ? (
                              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={item.due_date < today && item.stage !== "published" ? { background: "rgba(192,85,63,.14)", color: "var(--danger)" } : { background: "var(--panel-2)", color: "var(--muted)" }}>
                                {new Date(item.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            ) : null}
                            {item.assigned_to && staffName?.[item.assigned_to] ? (
                              <span className="ml-auto grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: "var(--accent)" }} title={staffName[item.assigned_to]}>{initialsOf(staffName[item.assigned_to])}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
