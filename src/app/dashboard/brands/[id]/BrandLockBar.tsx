"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBrandLock } from "../actions";

export function BrandLockBar({
  workspaceId,
  status,
  lockedAt,
  filled,
  total,
}: {
  workspaceId: string;
  status: "draft" | "locked";
  lockedAt: string | null;
  filled: number;
  total: number;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const locked = status === "locked";
  const pct = Math.round((filled / total) * 100);

  function toggle() {
    setMsg(null);
    start(async () => {
      const res = await setBrandLock(workspaceId, !locked);
      if ("error" in res) setMsg(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="card flex flex-wrap items-center gap-4 p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`pill ${locked ? "approved" : "pending"}`}>{locked ? "Locked" : "Draft"}</span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {locked ? `Locked${lockedAt ? ` ${new Date(lockedAt).toLocaleDateString()}` : ""} — every desk builds from this.` : "Fill the book, then lock it to start production."}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 w-40 overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "var(--good)" : "var(--accent)" }} />
          </div>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--faint)" }}>{filled}/{total} core fields</span>
        </div>
      </div>
      <button type="button" onClick={toggle} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        style={locked ? { border: "1px solid var(--line-2)", color: "var(--ink)" } : { background: "var(--good)", color: "#fff" }}>
        {pending ? "…" : locked ? "Unlock to edit" : "Lock brand book"}
      </button>
      {msg ? <div className="w-full text-xs" style={{ color: "var(--danger)" }}>{msg}</div> : null}
    </div>
  );
}
