import type { ReactNode } from "react";
import type { Asset } from "@/lib/types";
import { accentOf, brandFonts, BrandStyle, clientWorkspace, logoUrlOf, SectionHeader } from "./shared";

/* ------------------------------------------------------------------ atoms */

function Swatch({ hex, label }: { hex: string; label: string }) {
  const clean = hex.replace(/^#/, "");
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
      <div className="h-16" style={{ background: `#${clean}` }} />
      <div className="px-2.5 py-1.5">
        <div className="text-[11px] font-semibold">{label}</div>
        <div className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>#{clean}</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Chips({ items, tone }: { items?: string[] | null; tone?: "do" | "never" | "neutral" }) {
  if (!items || items.length === 0) return null;
  const style =
    tone === "do" ? { background: "var(--good-soft)", color: "var(--good)" }
    : tone === "never" ? { background: "rgba(192,85,63,.12)", color: "var(--danger)" }
    : { background: "var(--panel-2)", color: "var(--ink)", border: "1px solid var(--line)" };
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => <span key={i} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={style}>{it}</span>)}
    </div>
  );
}

/** Downloadable brand file (logo / font). */
function AssetRow({ name, url, kind }: { name: string; url: string; kind: string }) {
  return (
    <a href={url} download className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:brightness-95" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[10px] font-bold uppercase" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{kind === "font" ? "Aa" : "◆"}</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="shrink-0 text-xs font-medium" style={{ color: "var(--accent-ink)" }}>Download ↓</span>
    </a>
  );
}

/* ------------------------------------------------------------------- view */

