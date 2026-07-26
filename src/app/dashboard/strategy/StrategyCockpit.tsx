"use client";

import { useState } from "react";
import type { ContentPillar, Workspace } from "@/lib/types";
import { MonthPlanner } from "./MonthPlanner";
import { PillarsManager } from "./PillarsManager";

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

export function StrategyCockpit({
  workspaces,
  pillars,
}: {
  workspaces: Workspace[];
  pillars: ContentPillar[];
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [tab, setTab] = useState<"planner" | "pillars">("planner");

  const pillarCount = pillars.filter((p) => p.workspace_id === workspaceId).length;
  const TABS = [
    { k: "planner" as const, label: "✦ Month Planner" },
    { k: "pillars" as const, label: `Pillars (${pillarCount})` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs">
          <span className="mb-1 block" style={{ color: "var(--muted)" }}>Brand</span>
          <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <div className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)} className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
              style={tab === t.k ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === "planner"
        ? <MonthPlanner workspaceId={workspaceId} pillars={pillars} />
        : <PillarsManager workspaceId={workspaceId} pillars={pillars} />}
    </div>
  );
}
