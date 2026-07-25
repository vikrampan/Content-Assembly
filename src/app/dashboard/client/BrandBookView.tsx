import type { Asset } from "@/lib/types";
import { accentOf, brandFonts, BrandStyle, clientWorkspace, logoUrlOf, SectionHeader } from "./shared";
import { BrandBookForm } from "../brands/[id]/BrandBookForm";
import { BrandBookSections } from "../brands/[id]/BrandBookSections";

function Swatch({ hex, label }: { hex: string; label: string }) {
  const clean = hex.replace(/^#/, "");
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
      <div className="h-14" style={{ background: `#${clean}` }} />
      <div className="px-2.5 py-1.5">
        <div className="text-[11px] font-semibold">{label}</div>
        <div className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>#{clean}</div>
      </div>
    </div>
  );
}

function AssetRow({ name, url, kind }: { name: string; url: string; kind: string }) {
  return (
    <a href={url} download className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:brightness-95" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[10px] font-bold uppercase" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{kind === "font" ? "Aa" : "◆"}</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="shrink-0 text-xs font-medium" style={{ color: "var(--accent-ink)" }}>Download ↓</span>
    </a>
  );
}

export async function BrandBookView() {
  const { supabase, ws } = await clientWorkspace();
  if (!ws) return <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your workspace isn&apos;t set up yet.</div>;

  const { faces, headlineFamily } = await brandFonts(supabase, ws);
  const bodyFamily = ws.body_font ? `"${ws.body_font}", var(--sans)` : "var(--sans)";
  const accent = accentOf(ws);
  const logoUrl = await logoUrlOf(supabase, ws);
  const tagline = ws.brand_book?.identity?.tagline;

  // Downloadable brand assets (logos + fonts).
  const { data: assetRows } = await supabase
    .from("assets").select("*")
    .eq("workspace_id", ws.id).is("content_id", null).in("kind", ["logo", "font", "brand"])
    .order("created_at", { ascending: false });
  const files = await Promise.all(
    ((assetRows as Asset[]) ?? []).map(async (a) => {
      const { data } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
      return { name: a.label || a.storage_path.split("/").pop() || "asset", url: data?.signedUrl ?? null, kind: a.kind };
    }),
  );
  const downloadable = files.filter((f) => f.url) as { name: string; url: string; kind: string }[];

  const swatches = [
    ws.primary_hex && { hex: ws.primary_hex, label: "Primary" },
    ws.secondary_hex && { hex: ws.secondary_hex, label: "Secondary" },
    ws.accent_hex && { hex: ws.accent_hex, label: "Accent" },
    ...(ws.palette ?? []).map((p) => ({ hex: p.hex, label: p.name || "Swatch" })),
  ].filter(Boolean) as { hex: string; label: string }[];

  return (
    <div className="space-y-6">
      <BrandStyle faces={faces} />
      <SectionHeader title="Brand Book" subtitle="See and edit your brand — every change applies everywhere your content is made, instantly." family={headlineFamily} />

      {ws.brand_status !== "locked" ? (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
          Your team is still setting this up. You can edit anything below — your changes save live.
        </div>
      ) : null}

      {/* Live preview */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: accent }} />
        <div className="flex flex-wrap items-center gap-5 p-6">
          {logoUrl ? (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl p-2.5" style={{ border: "1px solid var(--line)", background: "var(--panel-2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={ws.name} className="max-h-full max-w-full object-contain" />
            </span>
          ) : (
            <span className="flex h-20 w-20 shrink-0 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--line)" }}>
              <span className="h-full w-1/2" style={{ background: ws.primary_hex ? `#${ws.primary_hex}` : "var(--panel-2)" }} />
              <span className="h-full w-1/2" style={{ background: ws.secondary_hex ? `#${ws.secondary_hex}` : "var(--line-2)" }} />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--faint)" }}>Your brand</div>
            <h2 className="text-3xl font-bold leading-tight" style={{ fontFamily: headlineFamily, letterSpacing: "-.01em" }}>{ws.name}</h2>
            {tagline ? <p className="mt-0.5 italic" style={{ fontFamily: headlineFamily, color: "var(--muted)" }}>{tagline}</p> : null}
          </div>
        </div>
        {swatches.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 border-t p-5 sm:grid-cols-4 lg:grid-cols-6" style={{ borderColor: "var(--line)" }}>
            {swatches.map((s, i) => <Swatch key={i} hex={s.hex} label={s.label} />)}
          </div>
        ) : null}
        <div className="border-t px-5 py-4" style={{ borderColor: "var(--line)" }}>
          <div className="text-4xl font-bold" style={{ fontFamily: headlineFamily, color: accent }}>Aa</div>
          <p className="mt-1 text-sm leading-relaxed" style={{ fontFamily: bodyFamily, color: "var(--muted)" }}>
            The quick brown fox jumps over the lazy dog. 1234567890
          </p>
        </div>
      </div>

      {/* Editable — the same fields your brand team uses. */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Brand DNA</h2>
        <BrandBookForm brand={ws} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Story &amp; voice</h2>
        <BrandBookSections workspaceId={ws.id} initial={ws.brand_book ?? {}} />
      </div>

      {/* Downloadable assets */}
      {downloadable.length > 0 ? (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">Brand assets</h2>
          <p className="mb-3 text-[13px]" style={{ color: "var(--muted)" }}>Your logo files and fonts — download them for your own use.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {downloadable.map((f, i) => <AssetRow key={i} name={f.name} url={f.url} kind={f.kind} />)}
          </div>
        </section>
      ) : null}

      <div className="h-1 w-16 rounded-full" style={{ background: accent }} />
    </div>
  );
}
