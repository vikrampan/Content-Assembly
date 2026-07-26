"use client";

// Live "see what you're making" mockup. Renders the format-shaped body as it'll
// appear — a vertical reel/story, a swipeable carousel, or a feed post.

import { useState } from "react";
import type { ContentBody, ContentFormat, PostBody, CarouselBody, ReelBody, StoryBody } from "@/lib/types";

interface Brand { name: string; accent: string }

function Chrome({ brand, children }: { brand: Brand; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[22px]" style={{ border: "1px solid var(--line-2)", background: "var(--panel)", boxShadow: "var(--shadow)" }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: brand.accent }}>{brand.name.slice(0, 1).toUpperCase()}</span>
        <span className="text-xs font-semibold">{brand.name.toLowerCase().replace(/\s+/g, "")}</span>
        <span className="ml-auto text-xs" style={{ color: "var(--faint)" }}>•••</span>
      </div>
      {children}
    </div>
  );
}
function Media({ accent, ratio, children }: { accent: string; ratio: string; children?: React.ReactNode }) {
  return (
    <div className="relative flex items-center justify-center p-4 text-center" style={{ aspectRatio: ratio, background: `linear-gradient(150deg, ${accent}, color-mix(in srgb, ${accent} 40%, #2a1e12))` }}>
      {children}
    </div>
  );
}
function Caption({ brand, hook, text, tags }: { brand: Brand; hook?: string; text?: string; tags?: string[] }) {
  return (
    <div className="space-y-1 px-3 py-2.5">
      <div className="flex gap-3 text-lg" style={{ color: "var(--ink)" }}>♡ 💬 ➤</div>
      {(hook || text) ? (
        <div className="text-xs leading-relaxed">
          <span className="font-semibold">{brand.name.toLowerCase().replace(/\s+/g, "")} </span>
          {hook ? <span className="font-medium">{hook} </span> : null}
          {text ? <span style={{ color: "var(--muted)" }}>{text}</span> : null}
        </div>
      ) : <div className="text-xs italic" style={{ color: "var(--faint)" }}>Your caption will appear here…</div>}
      {tags && tags.length ? <div className="text-xs" style={{ color: "var(--info)" }}>{tags.join(" ")}</div> : null}
    </div>
  );
}

export function ContentPreview({ format, body, brand }: { format: ContentFormat; body: ContentBody; brand: Brand }) {
  const [slide, setSlide] = useState(0);

  if (format === "reel") {
    const b = body as ReelBody;
    return (
      <Chrome brand={brand}>
        <Media accent={brand.accent} ratio="9/16">
          {b.duration_sec ? <span className="absolute right-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-white">{b.duration_sec}s</span> : null}
          <span className="absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-white">▶ Reel</span>
          <div className="text-lg font-bold leading-tight text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{b.hook_text || "Your on-screen hook"}</div>
          {b.audio ? <div className="absolute bottom-2 left-2 right-2 truncate text-[10px] text-white/90">♪ {b.audio}</div> : null}
        </Media>
        <Caption brand={brand} text={b.caption} tags={b.hashtags} />
      </Chrome>
    );
  }
  if (format === "story") {
    const b = body as StoryBody;
    const f = b.frames?.[0];
    return (
      <Chrome brand={brand}>
        <Media accent={brand.accent} ratio="9/16">
          <span className="absolute inset-x-2 top-2 h-0.5 rounded bg-white/70" />
          <div className="text-base font-semibold leading-snug text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{f?.text || "Your first frame"}</div>
          {f?.sticker ? <div className="absolute bottom-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold">{f.sticker}</div> : null}
        </Media>
        <div className="px-3 py-2 text-[10px]" style={{ color: "var(--faint)" }}>{b.frames?.length ?? 0} frame{(b.frames?.length ?? 0) === 1 ? "" : "s"}</div>
      </Chrome>
    );
  }
  if (format === "carousel") {
    const b = body as CarouselBody;
    const slides = b.slides ?? [];
    const cur = slides[slide] ?? slides[0];
    return (
      <Chrome brand={brand}>
        <Media accent={brand.accent} ratio="4/5">
          <div>
            {cur?.heading ? <div className="text-base font-bold leading-tight text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{cur.heading}</div> : <div className="text-sm text-white/80">Slide {slide + 1}</div>}
            {cur?.body ? <div className="mt-1.5 text-xs text-white/90">{cur.body}</div> : null}
          </div>
          {slides.length > 1 ? (
            <>
              <button type="button" onClick={() => setSlide((s) => Math.max(0, s - 1))} className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/30 px-1.5 text-white">‹</button>
              <button type="button" onClick={() => setSlide((s) => Math.min(slides.length - 1, s + 1))} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/30 px-1.5 text-white">›</button>
              <div className="absolute bottom-2 flex gap-1">{slides.map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i === slide ? "#fff" : "rgba(255,255,255,.45)" }} />)}</div>
            </>
          ) : null}
        </Media>
        <Caption brand={brand} text={b.caption} tags={b.hashtags} />
      </Chrome>
    );
  }
  // post
  const b = body as PostBody;
  return (
    <Chrome brand={brand}>
      <Media accent={brand.accent} ratio="4/5">
        {b.hook ? <div className="text-base font-bold leading-tight text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{b.hook}</div> : null}
      </Media>
      <Caption brand={brand} hook={b.hook} text={b.caption || b.body} tags={b.hashtags} />
    </Chrome>
  );
}
