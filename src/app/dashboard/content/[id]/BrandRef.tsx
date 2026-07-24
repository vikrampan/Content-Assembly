// Server component — the brand rules QA (and everyone) checks a post against.
import type { Workspace } from "@/lib/types";

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5">
      <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="text-xs">{value}</div>
    </div>
  );
}

export function BrandRef({ ws }: { ws: Workspace }) {
  const swatches = [
    ws.primary_hex && { hex: ws.primary_hex, name: "Primary" },
    ws.secondary_hex && { hex: ws.secondary_hex, name: "Secondary" },
    ws.accent_hex && { hex: ws.accent_hex, name: "Accent" },
    ...(ws.palette ?? []).map((p) => ({ hex: p.hex, name: p.name || "Swatch" })),
  ].filter(Boolean) as { hex: string; name: string }[];

  return (
    <details className="card p-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4">
        <span className="text-sm font-semibold">Brand book</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>— check the post against these</span>
        {ws.brand_status === "locked" ? <span className="pill approved ml-auto">Locked</span> : <span className="pill pending ml-auto">Draft</span>}
      </summary>
      <div className="border-t p-4" style={{ borderColor: "var(--line)" }}>
        {swatches.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {swatches.map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px]" style={{ border: "1px solid var(--line)" }}>
                <span className="h-5 w-5 rounded" style={{ background: `#${s.hex.replace(/^#/, "")}` }} />
                <span className="font-mono" style={{ color: "var(--muted)" }}>#{s.hex.replace(/^#/, "")}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="divide-y" style={{ borderColor: "var(--line)" }}>
          <Row label="Voice & tone" value={ws.voice_tone} />
          <Row label="Never say" value={ws.voice_never} />
          <Row label="Do post" value={ws.do_rules} />
          <Row label="Never post" value={ws.never_rules} />
          <Row label="Photography" value={ws.photography_style} />
          <Row label="Typography" value={[ws.headline_font, ws.body_font].filter(Boolean).join(" · ") || null} />
          <Row label="Logo rules" value={ws.logo_rules} />
          <Row label="Claims needing proof" value={ws.brand_book?.legal?.claims_needing_proof ?? null} />
        </div>
      </div>
    </details>
  );
}
