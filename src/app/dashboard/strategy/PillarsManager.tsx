"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentPillar } from "@/lib/types";
import { createPillar, deletePillar } from "./actions";

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;
const SWATCHES = ["C8853F", "3f9d5a", "5b7a8c", "9c6cc0", "c0553f", "A9803A"];

export function PillarsManager({ workspaceId, pillars }: { workspaceId: string; pillars: ContentPillar[] }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const mine = pillars.filter((p) => p.workspace_id === workspaceId);

  function add() {
    setMsg(null);
    start(async () => {
      const res = await createPillar({ workspaceId, name, description: desc, color });
      if ("error" in res) setMsg(res.error);
      else { setName(""); setDesc(""); router.refresh(); }
    });
  }
  function remove(id: string) {
    start(async () => { await deletePillar(id); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Content pillars</h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>The brand&apos;s recurring themes — the month planner balances across these.</p>
      </div>

      {mine.length > 0 ? (
        <div className="flex flex-col gap-2">
          {mine.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--panel-2)", borderLeft: `4px solid #${p.color ?? "cccccc"}` }}>
              <div className="flex-1">
                <div className="text-sm font-medium">{p.name}</div>
                {p.description ? <div className="text-xs" style={{ color: "var(--muted)" }}>{p.description}</div> : null}
              </div>
              <button type="button" onClick={() => remove(p.id)} disabled={pending} style={{ color: "var(--faint)" }} title="Delete">×</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-6 text-center text-xs" style={{ border: "1px dashed var(--line-2)", color: "var(--muted)" }}>
          No pillars yet. Define 3–5 themes the brand keeps returning to.
        </div>
      )}

      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
          <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Pillar name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Behind the fire" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
          <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>What it covers</span>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="the craft, the flame, the kitchen" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            {SWATCHES.map((s) => (
              <button key={s} type="button" onClick={() => setColor(s)} className="h-6 w-6 rounded-full" style={{ background: `#${s}`, outline: color === s ? "2px solid var(--ink)" : "none", outlineOffset: 2 }} />
            ))}
          </div>
          <button type="button" onClick={add} disabled={pending || !name.trim()} className="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {pending ? "Adding…" : "Add pillar"}
          </button>
        </div>
        {msg ? <div className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{msg}</div> : null}
      </div>
    </div>
  );
}