export async function BrandBookView() {
  const { supabase, ws } = await clientWorkspace();
  if (!ws) return <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your workspace isn&apos;t set up yet.</div>;

  const { faces, headlineFamily } = await brandFonts(supabase, ws);
  const bodyFamily = ws.body_font ? `"${ws.body_font}", var(--sans)` : "var(--sans)";
  const accent = accentOf(ws);
  const logoUrl = await logoUrlOf(supabase, ws);

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
  const id = book.identity ?? {};
  const voice = book.voice ?? {};
  const messaging = book.messaging ?? {};
  const imagery = book.imagery ?? {};
  const social = book.social ?? {};

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
      <SectionHeader title="Brand Book" subtitle="Your brand identity — the constitution every post is built from." family={headlineFamily} />

      {/* Hero — logo, name, tagline */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: accent }} />
        <div className="flex flex-wrap items-center gap-5 p-6">
          {logoUrl ? (
            <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl p-3" style={{ border: "1px solid var(--line)", background: "var(--panel-2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={ws.name} className="max-h-full max-w-full object-contain" />
            </span>
          ) : (
            <span className="flex h-24 w-24 shrink-0 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--line)" }}>
              <span className="h-full w-1/2" style={{ background: ws.primary_hex ? `#${ws.primary_hex}` : "var(--panel-2)" }} />
              <span className="h-full w-1/2" style={{ background: ws.secondary_hex ? `#${ws.secondary_hex}` : "var(--line-2)" }} />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--faint)" }}>Your brand</div>
            <h2 className="text-3xl font-bold leading-tight" style={{ fontFamily: headlineFamily, letterSpacing: "-.01em" }}>{ws.name}</h2>
            {id.tagline ? <p className="mt-0.5 italic" style={{ fontFamily: headlineFamily, color: "var(--muted)" }}>{id.tagline}</p> : null}
          </div>
        </div>
      </div>

      {/* Palette */}
      {swatches.length > 0 ? (
        <Card title="Colours">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {swatches.map((s, i) => <Swatch key={i} hex={s.hex} label={s.label} />)}
          </div>
        </Card>
      ) : null}

      {/* Typography */}
      {(ws.headline_font || ws.body_font) ? (
        <Card title="Typography">
          <div className="text-6xl font-bold" style={{ fontFamily: headlineFamily, color: accent }}>Aa</div>
          <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{ws.headline_font ?? "Headline"}{ws.body_font ? ` · ${ws.body_font}` : ""}</div>
          <p className="mt-3 border-t pt-3 text-base leading-relaxed" style={{ fontFamily: bodyFamily, borderColor: "var(--line)" }}>
            The quick brown fox jumps over the lazy dog. 1234567890
          </p>
        </Card>
      ) : null}

      {/* Identity */}
      {(id.mission || id.vision || id.positioning || id.audience || id.story || (id.values && id.values.length)) ? (
        <Card title="Identity">
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            <Row label="Mission" value={id.mission} />
            <Row label="Vision" value={id.vision} />
            <Row label="Positioning" value={id.positioning} />
            <Row label="Audience" value={id.audience} />
            <Row label="Story" value={id.story} />
          </div>
          {id.values && id.values.length ? <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}><div className="mb-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Values</div><Chips items={id.values} /></div> : null}
        </Card>
      ) : null}

      {/* Voice */}
      <Card title="Voice &amp; tone">
        <div className="divide-y" style={{ borderColor: "var(--line)" }}>
          <Row label="Voice" value={ws.voice_tone} />
          <Row label="Mechanics" value={voice.mechanics} />
        </div>
        {voice.attributes && voice.attributes.length ? <div className="mt-3"><Chips items={voice.attributes} /></div> : null}
        {(ws.do_rules || ws.never_rules || ws.voice_never) ? (
          <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--line)" }}>
            {ws.do_rules ? <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold uppercase" style={{ color: "var(--good)" }}>Do</span><span className="text-sm">{ws.do_rules}</span></div> : null}
            {ws.never_rules ? <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold uppercase" style={{ color: "var(--danger)" }}>Never</span><span className="text-sm">{ws.never_rules}</span></div> : null}
            {ws.voice_never ? <div className="text-[13px]" style={{ color: "var(--muted)" }}><span className="font-semibold">Never say:</span> {ws.voice_never}</div> : null}
          </div>
        ) : null}
        {(voice.examples_good?.length || voice.examples_bad?.length) ? (
          <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2" style={{ borderColor: "var(--line)" }}>
            {voice.examples_good?.length ? <div><div className="mb-1 text-[11px] font-semibold uppercase" style={{ color: "var(--good)" }}>✓ On-brand</div><ul className="space-y-1 text-[13px]">{voice.examples_good.map((e, i) => <li key={i} className="italic" style={{ color: "var(--muted)" }}>“{e}”</li>)}</ul></div> : null}
            {voice.examples_bad?.length ? <div><div className="mb-1 text-[11px] font-semibold uppercase" style={{ color: "var(--danger)" }}>✕ Off-brand</div><ul className="space-y-1 text-[13px]">{voice.examples_bad.map((e, i) => <li key={i} className="italic" style={{ color: "var(--muted)" }}>“{e}”</li>)}</ul></div> : null}
          </div>
        ) : null}
      </Card>

      {/* Messaging */}
      {(messaging.elevator_pitch || messaging.boilerplate || messaging.value_props?.length || messaging.key_messages?.length) ? (
        <Card title="Messaging">
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            <Row label="Elevator pitch" value={messaging.elevator_pitch} />
            <Row label="Boilerplate" value={messaging.boilerplate} />
          </div>
          {messaging.value_props?.length ? <div className="mt-3"><div className="mb-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Value props</div><Chips items={messaging.value_props} /></div> : null}
          {messaging.key_messages?.length ? <div className="mt-3"><div className="mb-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Key messages</div><Chips items={messaging.key_messages} /></div> : null}
        </Card>
      ) : null}

      {/* Imagery */}
      {(ws.photography_style || imagery.photography || imagery.illustration || imagery.iconography || imagery.patterns) ? (
        <Card title="Imagery &amp; art direction">
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            <Row label="Photography" value={ws.photography_style || imagery.photography} />
            <Row label="Illustration" value={imagery.illustration} />
            <Row label="Iconography" value={imagery.iconography} />
            <Row label="Patterns" value={imagery.patterns} />
          </div>
        </Card>
      ) : null}

      {/* Social */}
      {(social.bio || social.handle || social.emoji_policy || social.hashtags?.length) ? (
        <Card title="Social">
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            <Row label="Handle" value={social.handle} />
            <Row label="Bio" value={social.bio} />
            <Row label="Emoji policy" value={social.emoji_policy} />
          </div>
          {social.hashtags?.length ? <div className="mt-3"><Chips items={social.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`))} /></div> : null}
        </Card>
      ) : null}

      {/* Downloadable assets */}
      {downloadable.length > 0 ? (
        <Card title="Brand assets">
          <p className="mb-3 text-[13px]" style={{ color: "var(--muted)" }}>Your logo files and fonts — download them for your own use.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {downloadable.map((f, i) => <AssetRow key={i} name={f.name} url={f.url} kind={f.kind} />)}
          </div>
        </Card>
      ) : null}

      <div className="h-1 w-16 rounded-full" style={{ background: accent }} />
    </div>
  );
}
