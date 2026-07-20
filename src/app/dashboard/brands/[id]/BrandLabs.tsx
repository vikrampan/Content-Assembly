// Server component — pure colour/type math, no client JS needed.
import type { Workspace } from "@/lib/types";

function toRgb(hex: string) {
  const h = hex.replace(/^#/, "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as [number, number, number];
}
const toHex = (r: number, g: number, b: number) =>
  [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
const mix = (hex: string, target: number, amt: number) => {
  const [r, g, b] = toRgb(hex);
  return toHex(r + (target - r) * amt, g + (target - g) * amt, b + (target - b) * amt);
};
function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

function Ramp({ hex, name }: { hex: string; name: string }) {
  const clean = hex.replace(/^#/, "");
  const steps = [
    mix(clean, 255, 0.6), mix(clean, 255, 0.3), clean, mix(clean, 0, 0.25), mix(clean, 0, 0.5),
  ];
  const onWhite = contrast(clean, "ffffff");
  const onBlack = contrast(clean, "000000");
  const bestText = onWhite >= onBlack ? "#fff" : "#000";
  const ratio = Math.max(onWhite, onBlack);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold">{name}</span>
        <span className="text-[10px]" style={{ color: ratio >= 4.5 ? "var(--good)" : "var(--danger)" }}>
          {ratio.toFixed(1)}:1 {ratio >= 4.5 ? "AA ✓" : "low"}
        </span>
      </div>
      <div className="flex overflow-hidden rounded-lg" style={{ border: "1px solid var(--line)" }}>
        {steps.map((s, i) => (
          <div key={i} className="flex h-12 flex-1 items-end justify-center pb-1 text-[8px] font-mono" style={{ background: `#${s}`, color: i >= 3 ? "#fff" : "#000" }}>
            {i === 2 ? <span style={{ color: bestText }}>#{s}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrandLabs({ brand, logoUrl }: { brand: Workspace; logoUrl: string | null }) {
  const ramps = [
    brand.primary_hex ? { hex: brand.primary_hex, name: "Primary" } : null,
    brand.secondary_hex ? { hex: brand.secondary_hex, name: "Secondary" } : null,
    brand.accent_hex ? { hex: brand.accent_hex, name: "Accent" } : null,
    ...(brand.palette ?? []).map((p, i) => ({ hex: p.hex, name: p.name || `Swatch ${i + 1}` })),
  ].filter(Boolean) as { hex: string; name: string }[];

  const accent = brand.accent_hex ?? brand.primary_hex ?? "c8853f";
  const backdrops = [
    { bg: "#ffffff", label: "Light" },
    { bg: "#141210", label: "Dark" },
    { bg: `#${(brand.primary_hex ?? "c8853f").replace(/^#/, "")}`, label: "Primary" },
    { bg: "linear-gradient(135deg,#8a7a66,#4a3a2a)", label: "Photo" },
  ];

  return (
    <section className="card space-y-5 p-5">
      <div>
        <h2 className="text-sm font-semibold">Brand labs</h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Auto-generated tints, contrast checks, logo tests, and a type specimen.</p>
      </div>

      {ramps.length > 0 ? (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Colour ramps &amp; contrast</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ramps.map((r, i) => <Ramp key={i} hex={r.hex} name={r.name} />)}
          </div>
        </div>
      ) : null}

      {logoUrl ? (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Logo on backgrounds</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {backdrops.map((b) => (
              <div key={b.label} className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
                <div className="flex aspect-video items-center justify-center p-3" style={{ background: b.bg }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="logo" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="px-2 py-1 text-[10px]" style={{ color: "var(--muted)" }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Type specimen</div>
        <div className="rounded-xl p-4" style={{ border: "1px solid var(--line)", background: "var(--panel-2)" }}>
          <div style={{ fontFamily: brand.headline_font ? `"${brand.headline_font}", Georgia, serif` : "Georgia, serif", color: `#${accent.replace(/^#/, "")}` }}>
            <div className="text-3xl font-bold leading-tight">{brand.name}</div>
            <div className="text-lg">{brand.headline_font ?? "Headline typeface"}</div>
          </div>
          <p className="mt-2 text-sm" style={{ fontFamily: brand.body_font ? `"${brand.body_font}", -apple-system, sans-serif` : "inherit", color: "var(--ink)" }}>
            The quick brown fox jumps over the lazy dog. {brand.body_font ? `Set in ${brand.body_font}.` : "Body typeface."} 1234567890 — &amp; ! ?
          </p>
        </div>
      </div>
    </section>
  );
}
