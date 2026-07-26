"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aiBrandBookDraft, type BrandChange } from "../aiClient";
import { applyBrandPatch } from "../brands/actions";
import { useAsync } from "@/components/ui/useAsync";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

interface Item extends BrandChange { on: boolean }

const CHIPS = [
  "Write my mission and a tagline",
  "Improve my brand voice",
  "Fill in anything that's empty",
  "Write my elevator pitch",
];

function pctOf(b?: { used: number; limit: number }) {
  return b && b.limit ? Math.min(100, Math.round((b.used / b.limit) * 100)) : 0;
}

export function BrandBookCopilot({ workspaceId, filled = 0, total = 0 }: { workspaceId: string; filled?: number; total?: number }) {
  const complete = total ? Math.round((filled / total) * 100) : 100;
  const missing = Math.max(0, total - filled);
  const [input, setInput] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const job = useAsync<Awaited<ReturnType<typeof aiBrandBookDraft>>>();
  const [applying, startApply] = useTransition();
  const toast = useToast();
  const router = useRouter();

  async function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setInput(q);
    setItems(null);
    const r = await job.run(() => aiBrandBookDraft(q));
    if (r?.changes?.length) setItems(r.changes.map((c) => ({ ...c, on: true })));
  }

  function apply() {
    const chosen = (items ?? []).filter((i) => i.on);
    if (chosen.length === 0) return;
    startApply(async () => {
      const res = await applyBrandPatch(workspaceId, chosen.map((c) => ({ path: c.path, value: c.value })));
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(`Applied ${chosen.length} change${chosen.length > 1 ? "s" : ""} ✓`);
      setItems(null); job.reset(); setInput("");
      router.refresh();
    });
  }

  const reply = job.data;
  const infoOnly = job.status === "success" && !items && reply?.text;
  const selectedCount = (items ?? []).filter((i) => i.on).length;

  return (
    <section className="card overflow-hidden" data-tour="brand-copilot">
      <div className="p-4 sm:p-5" style={{ background: "linear-gradient(120deg, var(--accent-soft), transparent 70%)" }}>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: "var(--accent)", color: "#fff" }}>✦</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Brand Book assistant</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {missing > 0
                ? `Your brand book is ${complete}% complete — I can fill the rest.`
                : "Ask me to refine or rewrite any part of your brand."}
            </div>
          </div>
        </div>

        {/* Completeness meter */}
        {total > 0 ? (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--panel)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${complete}%`, background: complete >= 100 ? "var(--good)" : "var(--accent)" }} />
            </div>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: complete >= 100 ? "var(--good)" : "var(--accent-ink)" }}>
              {complete >= 100 ? "Complete ✓" : `${filled}/${total} filled`}
            </span>
          </div>
        ) : null}

        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. write my mission and a warm, premium tagline"
            className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
          <button type="submit" disabled={job.isLoading || !input.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60" style={{ background: "var(--accent)" }}>
            {job.isLoading ? <><Spinner size={14} color="#fff" /> Drafting…</> : "✦ Ask"}
          </button>
        </form>

        {!items && !job.isLoading ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => ask(c)} className="rounded-full px-2.5 py-1 text-xs font-medium transition hover:brightness-95"
                style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{c}</button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Loading */}
      {job.isLoading ? <div className="p-4 sm:p-5"><SkeletonText lines={3} /></div> : null}

      {/* Network / error */}
      {job.status === "error" ? (
        <div className="flex flex-wrap items-center gap-3 p-4 text-sm sm:px-5">
          <span style={{ color: job.offline ? "var(--ink)" : "var(--danger)" }}>{job.offline ? "📡 You're offline — reconnect and try again." : `⚠️ ${job.error}`}</span>
          <button type="button" onClick={() => ask(input)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>↻ Try again</button>
        </div>
      ) : null}

      {/* Info-only reply (no changes / over budget) */}
      {infoOnly ? (
        <div className="p-4 text-sm sm:px-5" style={{ color: reply?.overBudget ? "var(--accent-ink)" : "var(--muted)" }}>{reply?.error ?? reply?.text}</div>
      ) : null}

      {/* Proposal — review & apply */}
      {items && items.length > 0 ? (
        <div className="p-4 sm:p-5">
          {reply?.note ? <p className="mb-3 text-sm" style={{ color: "var(--ink)" }}>{reply.note}</p> : null}
          <div className="space-y-2">
            {items.map((it, i) => (
              <label key={i} className="flex cursor-pointer gap-3 rounded-xl p-3 transition" style={{ background: it.on ? "var(--accent-soft)" : "var(--panel-2)", border: `1px solid ${it.on ? "var(--accent)" : "var(--line)"}` }}>
                <input type="checkbox" checked={it.on} onChange={() => setItems((cur) => (cur ?? []).map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--accent-ink)" }}>{it.label}</div>
                  <div className="mt-0.5 whitespace-pre-wrap text-sm">{it.value}</div>
                  {it.current ? <div className="mt-1 text-xs line-through" style={{ color: "var(--faint)" }}>{it.current.length > 90 ? it.current.slice(0, 90) + "…" : it.current}</div> : null}
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={apply} disabled={applying || selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--good)" }}>
              {applying ? <><Spinner size={14} color="#fff" /> Applying…</> : `Apply ${selectedCount} change${selectedCount === 1 ? "" : "s"}`}
            </button>
            <button type="button" onClick={() => { setItems(null); job.reset(); }} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Discard</button>
            {reply?.budget ? (
              <span className="ml-auto text-[11px]" style={{ color: "var(--faint)" }}>{pctOf(reply.budget)}% of this month&apos;s AI used</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
