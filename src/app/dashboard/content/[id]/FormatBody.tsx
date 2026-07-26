"use client";

// The format-aware copy workspace. A reel is a script (hook + beats + audio),
// a carousel is slides, a post/story is caption-shaped. All edit one ContentBody.

import type { ContentBody, ContentFormat, CarouselBody, CarouselSlide, PostBody, ReelBody, ReelBeat, StoryBody, StoryFrame } from "@/lib/types";

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block" style={{ color: "var(--muted)" }}>{label}</span>
      {children}
    </label>
  );
}
function Hashtags({ value, onChange }: { value?: string[]; onChange: (v: string[]) => void }) {
  return (
    <Field label="Hashtags — space separated">
      <input className={inputCls} style={inputStyle} value={(value ?? []).join(" ")}
        onChange={(e) => onChange(e.target.value.split(/\s+/).map((h) => h.replace(/^#/, "")).filter(Boolean).map((h) => `#${h}`))}
        placeholder="#alkalinesalt #sambharlake" />
    </Field>
  );
}
function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className="w-full rounded-lg border border-dashed px-2 py-2 text-xs font-semibold transition hover:brightness-95" style={{ borderColor: "var(--line-2)", color: "var(--accent-ink)" }}>+ {label}</button>;
}

export function FormatBody({ format, body, onChange }: { format: ContentFormat; body: ContentBody; onChange: (b: ContentBody) => void }) {
  // -------- Post --------
  if (format === "post") {
    const b = body as PostBody;
    const set = (p: Partial<PostBody>) => onChange({ ...b, ...p });
    return (
      <div className="space-y-3">
        <Field label="Hook — one scroll-stopping line"><textarea className={inputCls} style={inputStyle} rows={2} value={b.hook ?? ""} onChange={(e) => set({ hook: e.target.value })} /></Field>
        <Field label="Body — the value: quality, substance, proof"><textarea className={inputCls} style={inputStyle} rows={3} value={b.body ?? ""} onChange={(e) => set({ body: e.target.value })} /></Field>
        <Field label="CTA — one clear directive"><textarea className={inputCls} style={inputStyle} rows={2} value={b.cta ?? ""} onChange={(e) => set({ cta: e.target.value })} /></Field>
        <Field label="Caption — the full post caption"><textarea className={inputCls} style={inputStyle} rows={3} value={b.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} /></Field>
        <Hashtags value={b.hashtags} onChange={(hashtags) => set({ hashtags })} />
      </div>
    );
  }

  // -------- Carousel --------
  if (format === "carousel") {
    const b = body as CarouselBody;
    const slides = b.slides ?? [];
    const setSlides = (s: CarouselSlide[]) => onChange({ ...b, slides: s });
    const patch = (i: number, p: Partial<CarouselSlide>) => setSlides(slides.map((x, j) => (j === i ? { ...x, ...p } : x)));
    return (
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Slides ({slides.length})</div>
        <div className="space-y-2">
          {slides.map((s, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-bold" style={{ color: "var(--accent-ink)" }}>Slide {i + 1}{i === 0 ? " · hook" : i === slides.length - 1 ? " · CTA" : ""}</span>
                <button type="button" onClick={() => setSlides(slides.filter((_, j) => j !== i))} style={{ color: "var(--faint)" }}>✕</button>
              </div>
              <input className={`${inputCls} mb-1.5`} style={inputStyle} value={s.heading ?? ""} onChange={(e) => patch(i, { heading: e.target.value })} placeholder="Slide headline" />
              <textarea className={inputCls} style={inputStyle} rows={2} value={s.body ?? ""} onChange={(e) => patch(i, { body: e.target.value })} placeholder="Slide text" />
            </div>
          ))}
          <AddBtn label="Add slide" onClick={() => setSlides([...slides, {}])} />
        </div>
        <Field label="Caption — the full post caption"><textarea className={inputCls} style={inputStyle} rows={3} value={b.caption ?? ""} onChange={(e) => onChange({ ...b, caption: e.target.value })} /></Field>
        <Hashtags value={b.hashtags} onChange={(hashtags) => onChange({ ...b, hashtags })} />
      </div>
    );
  }

  // -------- Reel --------
  if (format === "reel") {
    const b = body as ReelBody;
    const beats = b.beats ?? [];
    const setBeats = (x: ReelBeat[]) => onChange({ ...b, beats: x });
    const patch = (i: number, p: Partial<ReelBeat>) => setBeats(beats.map((x, j) => (j === i ? { ...x, ...p } : x)));
    return (
      <div className="space-y-3">
        <Field label="🎬 On-screen hook (0–3s) — the scroll-stopper"><textarea className={inputCls} style={{ ...inputStyle, fontWeight: 600 }} rows={2} value={b.hook_text ?? ""} onChange={(e) => onChange({ ...b, hook_text: e.target.value })} placeholder="You've been seasoning wrong." /></Field>
        <div className="flex flex-wrap gap-3">
          <Field label="Target length">
            <select className={inputCls} style={{ ...inputStyle, width: 120 }} value={b.duration_sec ?? ""} onChange={(e) => onChange({ ...b, duration_sec: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">—</option><option value="7">7s</option><option value="15">15s</option><option value="30">30s</option><option value="60">60s</option>
            </select>
          </Field>
          <div className="flex-1" style={{ minWidth: 180 }}>
            <Field label="Suggested audio"><input className={inputCls} style={inputStyle} value={b.audio ?? ""} onChange={(e) => onChange({ ...b, audio: e.target.value })} placeholder="Trending upbeat / original VO" /></Field>
          </div>
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Beat sheet ({beats.length}) — the shot list</div>
        <div className="space-y-2">
          {beats.map((beat, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
              <div className="mb-1.5 flex items-center justify-between">
                <input className="rounded px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--accent-ink)", width: 72 }} value={beat.time ?? ""} onChange={(e) => patch(i, { time: e.target.value })} placeholder="0–3s" />
                <button type="button" onClick={() => setBeats(beats.filter((_, j) => j !== i))} style={{ color: "var(--faint)" }}>✕</button>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-3">
                <input className={inputCls} style={inputStyle} value={beat.scene ?? ""} onChange={(e) => patch(i, { scene: e.target.value })} placeholder="Scene / shot" />
                <input className={inputCls} style={inputStyle} value={beat.on_screen ?? ""} onChange={(e) => patch(i, { on_screen: e.target.value })} placeholder="On-screen text" />
                <input className={inputCls} style={inputStyle} value={beat.voiceover ?? ""} onChange={(e) => patch(i, { voiceover: e.target.value })} placeholder="Voiceover / audio" />
              </div>
            </div>
          ))}
          <AddBtn label="Add beat" onClick={() => setBeats([...beats, {}])} />
        </div>
        <Field label="Caption — short, hook-led"><textarea className={inputCls} style={inputStyle} rows={2} value={b.caption ?? ""} onChange={(e) => onChange({ ...b, caption: e.target.value })} /></Field>
        <Hashtags value={b.hashtags} onChange={(hashtags) => onChange({ ...b, hashtags })} />
      </div>
    );
  }

  // -------- Story --------
  const b = body as StoryBody;
  const frames = b.frames ?? [];
  const setFrames = (x: StoryFrame[]) => onChange({ ...b, frames: x });
  const patch = (i: number, p: Partial<StoryFrame>) => setFrames(frames.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Frames ({frames.length})</div>
      <div className="space-y-2">
        {frames.map((f, i) => (
          <div key={i} className="rounded-xl p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold" style={{ color: "var(--accent-ink)" }}>Frame {i + 1}</span>
              <button type="button" onClick={() => setFrames(frames.filter((_, j) => j !== i))} style={{ color: "var(--faint)" }}>✕</button>
            </div>
            <textarea className={`${inputCls} mb-1.5`} style={inputStyle} rows={2} value={f.text ?? ""} onChange={(e) => patch(i, { text: e.target.value })} placeholder="Frame text (keep it short)" />
            <input className={inputCls} style={inputStyle} value={f.sticker ?? ""} onChange={(e) => patch(i, { sticker: e.target.value })} placeholder="Sticker / interaction — poll, quiz, link…" />
          </div>
        ))}
        <AddBtn label="Add frame" onClick={() => setFrames([...frames, {}])} />
      </div>
      <Field label="Swipe-up link (optional)"><input className={inputCls} style={inputStyle} value={b.link ?? ""} onChange={(e) => onChange({ ...b, link: e.target.value })} placeholder="https://puresol.in/…" /></Field>
    </div>
  );
}
