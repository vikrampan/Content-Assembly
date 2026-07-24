export interface QaAnalytics {
  total: number;
  passed: number;
  rejected: number;
  firstPassRate: number;
  topReasons: { reason: string; count: number }[];
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint ? <div className="text-xs" style={{ color: "var(--muted)" }}>{hint}</div> : null}
    </div>
  );
}

export function QaDeskPanel({ analytics }: { analytics: QaAnalytics }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">QA analytics</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="First-pass rate" value={`${analytics.firstPassRate}%`} hint="passed without rework" />
        <Stat label="Reviews" value={analytics.total} hint={`${analytics.passed} passed · ${analytics.rejected} sent back`} />
        <Stat label="Passed" value={analytics.passed} />
        <Stat label="Sent back" value={analytics.rejected} />
      </div>
      {analytics.topReasons.length > 0 ? (
        <div className="card mt-3 p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Top reject reasons</div>
          <div className="space-y-1.5">
            {analytics.topReasons.map((r) => (
              <div key={r.reason} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{r.reason}</span>
                <span className="tabular-nums font-semibold" style={{ color: "var(--danger)" }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
