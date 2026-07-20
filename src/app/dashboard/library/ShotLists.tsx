"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CaptureBrief } from "@/lib/types";
import { deleteBrief, generateShotList, updateBriefShots } from "./actions";

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

export function ShotLists({ workspaceId, briefs }: { workspaceId: string; briefs: CaptureBrief[] }) {
  const [focus, setFocus] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function generate() {
    setMsg(null);
    start(async () => {
      const res = await generateShotList(workspaceId, focus);
      if ("error" in res) setMsg(res.error);
      else { setFocus(""); router.refresh(); }
    });
  }

  function toggle(brief: CaptureBrief, i: number) {
    const shots = brief.shots.map((s, j) => (j === i ? { ...s, done: !s.done } : s));
    start(async () => { await updateBriefShots(brief.id, shots); router.refresh(); });
  }

  function remove(id: string) {
    start(async () => { await deleteBrief(id); router.refresh(); });
  }

  const mine = briefs.filter((b) => b.workspace_id === workspaceId);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "var(--accent-soft)", border: "1px solid var(--line)" }}>
        <div className="mb-2 text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>Generate a directed shot list</div>
        <div className="flex flex-wrap gap-2">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Focus — e.g. Diwali dinner service, new dessert launch…" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          <button type="button" onClick={generate} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {pending ? "Drafting…" : "✦ Generate shot list"}
          </button>
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>Built from this brand&apos;s photography style &amp; do/never rules.</p>
        {msg ? <div className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{msg}</div> : null}
      </div>

      {mine.length === 0 ? (
        <div className="rounded-xl p-8 text-center text-sm" style={{ border: "1px dashed var(--line-2)", color: "var(--muted)" }}>
          No shot lists yet — generate one above to brief the shoot.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {mine.map((b) => {
            const done = b.shots.filter((s) => s.done).length;
            return (
              <div key={b.id} className="card p-4">
                <div className="mb-2 flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{b.title}</div>
                    {b.focus ? <div className="text-[11px]" style={{ color: "var(--faint)" }}>{b.focus}</div> : null}
                  </div>
                  <span className="pill scheduled">{done}/{b.shots.length}</span>
                  <button type="button" onClick={() => remove(b.id)} style={{ color: "var(--faint)" }} title="Delete">×</button>
                </div>
                <ul className="space-y-1.5">
                  {b.shots.map((s, i) => (
                    <li key={i}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
                        <input type="checkbox" checked={!!s.done} onChange={() => toggle(b, i)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--good)]" />
                        <span className="text-xs" style={{ textDecoration: s.done ? "line-through" : undefined, opacity: s.done ? 0.55 : 1 }}>
                          <span className="font-medium">{s.shot}</span>
                          {s.note ? <span className="block" style={{ color: "var(--muted)" }}>{s.note}</span> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
