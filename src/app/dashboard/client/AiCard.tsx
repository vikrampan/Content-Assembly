"use client";

import { useState, useTransition } from "react";
import { aiHomeDigest, aiInsightsSummary, type AiReply } from "../aiClient";

function pct(b?: { used: number; limit: number }) {
  if (!b || !b.limit) return 0;
  return Math.min(100, Math.round((b.used / b.limit) * 100));
}

export function AiCard({ kind, title, subtitle, cta }: {
  kind: "digest" | "insights";
  title: string;
  subtitle: string;
  cta: string;
}) {
  const [reply, setReply] = useState<AiReply | null>(null);
  const [pending, start] = useTransition();

  function go() {
    setReply(null);
    start(async () => setReply(kind === "digest" ? await aiHomeDigest() : await aiInsightsSummary()));
  }

  return (
    <section className="card overflow-hidden" data-tour="ai">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"
        style={{ background: "linear-gradient(120deg, var(--accent-soft), transparent 70%)" }}>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: "var(--accent)", color: "#fff" }}>✦</span>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>{subtitle}</div>
          </div>
        </div>
        <button type="button" onClick={go} disabled={pending}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
          style={{ background: "var(--accent)" }}>
          {pending ? "Thinking…" : reply?.text ? "Refresh" : cta}
        </button>
      </div>

      {pending ? (
        <div className="space-y-2 px-4 pb-5 sm:px-5">
          <div className="h-3 w-3/4 animate-pulse rounded" style={{ background: "var(--panel-2)" }} />
          <div className="h-3 w-full animate-pulse rounded" style={{ background: "var(--panel-2)" }} />
          <div className="h-3 w-5/6 animate-pulse rounded" style={{ background: "var(--panel-2)" }} />
        </div>
      ) : reply?.text ? (
        <div className="px-4 pb-4 sm:px-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{reply.text}</p>
          {reply.budget ? (
            <div className="mt-4 flex items-center gap-2 border-t pt-3 text-[11px]" style={{ borderColor: "var(--line)", color: "var(--faint)" }}>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct(reply.budget)}%`, background: pct(reply.budget) > 85 ? "var(--danger)" : "var(--accent)" }} />
              </div>
              <span>{pct(reply.budget)}% of this month&apos;s AI used</span>
            </div>
          ) : null}
        </div>
      ) : reply?.error ? (
        <div className="px-4 pb-4 text-sm sm:px-5" style={{ color: reply.overBudget ? "var(--accent-ink)" : "var(--danger)" }}>{reply.error}</div>
      ) : null}
    </section>
  );
}
