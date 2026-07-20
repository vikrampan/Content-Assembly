"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BrandBook } from "@/lib/types";
import { saveBrandBook } from "../actions";
import { SECTIONS, getPath, setPath, type Kind } from "./brandFields";

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

export function BrandBookSections({ workspaceId, initial }: { workspaceId: string; initial: BrandBook }) {
  const [book, setBook] = useState<BrandBook>(initial ?? {});
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function field(base: string, path: string, label: string, kind?: Kind) {
    const full = `${base}.${path}`;
    const isList = kind === "list";
    const raw = getPath(book, full);
    const val = isList ? (Array.isArray(raw) ? raw.join("\n") : "") : (raw ?? "");
    const onChange = (v: string) => {
      setDirty(true);
      setBook((cur) => setPath(cur, full, isList ? v.split("\n").map((s) => s.trim()).filter(Boolean) : v) as BrandBook);
    };
    return (
      <label key={full} className="block text-xs">
        <span className="mb-1 block" style={{ color: "var(--muted)" }}>{label}</span>
        {kind === "area" || isList ? (
          <textarea value={String(val)} onChange={(e) => onChange(e.target.value)} rows={isList ? 3 : 2} placeholder={isList ? "one per line" : ""} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        ) : (
          <input value={String(val)} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        )}
      </label>
    );
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveBrandBook(workspaceId, book);
      if ("error" in res) setMsg({ kind: "err", text: res.error });
      else { setMsg({ kind: "ok", text: "Saved." }); setDirty(false); router.refresh(); }
    });
  }

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Story, voice &amp; messaging</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>The narrative every desk builds from — beyond colours and type.</p>
        </div>
        {dirty ? <span className="text-[11px]" style={{ color: "var(--accent-ink)" }}>unsaved</span> : null}
      </div>

      <div className="space-y-5">
        {SECTIONS.map((sec) => (
          <div key={sec.base}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{sec.title}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {sec.fields.map((f) => field(sec.base, f.path, f.label, f.kind))}
            </div>
          </div>
        ))}
      </div>

      {msg ? <div className="mt-3 text-xs" style={{ color: msg.kind === "ok" ? "var(--good)" : "var(--danger)" }}>{msg.text}</div> : null}
      <button type="button" onClick={save} disabled={pending || !dirty} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
        {pending ? "Saving…" : "Save story & messaging"}
      </button>
    </section>
  );
}
