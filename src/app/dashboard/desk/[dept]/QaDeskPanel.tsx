"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateBrandChecklist } from "@/app/dashboard/content/[id]/actions";

export interface QaAnalytics {
  total: number;
  passed: number;
  rejected: number;
  firstPassRate: number;
  topReasons: { reason: string; count: number }[];
}
export interface BrandFw { id: string; name: string; hasChecklist: boolean }

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint ? <div className="text-xs" style={{ color: "var(--muted)" }}>{hint}</div> : null}
    </div>
  );
}

export function QaDeskPanel({ analytics, brands }: { analytics: QaAnalytics; brands: BrandFw[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  function generate(id: string) {
    setMsg(null); setBusy(id);
    start(async () => {
      const res = await generateBrandChecklist(id);
      if ("error" in res) setMsg(res.error);
      setBusy(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
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

      <section>
        <h2 className="mb-2 text-sm font-semibold">Brand firewalls</h2>
        <p className="mb-2 text-xs" style={{ color: "var(--muted)" }}>Generate a firewall specific to each brand&apos;s locked book — sharper than the default 16 checks.</p>
        {msg ? <div className="mb-2 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>{msg}</div> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {brands.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
              <div className="flex-1">
                <div className="text-sm font-medium">{b.name}</div>
                <div className="text-[11px]" style={{ color: b.hasChecklist ? "var(--good)" : "var(--faint)" }}>{b.hasChecklist ? "Brand firewall active" : "Using default firewall"}</div>
              </div>
              <button type="button" onClick={() => generate(b.id)} disabled={busy === b.id} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
                {busy === b.id ? "Generating…" : b.hasChecklist ? "Regenerate" : "✦ Generate"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
