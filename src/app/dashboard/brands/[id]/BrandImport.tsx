"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BrandBook } from "@/lib/types";
import { applyBrandImport, extractBrandFromAssets } from "../actions";
import type { BrandDraft } from "@/lib/ai/brandExtract";
import { CORE, SECTIONS, getPath, setPath, type Kind } from "./brandFields";

type Phase = "idle" | "working" | "review" | "done";

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

function Conf({ v }: { v: number | undefined }) {
  if (v == null) return null;
  const pct = Math.round(v * 100);
  const col = v >= 0.75 ? "var(--good)" : v >= 0.5 ? "var(--accent)" : "var(--danger)";
  return <span className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ color: col, border: `1px solid ${col}` }}>{pct}%</span>;
}

export function BrandImport({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [draft, setDraft] = useState<{ fields: Record<string, unknown>; book: BrandBook }>({ fields: {}, book: {} });
  const [conf, setConf] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, start] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null); setSkipped([]); setPhase("working"); setStatus("Uploading document…");
    setSourceName(Array.from(files).map((f) => f.name).join(", "));
    const supabase = createClient();
    try {
      const paths: string[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${workspaceId}/import-${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from("assets").upload(path, file);
        if (error) throw error;
        await supabase.from("assets").insert({ workspace_id: workspaceId, storage_path: path, kind: "brand", label: file.name });
        paths.push(path);
      }
      setStatus("Reading your brand with AI… this can take ~15–30s.");
      const res = await extractBrandFromAssets(workspaceId, paths);
      if ("error" in res) { setErr(res.error); setPhase("idle"); return; }
      const d = res.draft as BrandDraft;
      setDraft({ fields: { ...d.fields }, book: d.brand_book });
      setConf(d.confidence ?? {});
      setSkipped(res.skipped);
      setPhase("review");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
      setPhase("idle");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function apply() {
    setPhase("working"); setStatus("Applying to the brand book…"); setErr(null);
    start(async () => {
      const res = await applyBrandImport(workspaceId, draft.fields, draft.book, sourceName);
      if ("error" in res) { setErr(res.error); setPhase("review"); return; }
      setPhase("done");
      router.refresh();
    });
  }

  function field(fullPath: string, label: string, kind: Kind | undefined, confKey: string) {
    const isList = kind === "list";
    const raw = getPath(draft, fullPath);
    const val = isList ? (Array.isArray(raw) ? raw.join("\n") : "") : (raw ?? "");
    const onChange = (v: string) =>
      setDraft((cur) => setPath(cur, fullPath, isList ? v.split("\n").map((s) => s.trim()).filter(Boolean) : v));
    return (
      <label key={fullPath} className="block text-xs">
        <span className="mb-1 flex items-center" style={{ color: "var(--muted)" }}>{label}<Conf v={conf[confKey] ?? conf[fullPath]} /></span>
        {kind === "hex" ? (
          <div className="flex items-center gap-2">
            <input type="color" value={`#${(String(val) || "cccccc").replace(/^#/, "")}`} onChange={(e) => onChange(e.target.value.replace("#", ""))} className="h-9 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
            <input value={String(val)} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          </div>
        ) : kind === "area" || isList ? (
          <textarea value={String(val)} onChange={(e) => onChange(e.target.value)} rows={isList ? 3 : 2} placeholder={isList ? "one per line" : ""} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        ) : (
          <input value={String(val)} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        )}
      </label>
    );
  }

  const paletteCount = Array.isArray((draft.fields as { palette?: unknown[] }).palette) ? ((draft.fields as { palette?: unknown[] }).palette as unknown[]).length : 0;

  return (
    <section className="card overflow-hidden" style={{ borderColor: "var(--accent)" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: "var(--accent)" }}>✦</span>
        <div className="flex-1">
          <div className="text-sm font-semibold">Import from a brand document (AI)</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>Upload a brand deck or guidelines (PDF / image) — AI fills the whole book for you to review.</div>
        </div>
        <span style={{ color: "var(--faint)" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <div className="border-t p-4" style={{ borderColor: "var(--line)" }}>
          {phase === "idle" ? (
            <div className="rounded-xl p-6 text-center" style={{ border: "1px dashed var(--line-2)" }}>
              <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>Drop in your existing brand book — PDF, PNG/JPG, or TXT.</p>
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105" style={{ background: "var(--accent)" }}>Choose document(s)</button>
              <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md" className="hidden" onChange={(e) => onFiles(e.target.files)} />
              {err ? <div className="mt-3 text-xs" style={{ color: "var(--danger)" }}>{err}</div> : null}
            </div>
          ) : null}

          {phase === "working" ? (
            <div className="flex items-center gap-3 rounded-xl p-6" style={{ background: "var(--panel-2)" }}>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--muted)" }}>{status}</span>
            </div>
          ) : null}

          {phase === "review" ? (
            <div className="space-y-5">
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
                Review &amp; edit what the AI found, then apply. Percentages are the AI&apos;s confidence.
                {paletteCount ? ` ${paletteCount} palette colour(s) detected and will be applied.` : ""}
                {skipped.length ? ` Skipped (unsupported): ${skipped.join(", ")}.` : ""}
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Core brand</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CORE.map((d) => field(d.path, d.label, d.kind, d.path.split(".").pop() as string))}
                </div>
              </div>

              {SECTIONS.map((sec) => {
                const has = sec.fields.some((f) => {
                  const raw = getPath(draft, `book.${sec.base}.${f.path}`);
                  return raw != null && (Array.isArray(raw) ? raw.length : String(raw).trim());
                });
                if (!has) return null;
                return (
                  <div key={sec.base}>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{sec.title}</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {sec.fields.map((f) => field(`book.${sec.base}.${f.path}`, f.label, f.kind, f.path))}
                    </div>
                  </div>
                );
              })}

              {err ? <div className="text-xs" style={{ color: "var(--danger)" }}>{err}</div> : null}
              <div className="flex gap-2">
                <button type="button" onClick={apply} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105" style={{ background: "var(--good)" }}>Apply to brand book</button>
                <button type="button" onClick={() => setPhase("idle")} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Discard</button>
              </div>
            </div>
          ) : null}

          {phase === "done" ? (
            <div className="rounded-xl p-6 text-center" style={{ background: "var(--good-soft)" }}>
              <div className="text-sm font-semibold" style={{ color: "var(--good)" }}>Brand book updated ✓</div>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Scroll down to review the Visual Kit, DNA, and Story sections. The previous version was saved to History.</p>
              <button type="button" onClick={() => { setPhase("idle"); setOpen(false); }} className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Done</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
