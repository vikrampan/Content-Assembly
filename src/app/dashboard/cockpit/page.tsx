import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STAGES, STAGE_LABEL } from "@/lib/mendly/stages";
import { integrationStatus } from "@/lib/integrations";
import type { ContentItem, Workspace } from "@/lib/types";

function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums" style={{ letterSpacing: "-.02em" }}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{hint}</div> : null}
    </div>
  );
}

const DNA_FIELDS = (w: Workspace) => [w.primary_hex, w.secondary_hex, w.headline_font, w.body_font, w.voice_tone, w.do_rules, w.never_rules, w.photography_style, w.logo_path];

export default async function CockpitPage() {
  await requireAccess("cockpit");
  const supabase = await createClient();

  const [{ data: wsRaw }, { data: itemsRaw }, { data: reviewsRaw }] = await Promise.all([
    supabase.from("workspaces").select("*").order("name"),
    supabase.from("content_items").select("*"),
    supabase.from("qa_reviews").select("result, reasons"),
  ]);
  const brands = (wsRaw as Workspace[]) ?? [];
  const items = (itemsRaw as ContentItem[]) ?? [];
  const reviews = (reviewsRaw as { result: string; reasons: string | null }[]) ?? [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const count = (s: string[]) => items.filter((i) => s.includes(i.stage)).length;
  const publishedThisMonth = items.filter((i) => i.stage === "published" && i.updated_at >= monthStart).length;
  const awaitingClient = count(["client_review"]);
  const inProduction = count(["content", "production"]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdue = items.filter((i) => i.due_date && i.due_date < todayStr && i.stage !== "published").length;

  // QA first-pass rate
  const qaPassed = reviews.filter((r) => r.result === "passed").length;
  const qaRejected = reviews.filter((r) => r.result === "rejected").length;
  const firstPass = reviews.length ? Math.round((qaPassed / reviews.length) * 100) : 0;
  const reasonCounts = new Map<string, number>();
  for (const r of reviews) {
    if (r.result !== "rejected" || !r.reasons) continue;
    for (const part of r.reasons.split("—")[0].split(",").map((s) => s.trim()).filter(Boolean)) reasonCounts.set(part, (reasonCounts.get(part) ?? 0) + 1);
  }
  const topReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const integrations = integrationStatus();

  // Stage distribution
  const stageCounts = STAGES.map((s) => ({ ...s, n: items.filter((i) => i.stage === s.key).length }));
  const maxStage = Math.max(...stageCounts.map((s) => s.n), 1);

  // Per-brand rollup
  const perBrand = brands.map((b) => {
    const mine = items.filter((i) => i.workspace_id === b.id);
    const dna = DNA_FIELDS(b);
    const filled = dna.filter((f) => f && String(f).trim()).length;
    return {
      b,
      total: mine.length,
      inFlight: mine.filter((i) => !["published"].includes(i.stage)).length,
      awaiting: mine.filter((i) => i.stage === "client_review").length,
      published: mine.filter((i) => i.stage === "published").length,
      health: Math.round((filled / dna.length) * 100),
      locked: b.brand_status === "locked",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl font-semibold" style={{ fontFamily: "Georgia, serif" }}>Agency Cockpit</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>Every brand, every desk — the health of the whole operation.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Brands" value={brands.length} />
        <Kpi label="Active posts" value={items.filter((i) => i.stage !== "published").length} />
        <Kpi label="In production" value={inProduction} />
        <Kpi label="Awaiting client" value={awaitingClient} />
        <Kpi label="Overdue" value={overdue} hint={overdue > 0 ? "past due date" : "on track"} />
        <Kpi label="QA first-pass" value={`${firstPass}%`} hint={`${qaRejected} sent back`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Stage distribution */}
        <div className="card p-5">
          <div className="mb-3 text-sm font-semibold">Pipeline load</div>
          <div className="space-y-2">
            {stageCounts.map((s) => (
              <div key={s.key} className="flex items-center gap-3 text-xs">
                <span className="w-24 shrink-0" style={{ color: "var(--muted)" }}>{s.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(s.n / maxStage) * 100}%`, background: "var(--accent)" }} />
                </div>
                <span className="w-6 text-right tabular-nums font-semibold">{s.n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* QA reject reasons */}
        <div className="card p-5">
          <div className="mb-3 text-sm font-semibold">Top QA reject reasons</div>
          {topReasons.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted)" }}>No rejections logged yet.</p>
          ) : (
            <div className="space-y-2">
              {topReasons.map(([reason, n]) => (
                <div key={reason} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{reason}</span>
                  <span className="tabular-nums font-semibold" style={{ color: "var(--danger)" }}>{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-brand health */}
      <div className="card overflow-x-auto p-0">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1.6fr_90px_90px_110px_90px_1fr] gap-2 border-b px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: "var(--line)", color: "var(--faint)" }}>
            <span>Brand</span><span>Total</span><span>In-flight</span><span>Awaiting</span><span>Live</span><span>Brand book</span>
          </div>
          {perBrand.map(({ b, total, inFlight, awaiting, published, health, locked }) => (
            <Link key={b.id} href={`/dashboard/brands/${b.id}`} className="grid grid-cols-[1.6fr_90px_90px_110px_90px_1fr] items-center gap-2 border-b px-4 py-3 text-sm transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]" style={{ borderColor: "var(--line)" }}>
              <span className="flex items-center gap-2 font-medium">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `#${b.primary_hex ?? "cccccc"}` }} />
                <span className="truncate">{b.name}</span>
              </span>
              <span className="tabular-nums">{total}</span>
              <span className="tabular-nums">{inFlight}</span>
              <span className="tabular-nums">{awaiting > 0 ? <span className="pill pending">{awaiting}</span> : "—"}</span>
              <span className="tabular-nums">{published}</span>
              <span className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${health}%`, background: health === 100 ? "var(--good)" : "var(--accent)" }} />
                </div>
                <span className={`pill ${locked ? "approved" : "pending"}`}>{locked ? "Locked" : `${health}%`}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      {/* Integrations & governance */}
      <div className="card p-5">
        <div className="mb-1 text-sm font-semibold">Integrations</div>
        <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>What&apos;s connected. Add the missing keys on the server (and Vercel) to switch each on.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {integrations.map((i) => (
            <div key={i.key} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--panel-2)" }}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: i.on ? "var(--good)" : "var(--line-2)" }}>{i.on ? "✓" : "•"}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{i.label} <span className="text-[11px]" style={{ color: i.on ? "var(--good)" : "var(--faint)" }}>{i.on ? "connected" : "not set"}</span></div>
                <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>{i.unlocks}</div>
              </div>
              {!i.on ? <code className="shrink-0 rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--panel)", color: "var(--faint)" }}>{i.env}</code> : null}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--faint)" }}>Live analytics (reach, engagement) light up here once Meta is connected. Pipeline runs {STAGE_LABEL[STAGES[0].key]} → {STAGE_LABEL[STAGES[STAGES.length - 1].key]}.</p>
    </div>
  );
}
