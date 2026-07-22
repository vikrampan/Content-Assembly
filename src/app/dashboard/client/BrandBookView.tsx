import { accentOf, brandFonts, BrandStyle, clientWorkspace, SectionHeader } from "./shared";

function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ border: "1px solid var(--line)" }}>
      <span className="h-8 w-8 rounded" style={{ background: `#${hex}` }} />
      <div>
        <div className="font-medium">{label}</div>
        <div className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>#{hex}</div>
      </div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export async function BrandBookView() {
  const { supabase, ws } = await clientWorkspace();
  if (!ws) return <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your workspace isn&apos;t set up yet.</div>;
  const { faces, headlineFamily } = await brandFonts(supabase, ws);
  const accent = accentOf(ws);

  if (ws.brand_status !== "locked") {
    return (
      <div className="space-y-5">
        <BrandStyle faces={faces} />
        <SectionHeader title="Brand Book" family={headlineFamily} />
        <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your brand book is being prepared by the team — it&apos;ll appear here once it&apos;s locked.</div>
      </div>
    );
  }

  const book = ws.brand_book ?? {};
  return (
    <div className="space-y-6">
      <BrandStyle faces={faces} />
      <SectionHeader title="Brand Book" subtitle="Your brand identity — the constitution every post is built from." family={headlineFamily} />

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Colours</h2>
        <div className="flex flex-wrap gap-2">
          {ws.primary_hex ? <Swatch hex={ws.primary_hex} label="Primary" /> : null}
          {ws.secondary_hex ? <Swatch hex={ws.secondary_hex} label="Secondary" /> : null}
          {ws.accent_hex ? <Swatch hex={ws.accent_hex} label="Accent" /> : null}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Voice &amp; identity</h2>
        <div className="divide-y" style={{ borderColor: "var(--line)" }}>
          <Row label="Tagline" value={book.identity?.tagline ?? null} />
          <Row label="Mission" value={book.identity?.mission ?? null} />
          <Row label="Audience" value={book.identity?.audience ?? null} />
          <Row label="Voice & tone" value={ws.voice_tone} />
          <Row label="Photography" value={ws.photography_style} />
          <Row label="Do" value={ws.do_rules} />
          <Row label="Never" value={ws.never_rules} />
          <Row label="Typography" value={[ws.headline_font, ws.body_font].filter(Boolean).join(" · ") || null} />
        </div>
      </section>

      <div className="h-1 w-16 rounded-full" style={{ background: accent }} />
    </div>
  );
}
