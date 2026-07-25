import type { Workspace } from "@/lib/types";

function Swatch({ hex, label }: { hex: string; label: string }) {
  const clean = hex.replace(/^#/, "");
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
      <div className="h-16" style={{ background: `#${clean}` }} />
      <div className="px-2 py-1.5">
        <div className="text-[11px] font-semibold">{label}</div>
        <div className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>#{clean}</div>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "do" | "never" }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={tone === "do" ? { background: "var(--good-soft)", color: "var(--good)" } : { background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>
      {children}
    </span>
  );
}

export function BrandPreview({ brand, logoUrl, fontFaces }: { brand: Workspace; logoUrl: string | null; fontFaces: string[] }) {
  const accent = brand.accent_hex ? `#${brand.accent_hex}` : brand.primary_hex ? `#${brand.primary_hex}` : "#C8853F";
  const headlineFamily = brand.headline_font ? `"${brand.headline_font}", var(--serif)` : "var(--serif)";
  const bodyFamily = brand.body_font ? `"${brand.body_font}", var(--sans)` : "var(--sans)";
  const tagline = brand.brand_book?.identity?.tagline;
  const swatches = [
    brand.primary_hex && { hex: brand.primary_hex, label: "Primary" },
    brand.secondary_hex && { hex: brand.secondary_hex, label: "Secondary" },
    brand.accent_hex && { hex: brand.accent_hex, label: "Accent" },
    ...(brand.palette ?? []).map((p) => ({ hex: p.hex, label: p.name || "Swatch" })),
  ].filter(Boolean) as { hex: string; label: string }[];

  return (
    <div className="space-y-5">
      {fontFaces.length > 0 ? <style dangerouslySetInnerHTML={{ __html: fontFaces.join("") }} /> : null}

      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: accent }} />
        <div className="flex flex-wrap items-center gap-5 p-6">
          {logoUrl ? (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl p-2.5" style={{ border: "1px solid var(--line)", background: "var(--panel-2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={brand.name} className="max-h-full max-w-full object-contain" />
            </span>
          ) : (
            <span className="flex h-20 w-20 shrink-0 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--line)" }}>
              <span className="h-full w-1/2" style={{ background: brand.primary_hex ? `#${brand.primary_hex}` : "var(--panel-2)" }} />
              <span className="h-full w-1/2" style={{ background: brand.secondary_hex ? `#${brand.secondary_hex}` : "var(--line-2)" }} />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--faint)" }}>Brand preview</div>
            <h2 className="text-3xl font-bold leading-tight" style={{ fontFamily: headlineFamily, letterSpacing: "-.01em" }}>{brand.name}</h2>
            {tagline ? <p className="mt-0.5 italic" style={{ fontFamily: headlineFamily, color: "var(--muted)" }}>{tagline}</p> : null}
          </div>
        </div>
      </div>

      {/* Palette */}
      {swatches.length > 0 ? (
        <div className="card p-5">
          <div className="mb-3 text-sm font-semibold">Palette</div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {swatches.map((s, i) => <Swatch key={i} hex={s.hex} label={s.label} />)}
          </div>
        </div>
      ) : null}

      {/* Type + voice */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 text-sm font-semibold">Typography</div>
          <div className="text-5xl font-bold" style={{ fontFamily: headlineFamily, color: accent }}>Aa</div>
          <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{brand.headline_font ?? "Headline font not set"}</div>
          <p className="mt-3 border-t pt-3 text-sm leading-relaxed" style={{ fontFamily: bodyFamily, borderColor: "var(--line)" }}>
            The quick brown fox jumps over the lazy dog. {brand.body_font ? `Body set in ${brand.body_font}.` : "Body font not set."} 1234567890
          </p>
        </div>
        <div className="card p-5">
          <div className="mb-2 text-sm font-semibold">Voice</div>
          {brand.voice_tone ? <p className="text-sm" style={{ color: "var(--ink)" }}>{brand.voice_tone}</p> : <p className="text-sm italic" style={{ color: "var(--faint)" }}>Voice &amp; tone not set.</p>}
          {(brand.do_rules || brand.never_rules) ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {brand.do_rules ? <Chip tone="do">✓ {brand.do_rules.length > 40 ? brand.do_rules.slice(0, 40) + "…" : brand.do_rules}</Chip> : null}
              {brand.never_rules ? <Chip tone="never">✕ {brand.never_rules.length > 40 ? brand.never_rules.slice(0, 40) + "…" : brand.never_rules}</Chip> : null}
            </div>
          ) : null}
          {brand.voice_never ? <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}><span className="font-semibold">Never say:</span> {brand.voice_never}</div> : null}
        </div>
      </div>
    </div>
  );
}
