"use client";

import { useState, useTransition } from "react";
import type { Workspace } from "@/lib/types";
import { InfoDot } from "@/components/InfoDot";
import { updateBrandBook } from "../actions";

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

function Lbl({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="mb-1 flex items-center" style={{ color: "var(--muted)" }}>
      {label}
      <InfoDot text={hint} />
    </span>
  );
}
function TextField({ label, hint, value, onChange, ph }: { label: string; hint: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; ph?: string }) {
  return (
    <label className="block text-xs">
      <Lbl label={label} hint={hint} />
      <input className={inputCls} style={inputStyle} value={value} onChange={onChange} placeholder={ph} />
    </label>
  );
}
function AreaField({ label, hint, value, onChange, ph }: { label: string; hint: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; ph?: string }) {
  return (
    <label className="block text-xs">
      <Lbl label={label} hint={hint} />
      <textarea className={inputCls} style={inputStyle} rows={2} value={value} onChange={onChange} placeholder={ph} />
    </label>
  );
}

type Field = keyof Pick<
  Workspace,
  | "name" | "slug" | "primary_hex" | "secondary_hex" | "headline_font"
  | "body_font" | "voice_tone" | "voice_never" | "photography_style"
  | "do_rules" | "never_rules" | "locations" | "ai_style_suffix"
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
  });
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((cur) => ({ ...cur, [f]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateBrandBook({ id: brand.id, ...v });
      setFeedback("error" in res ? { kind: "err", text: res.error } : { kind: "ok", text: "Brand book saved." });
    });
  }

  const Text = (f: Field, label: string, hint: string, ph?: string) => <TextField label={label} hint={hint} value={v[f]} onChange={set(f)} ph={ph} />;
  const Area = (f: Field, label: string, hint: string, ph?: string) => <AreaField label={label} hint={hint} value={v[f]} onChange={set(f)} ph={ph} />;

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Identity</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {Text("name", "Brand name", "The brand's display name.")}
          {Text("slug", "Slug", "A short URL-friendly id (lowercase, dashes). Usually auto-set from the name.", "ember-and-oak")}
          <label className="block text-xs">
            <Lbl label="Primary colour" hint="The brand's main colour, as a 6-digit hex code (no #)." />
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 shrink-0 rounded-lg" style={{ background: `#${/^[0-9a-fA-F]{6}$/.test(v.primary_hex) ? v.primary_hex : "cccccc"}`, border: "1px solid var(--line)" }} />
              <input className={inputCls} style={inputStyle} value={v.primary_hex} onChange={set("primary_hex")} placeholder="3B2A20" />
            </div>
          </label>
          <label className="block text-xs">
            <Lbl label="Secondary colour" hint="The supporting brand colour, as a 6-digit hex code (no #)." />
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 shrink-0 rounded-lg" style={{ background: `#${/^[0-9a-fA-F]{6}$/.test(v.secondary_hex) ? v.secondary_hex : "e5e5e5"}`, border: "1px solid var(--line)" }} />
              <input className={inputCls} style={inputStyle} value={v.secondary_hex} onChange={set("secondary_hex")} placeholder="C8853F" />
            </div>
          </label>
          {Text("headline_font", "Headline font", "The font used for big titles and headlines.", "Editorial serif")}
          {Text("body_font", "Body font", "The font used for normal running text.", "Clean modern sans-serif")}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Voice &amp; rules</h2>
        <div className="grid gap-3">
          {Area("voice_tone", "Voice & tone", "How the brand sounds when it talks — its personality in words.", "Warm, unhurried, sensory…")}
          {Area("voice_never", "Words it never uses", "Words or phrases the brand must never use.", "Hype words, ALL-CAPS, emoji spam…")}
          {Area("do_rules", "Do — what the brand posts", "The kinds of things the brand does post.")}
          {Area("never_rules", "Never — what it won't post", "The kinds of things the brand would never post.")}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Visual &amp; AI</h2>
        <div className="grid gap-3">
          {Area("photography_style", "Photography style", "The look of the brand's photos — mood, lighting, and framing.")}
          {Text("locations", "Locations", "Where the brand operates (city / area).", "Mumbai")}
          {Area("ai_style_suffix", "AI image style keywords", "Style keywords added to every AI image prompt so generated visuals stay on-brand.", "warm wood tones, minimalist, high-end…")}
        </div>
      </section>

      {feedback ? (
        <div className="rounded-lg px-3 py-2 text-sm" style={feedback.kind === "ok" ? { background: "var(--good-soft)", color: "var(--good)" } : { background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>
          {feedback.text}
        </div>
      ) : null}

      <button type="submit" disabled={pending} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
        {pending ? "Saving…" : "Save brand book"}
      </button>
    </form>
  );
}
