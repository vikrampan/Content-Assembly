import type { ContentItem, PostMetric } from "@/lib/types";

// Deterministic pseudo-random so the preview is stable across renders.
function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

interface Series {
  days: { label: string; reach: number }[];
  totals: { reach: number; engagement: number; impressions: number; saves: number };
  top: { title: string; engagement: number }[];
  engagementRate: number;
  sample: boolean;
}

function buildSeries(metrics: PostMetric[], posts: ContentItem[]): Series {
  if (metrics.length > 0) {
    const byDay = new Map<string, number>();
    let reach = 0, engagement = 0, impressions = 0, saves = 0;
    for (const m of metrics) {
      byDay.set(m.day, (byDay.get(m.day) ?? 0) + m.reach);
      reach += m.reach; engagement += m.engagement; impressions += m.impressions; saves += m.saves;
    }
    const days = [...byDay.entries()].sort().slice(-14).map(([d, r]) => ({
      label: new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      reach: r,
    }));
    const byPost = new Map<string, number>();
    for (const m of metrics) byPost.set(m.content_id, (byPost.get(m.content_id) ?? 0) + m.engagement);
    const titleOf = new Map(posts.map((p) => [p.id, p.title]));
    const top = [...byPost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, e]) => ({ title: titleOf.get(id) ?? "Post", engagement: e }));
    return { days, totals: { reach, engagement, impressions, saves }, top, engagementRate: impressions ? (engagement / impressions) * 100 : 0, sample: false };
  }

  // Preview mode — representative shape, clearly labelled as sample.
  const rnd = seeded((posts.length + 7) * 101);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), reach: Math.round(1800 + rnd() * 2600 + i * 90) };
  });
  const reach = days.reduce((a, b) => a + b.reach, 0);
  const impressions = Math.round(reach * 1.6);
  const engagement = Math.round(reach * (0.05 + rnd() * 0.03));
  const saves = Math.round(engagement * 0.22);
  const sampleTitles = posts.slice(0, 5).map((p) => p.title);
  while (sampleTitles.length < 5) sampleTitles.push(["Behind the pass", "Weekend special", "Meet the team", "New on the menu", "Sourced locally"][sampleTitles.length]);
  const top = sampleTitles.map((title) => ({ title, engagement: Math.round(300 + rnd() * 1400) })).sort((a, b) => b.engagement - a.engagement);
  return { days, totals: { reach, engagement, impressions, saves }, top, engagementRate: (engagement / impressions) * 100, sample: true };
}

function AreaChart({ data, accent }: { data: { label: string; reach: number }[]; accent: string }) {
  const W = 640, H = 150, P = 8;
  const max = Math.max(...data.map((d) => d.reach), 1);
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(data.length - 1, 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.reach).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].reach)} r="4" fill={accent} />
    </svg>
  );
}

function Donut({ pct, accent }: { pct: number; accent: string }) {
  const r = 42, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(pct / 100, 1));
  return (
    <svg viewBox="0 0 110 110" className="h-28 w-28">
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="12" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={accent} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 55 55)" />
      <text x="55" y="52" textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--ink)">{pct.toFixed(1)}%</text>
      <text x="55" y="68" textAnchor="middle" fontSize="8.5" fill="var(--faint)">engagement</text>
    </svg>
  );
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

export function ClientAnalytics({ metrics, posts, accent }: { metrics: PostMetric[]; posts: ContentItem[]; accent: string }) {
  const s = buildSeries(metrics, posts);
  const maxTop = Math.max(...s.top.map((t) => t.engagement), 1);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>Performance</h2>
        {s.sample ? <span className="pill scheduled">Preview · connects to live data once Meta is linked</span> : null}
      </div>

      <div className="mb-3.5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Reach (14d)", v: fmt(s.totals.reach) },
          { l: "Impressions", v: fmt(s.totals.impressions) },
          { l: "Engagements", v: fmt(s.totals.engagement) },
          { l: "Saves", v: fmt(s.totals.saves) },
        ].map((k) => (
          <div key={k.l} className="card p-4">
            <div className="text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{k.l}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums" style={{ letterSpacing: "-.02em" }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-5">
          <div className="mb-3 text-sm font-semibold">Reach — last 14 days</div>
          <AreaChart data={s.days} accent={accent} />
          <div className="mt-2 flex justify-between text-[10px]" style={{ color: "var(--faint)" }}>
            <span>{s.days[0]?.label}</span>
            <span>{s.days[s.days.length - 1]?.label}</span>
          </div>
        </div>
        <div className="card flex flex-col items-center justify-center gap-2 p-5">
          <div className="self-start text-sm font-semibold">Engagement rate</div>
          <Donut pct={s.engagementRate} accent={accent} />
          <div className="text-xs" style={{ color: "var(--muted)" }}>of impressions engaged</div>
        </div>
      </div>

      <div className="card mt-3.5 p-5">
        <div className="mb-3 text-sm font-semibold">Top posts by engagement</div>
        <div className="flex flex-col gap-3">
          {s.top.map((t, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{t.title}</span>
                <span className="tabular-nums font-semibold" style={{ color: "var(--muted)" }}>{fmt(t.engagement)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${(t.engagement / maxTop) * 100}%`, background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 55%, #e0b36a))` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
