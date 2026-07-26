"use client";

// Slim brand-book completeness nudge. The AI itself lives in the one Assistant —
// this just shows progress and opens the assistant primed to fill the gaps.

export function BrandCompleteBanner({ filled, total }: { filled: number; total: number }) {
  const pct = total ? Math.round((filled / total) * 100) : 100;
  const done = pct >= 100;

  function ask() {
    window.dispatchEvent(new CustomEvent("assistant:open", { detail: { prompt: "Fill in anything that's empty", mode: "brand" } }));
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5" style={{ background: "linear-gradient(120deg, var(--accent-soft), transparent 70%)" }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: "var(--accent)", color: "#fff" }}>✦</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            {done ? "Your brand book is complete ✓" : `Your brand book is ${pct}% complete`}
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="h-1.5 w-40 max-w-full overflow-hidden rounded-full" style={{ background: "var(--panel)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? "var(--good)" : "var(--accent)" }} />
            </div>
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: done ? "var(--good)" : "var(--accent-ink)" }}>{filled}/{total}</span>
          </div>
        </div>
        <button type="button" onClick={ask} className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105" style={{ background: "var(--accent)" }}>
          {done ? "✦ Refine with AI" : "✦ Fill the rest"}
        </button>
      </div>
    </section>
  );
}
