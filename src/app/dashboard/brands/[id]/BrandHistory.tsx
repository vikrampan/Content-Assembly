"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BrandBookVersion } from "@/lib/types";
import { restoreBrandVersion } from "../actions";

const SOURCE_LABEL: Record<string, string> = {
  ai_import: "AI import", manual: "Manual edit", lock: "Locked", restore: "Restore",
};

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function BrandHistory({ versions }: { versions: BrandBookVersion[] }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (versions.length === 0) return null;

  function restore(id: string) {
    if (!confirm("Restore this version? The current book is saved to history first.")) return;
    setMsg(null);
    start(async () => {
      const res = await restoreBrandVersion(id);
      if ("error" in res) setMsg(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-4 text-left">
        <h2 className="text-sm font-semibold">Version history</h2>
        <span className="pill scheduled">{versions.length}</span>
        <span className="ml-auto" style={{ color: "var(--faint)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="border-t p-4" style={{ borderColor: "var(--line)" }}>
          {msg ? <div className="mb-2 text-xs" style={{ color: "var(--danger)" }}>{msg}</div> : null}
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg p-2.5" style={{ background: "var(--panel-2)" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{SOURCE_LABEL[v.source ?? ""] ?? v.source ?? "Edit"}</span>
                    <span style={{ color: "var(--faint)" }}>· {ago(v.created_at)}</span>
                  </div>
                  {v.note ? <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>{v.note}</div> : null}
                </div>
                <button type="button" onClick={() => restore(v.id)} disabled={pending} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Restore</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
