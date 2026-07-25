"use client";

import { aiHomeDigest, aiInsightsSummary, type AiReply } from "../aiClient";
import { useAsync } from "@/components/ui/useAsync";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/States";

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
  const job = useAsync<AiReply>();
  const reply = job.data;

  function go() {
    job.run(() => (kind === "digest" ? aiHomeDigest() : aiInsightsSummary()));
  }

  const hasText = job.status === "success" && reply?.text;
  const logicalError = job.status === "success" && reply?.error; // e.g. over budget / no data

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
        <button type="button" onClick={go} disabled={job.isLoading}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
          style={{ background: "var(--accent)" }}>
          {job.isLoading ? <><Spinner size={14} /> Thinking…</> : hasText ? "Refresh" : cta}
        </button>
      </div>

      {/* Loading state */}
      {job.isLoading ? (
        <div className="px-4 pb-5 sm:px-5"><SkeletonText lines={3} /></div>
      ) : null}

      {/* Success state */}
      {hasText ? (
        <div className="px-4 pb-4 sm:px-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{reply!.text}</p>
          {reply!.budget ? (
            <div className="mt-4 flex items-center gap-2 border-t pt-3 text-[11px]" style={{ borderColor: "var(--line)", color: "var(--faint)" }}>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct(reply!.budget)}%`, background: pct(reply!.budget) > 85 ? "var(--danger)" : "var(--accent)" }} />
              </div>
              <span>{pct(reply!.budget)}% of this month&apos;s AI used</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Logical error (budget / no data) — informational, not a failure */}
      {logicalError ? (
        <div className="px-4 pb-4 text-sm sm:px-5" style={{ color: reply?.overBudget ? "var(--accent-ink)" : "var(--muted)" }}>{reply!.error}</div>
      ) : null}

      {/* Network / unexpected error — with retry */}
      {job.status === "error" ? (
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4 text-sm sm:px-5">
          <span style={{ color: job.offline ? "var(--ink)" : "var(--danger)" }}>
            {job.offline ? "📡 You're offline — reconnect and try again." : `⚠️ ${job.error}`}
          </span>
          <button type="button" onClick={go} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>↻ Try again</button>
        </div>
      ) : null}
    </section>
  );
}
