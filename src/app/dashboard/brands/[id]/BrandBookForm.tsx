"use client";

import { useState, useTransition } from "react";
import type { Workspace } from "@/lib/types";
import { updateBrandBook } from "../actions";

const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5";

// Module-scope so identity is stable across renders — inline components would
// remount on every keystroke and drop input focus.
function TextField({ label, value, onChange, ph }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; ph?: string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block opacity-70">{label}</span>
      <input className={inputCls} value={value} onChange={onChange} placeholder={ph} />
    </label>
  );
}
function AreaField({ label, value, onChange, ph }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; ph?: string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block opacity-70">{label}</span>
      <textarea className={inputCls} rows={2} value={value} onChange={onChange} placeholder={ph} />
    </label>
  );
}

type Field = keyof Pick<
  Workspace,
  | "name" | "slug" | "primary_hex" | "secondary_hex" | "headline_font"
  | "body_font" | "voice_tone" | "voice_never" | "photography_style"
  | "do_rules" | "never_rules" | "locations" | "ai_style_suffix" | "scrape_location"
>;

export function BrandBookForm({ brand }: { brand: Workspace }) {
  const [v, setV] = useState<Record<Field, string>>({
    name: brand.name ?? "",
    slug: brand.slug ?? "",
    primary_hex: brand.primary_hex ?? "",
    secondary_hex: brand.secondary_hex ?? "",
    headline_font: brand.headline_font ?? "",
    body_font: brand.body_font ?? "",
    voice_tone: brand.voice_tone ?? "",
    voice_never: brand.voice_never ?? "",
    photography_style: brand.photography_style ?? "",
    do_rules: brand.do_rules ?? "",
    never_rules: brand.never_rules ?? "",
    locations: brand.locations ?? "",
    ai_style_suffix: brand.ai_style_suffix ?? "",
    scrape_location: brand.scrape_location ?? "",
  });
  const [radius, setRadius] = useState(String(brand.scrape_radius_km ?? 25));
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((cur) => ({ ...cur, [f]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateBrandBook({ id: brand.id, ...v, scrape_radius_km: Number(radius) });
      setFeedback(
        "error" in res
          ? { kind: "err", text: res.error }
          : { kind: "ok", text: "Brand book saved. Every desk now builds from it." },
      );
    });
  }

  const Text = (f: Field, label: string, ph?: string) => (
    <TextField label={label} value={v[f]} onChange={set(f)} ph={ph} />
  );
  const Area = (f: Field, label: string, ph?: string) => (
    <AreaField label={label} value={v[f]} onChange={set(f)} ph={ph} />
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-3 text-sm font-semibold">Identity</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {Text("name", "Brand name")}
          {Text("slug", "Slug", "cafe-kallol")}
          <label className="block text-xs">
            <span className="mb-1 block opacity-70">Primary hex</span>
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 shrink-0 rounded-lg border border-black/10 dark:border-white/10" style={{ background: `#${/^[0-9a-fA-F]{6}$/.test(v.primary_hex) ? v.primary_hex : "cccccc"}` }} />
              <input className={inputCls} value={v.primary_hex} onChange={set("primary_hex")} placeholder="3B2A20" />
            </div>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block opacity-70">Secondary hex</span>
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 shrink-0 rounded-lg border border-black/10 dark:border-white/10" style={{ background: `#${/^[0-9a-fA-F]{6}$/.test(v.secondary_hex) ? v.secondary_hex : "e5e5e5"}` }} />
              <input className={inputCls} value={v.secondary_hex} onChange={set("secondary_hex")} placeholder="C8853F" />
            </div>
          </label>
          {Text("headline_font", "Headline font (editorial)", "Editorial serif")}
          {Text("body_font", "Body font (sans-serif)", "Clean modern sans-serif")}
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-3 text-sm font-semibold">Voice &amp; rules</h2>
        <div className="grid gap-3">
          {Area("voice_tone", "Voice & tone — how the brand speaks", "Warm, unhurried, sensory…")}
          {Area("voice_never", "Words it never uses", "Hype words, ALL-CAPS, emoji spam…")}
          {Area("do_rules", "Do — what the brand posts")}
          {Area("never_rules", "Never — what it would never post")}
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-3 text-sm font-semibold">Visual &amp; AI</h2>
        <div className="grid gap-3">
          {Area("photography_style", "Photography style — mood, light, framing")}
          {Text("locations", "Locations / geo footprint", "Mumbai")}
          {Area("ai_style_suffix", "AI image style suffix (auto-appended to prompts)", "warm wood tones, minimalist, high-end…")}
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-1 text-sm font-semibold">Local events scraper</h2>
        <p className="mb-3 text-xs opacity-60">The content team&apos;s scraper looks for events around this location, within the radius.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Text("scrape_location", "Founder / brand location", "Bengaluru, India")}
          <label className="block text-xs">
            <span className="mb-1 block opacity-70">Scrape radius: {radius} km</span>
            <input
              type="range" min={1} max={100} step={1}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-full accent-amber-600"
            />
            <div className="mt-1 flex justify-between text-[10px] opacity-45"><span>1 km</span><span>100 km</span></div>
          </label>
        </div>
      </section>

      {feedback ? (
        <div className={`rounded-lg px-3 py-2 text-sm ${feedback.kind === "ok" ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300" : "border border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"}`}>
          {feedback.text}
        </div>
      ) : null}

      <div className="sticky bottom-4">
        <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-amber-700 disabled:opacity-50">
          {pending ? "Saving…" : "Lock brand book"}
        </button>
      </div>
    </form>
  );
}
