import type { ContentItem, PostMetric } from "@/lib/types";
import { ClientAnalytics } from "../ClientAnalytics";
import { accentOf, brandFonts, BrandStyle, clientWorkspace, SectionHeader } from "./shared";

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

function Spark({ data, accent }: { data: number[]; accent: string }) {
  if (data.length < 2) return null;
  const w = 120, h = 32, max = Math.max(...data), min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export async function InsightsView() {
  const { supabase, ws } = await clientWorkspace();
  if (!ws) return <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your workspace isn&apos;t set up yet.</div>;
  const accent = accentOf(ws);
  const { faces, headlineFamily } = await brandFonts(supabase, ws);

  const [{ data: metricRaw }, { data: postRaw }] = await Promise.all([
    supabase.from("post_metrics").select("*"),
    supabase.from("content_items").select("*").in("stage", ["scheduling", "published"]).order("updated_at", { ascending: false }),
  ]);
  const metrics = (metricRaw as PostMetric[]) ?? [];
  const posts = (postRaw as ContentItem[]) ?? [];
  const titleOf = new Map(posts.map((p) => [p.id, p.title]));

  // Per-post aggregation.
  const byPost = new Map<string, { reach: number; engagement: number; saves: number; series: [string, number][] }>();
  for (const m of metrics) {
    const cur = byPost.get(m.content_id) ?? { reach: 0, engagement: 0, saves: 0, series: [] };
    cur.reach += m.reach; cur.engagement += m.engagement; cur.saves += m.saves;
    cur.series.push([m.day, m.reach]);
    byPost.set(m.content_id, cur);
  }
  const perPost = [...byPost.entries()]
    .map(([id, v]) => ({ id, title: titleOf.get(id) ?? "Post", ...v, series: v.series.sort((a, b) => a[0].localeCompare(b[0])).map((s) => s[1]) }))
    .sort((a, b) => b.reach - a.reach);

  return (
    <div className="space-y-6">
      <BrandStyle faces={faces} />
      <SectionHeader title="Analytics" subtitle="How your posts are performing." family={headlineFamily} />

      {/* Overall */}
      <ClientAnalytics metrics={metrics} posts={posts} accent={accent} />

      {/* Per-post */}
      {perPost.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>Post by post</h2>
          <div className="space-y-2">
            {perPost.map((p) => (
              <div key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-[160px] flex-1">
                  <div className="text-sm font-semibold">{p.title}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--faint)" }}>Reach {fmt(p.reach)} · Engagements {fmt(p.engagement)} · Saves {fmt(p.saves)}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold tabular-nums">{fmt(p.reach)}</div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>reach</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold tabular-nums" style={{ color: accent }}>{p.reach ? ((p.engagement / p.reach) * 100).toFixed(1) : "0"}%</div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>engaged</div>
                  </div>
                  <Spark data={p.series} accent={accent} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>Post analytics appear here once your posts go live.</div>
      )}
    </div>
  );
}
