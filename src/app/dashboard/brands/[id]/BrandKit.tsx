"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Workspace } from "@/lib/types";
import { deleteBrandAsset, registerBrandAsset, saveVisualKit } from "../actions";

export interface BrandAssetView {
  id: string;
  url: string | null;
  name: string;
  kind: string;
  isImage: boolean;
  isPrimaryLogo: boolean;
}

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

export function BrandKit({ brand, assets }: { brand: Workspace; assets: BrandAssetView[] }) {
  const [accent, setAccent] = useState(brand.accent_hex ?? "");
  const [rules, setRules] = useState(brand.logo_rules ?? "");
  const [palette, setPalette] = useState<{ hex: string; name?: string }[]>(brand.palette ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const logoRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const logos = assets.filter((a) => a.kind === "logo");
  const fonts = assets.filter((a) => a.kind === "font");

  async function upload(files: FileList | null, kind: "logo" | "font", makePrimary: boolean) {
    if (!files || files.length === 0) return;
    setMsg(null);
    setBusy(kind);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${brand.id}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("assets").upload(path, file);
        if (upErr) throw upErr;
        const res = await registerBrandAsset({ workspaceId: brand.id, storagePath: path, kind, label: file.name, makePrimaryLogo: makePrimary && kind === "logo" });
        if ("error" in res) throw new Error(res.error);
      }
      start(() => router.refresh());
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Upload failed." });
    } finally {
      setBusy(null);
      if (logoRef.current) logoRef.current.value = "";
      if (fontRef.current) fontRef.current.value = "";
    }
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteBrandAsset(id);
      if ("error" in res) setMsg({ kind: "err", text: res.error });
      else router.refresh();
    });
  }

  function saveKit() {
    setMsg(null);
    start(async () => {
      const res = await saveVisualKit({ id: brand.id, accent_hex: accent, palette, logo_rules: rules });
      setMsg("error" in res ? { kind: "err", text: res.error } : { kind: "ok", text: "Visual kit saved." });
      if (!("error" in res)) router.refresh();
    });
  }

  return (
    <section className="card space-y-5 p-5">
      <div>
        <h2 className="text-sm font-semibold">Visual kit</h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Logos, fonts, the full palette, and logo usage rules — the raw materials every desk builds from.</p>
      </div>

      {/* Logos */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Logos</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))" }}>
          {logos.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-xl" style={{ border: `1px solid ${a.isPrimaryLogo ? "var(--accent)" : "var(--line)"}` }}>
              <div className="flex aspect-square items-center justify-center p-2" style={{ background: "var(--panel-2)" }}>
                {a.isImage && a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-2xl" style={{ color: "var(--faint)" }}>▤</span>
                )}
              </div>
              {a.isPrimaryLogo ? <span className="pill approved absolute left-1.5 top-1.5">Primary</span> : null}
              <button type="button" onClick={() => remove(a.id)} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md text-white opacity-0 transition group-hover:opacity-100" style={{ background: "rgba(0,0,0,.55)" }}>×</button>
              <div className="truncate px-2 py-1 text-[10px]" style={{ color: "var(--muted)" }}>{a.name}</div>
            </div>
          ))}
          <button type="button" onClick={() => logoRef.current?.click()} disabled={busy === "logo"} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-xs" style={{ border: "1px dashed var(--line-2)", color: "var(--faint)" }}>
            {busy === "logo" ? "Uploading…" : <><span className="text-xl">＋</span>Add logo</>}
          </button>
        </div>
        <input ref={logoRef} type="file" multiple accept="image/*,.svg" className="hidden" onChange={(e) => upload(e.target.files, "logo", logos.length === 0)} />
      </div>

      {/* Fonts */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Font files</div>
        <div className="flex flex-wrap gap-2">
          {fonts.map((a) => (
            <span key={a.id} className="group inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ border: "1px solid var(--line)" }}>
              <span className="truncate" style={{ maxWidth: 160 }}>{a.name}</span>
              <button type="button" onClick={() => remove(a.id)} style={{ color: "var(--faint)" }}>×</button>
            </span>
          ))}
          <button type="button" onClick={() => fontRef.current?.click()} disabled={busy === "font"} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ border: "1px dashed var(--line-2)", color: "var(--faint)" }}>
            {busy === "font" ? "Uploading…" : "＋ Add font (.woff2 / .otf / .ttf)"}
          </button>
        </div>
        <input ref={fontRef} type="file" multiple accept=".woff,.woff2,.otf,.ttf" className="hidden" onChange={(e) => upload(e.target.files, "font", false)} />
      </div>

      {/* Palette builder */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Full palette</div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {brand.primary_hex ? <Swatch hex={brand.primary_hex} label="Primary" locked /> : null}
          {brand.secondary_hex ? <Swatch hex={brand.secondary_hex} label="Secondary" locked /> : null}
          {palette.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ border: "1px solid var(--line)" }}>
              <input type="color" value={`#${p.hex.replace(/^#/, "") || "cccccc"}`} onChange={(e) => setPalette((pl) => pl.map((x, j) => (j === i ? { ...x, hex: e.target.value.replace("#", "") } : x)))} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
              <input value={p.name ?? ""} onChange={(e) => setPalette((pl) => pl.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="name" className="w-16 bg-transparent text-xs outline-none" style={{ color: "var(--ink)" }} />
              <button type="button" onClick={() => setPalette((pl) => pl.filter((_, j) => j !== i))} style={{ color: "var(--faint)" }}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setPalette((pl) => [...pl, { hex: "cccccc", name: "" }])} className="rounded-lg px-2.5 py-1.5 text-xs font-medium" style={{ border: "1px dashed var(--line-2)", color: "var(--faint)" }}>＋ swatch</button>
        </div>
      </div>

      {/* Accent + rules */}
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="block text-xs">
          <span className="mb-1 block" style={{ color: "var(--muted)" }}>Accent hex</span>
          <div className="flex items-center gap-2">
            <input type="color" value={`#${(accent || "c8853f").replace(/^#/, "")}`} onChange={(e) => setAccent(e.target.value.replace("#", ""))} className="h-9 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
            <input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="C8853F" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          </div>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block" style={{ color: "var(--muted)" }}>Logo usage rules — clear space, min size, don&apos;ts</span>
          <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={3} placeholder="e.g. Keep clear space of at least the logo's cap-height on all sides. Never recolour, stretch, or place on busy imagery." className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        </label>
      </div>

      {msg ? <div className="text-xs" style={{ color: msg.kind === "ok" ? "var(--good)" : "var(--danger)" }}>{msg.text}</div> : null}

      <button type="button" onClick={saveKit} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
        {pending ? "Saving…" : "Save visual kit"}
      </button>
    </section>
  );
}

function Swatch({ hex, label, locked }: { hex: string; label: string; locked?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs" style={{ border: "1px solid var(--line)" }}>
      <span className="h-6 w-6 rounded" style={{ background: `#${hex.replace(/^#/, "")}` }} />
      <div>
        <div className="font-medium">{label}</div>
        <div className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>#{hex.replace(/^#/, "")}{locked ? " · locked" : ""}</div>
      </div>
    </div>
  );
}
