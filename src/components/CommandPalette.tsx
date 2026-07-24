"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABEL } from "@/lib/mendly/stages";
import { globalSearch } from "@/app/dashboard/actions";

type Results = { brands: { id: string; name: string }[]; posts: { id: string; title: string; stage: string }[] };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results>({ brands: [], posts: [] });
  const [, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); else { setQ(""); setRes({ brands: [], posts: [] }); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => start(async () => setRes(await globalSearch(q))), 200);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(href: string) { setOpen(false); router.push(href); }

  if (!open) return null;
  const empty = res.brands.length === 0 && res.posts.length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" style={{ background: "rgba(0,0,0,.45)" }} onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: "var(--faint)" }}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.3-4.3" /></svg>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brands and posts…" className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--ink)" }} />
          <kbd className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--panel-2)", color: "var(--faint)" }}>esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--muted)" }}>Type to search across every brand and post.</div>
          ) : empty ? (
            <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--muted)" }}>No matches.</div>
          ) : (
            <>
              {res.brands.length > 0 ? (
                <div className="mb-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Brands</div>
                  {res.brands.map((b) => (
                    <button key={b.id} type="button" onClick={() => go(`/dashboard/brands/${b.id}`)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-black/[0.04] dark:hover:bg-white/[0.05]">
                      <span>◆</span>{b.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {res.posts.length > 0 ? (
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Posts</div>
                  {res.posts.map((p) => (
                    <button key={p.id} type="button" onClick={() => go(`/dashboard/content/${p.id}`)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-black/[0.04] dark:hover:bg-white/[0.05]">
                      <span className="flex-1 truncate">{p.title}</span>
                      <span className="pill scheduled">{STAGE_LABEL[p.stage] ?? p.stage}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
