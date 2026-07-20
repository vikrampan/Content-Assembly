"use client";

import { useState } from "react";
import type { AiPersona, ContentPillar, Workspace } from "@/lib/types";
import { MonthPlanner } from "./MonthPlanner";
import { PillarsManager } from "./PillarsManager";
import { StrategyDesk } from "./StrategyDesk";

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

export function StrategyCockpit({
  workspaces,
  personas,
  pillars,
}: {
  workspaces: Workspace[];
  personas: AiPersona[];
  pillars: ContentPillar[];
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [tab, setTab] = useState<"planner" | "pillars" | "quick">("planner");

  const pillarCount = pillars.filter((p) => p.workspace_id === workspaceId).length;
  const TABS = [
    { k: "planner" as const, label: "✦ Month Planner" },
    { k: "pillars" as const, label: `Pillars (${pillarCount})` },
    { k: "quick" as const, label: "Quick draft" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {tab !== "quick" ? (
          <label className="text-xs">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>Brand</span>
            <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        ) : null}
        <div className={`flex gap-1 ${tab !== "quick" ? "mt-4" : ""}`}>
          {TABS.map((t) => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)} className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
              style={tab === t.k ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === "planner" ? <MonthPlanner workspaceId={workspaceId} pillars={pillars} />
        : tab === "pillars" ? <PillarsManager workspaceId={workspaceId} pillars={pillars} />
        : <StrategyDesk workspaces={workspaces} personas={personas} />}
    </div>
  );
}
