"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientReview, requestPostChange, suggestPost } from "../actions";
import { stageLabel } from "./stage";
import { ContentPreview } from "../content/[id]/ContentPreview";
import type { ContentBody, ContentFormat, PostBody, CarouselBody, ReelBody, StoryBody } from "@/lib/types";

const CHANGE_TYPES = [
  { key: "content", label: "Caption" },
  { key: "media", label: "Photo/video" },
  { key: "editing", label: "Design" },
  { key: "combination", label: "A mix" },
] as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const OBJ_LABEL: Record<string, string> = { launch: "Launch something new", educate: "Educate or tell a story", vibe: "Build vibe & immersion", urgency: "Drive urgency & reach" };

export interface CalPost {
  id: string; title: string; stage: string; format: string; planned_date: string;
  objective: string | null; campaign: string | null; pillar: string | null; platform: string | null; formatType: string | null;
  brief: { angle?: string; key_message?: string; creative_direction?: string; cta?: string; platform?: string; plan?: { purpose: string; note: string }[] } | null;
  body: ContentBody | null;
  hook: string | null; bridge: string | null; cta: string | null;
  creatives: { url: string; isVideo: boolean }[]; suggestions: number;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: "var(--ink)" }}>{value}</div>
    </div>
  );
}
function Tags({ tags }: { tags?: string[] }) {
  if (!tags || !tags.length) return null;
  return <div className="text-xs" style={{ color: "var(--info)" }}>{tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}</div>;
}

/** Read-only, format-aware rendering of the actual content. */
function ContentDetail({ format, body }: { format: string; body: ContentBody | null }) {
  if (!body) return null;
  if (format === "carousel") {
    const b = body as CarouselBody;
    if (!b.slides?.length && !b.caption) return null;
    return (
      <div className="space-y-2">
        {b.slides?.map((s, i) => (
          <div key={i} className="rounded-lg p-2.5" style={{ background: "var(--panel-2)" }}>
            <div className="text-[10px] font-bold uppercase" style={{ color: "var(--accent-ink)" }}>Slide {i + 1}</div>
            {s.heading ? <div className="text-sm font-semibold">{s.heading}</div> : null}
            {s.body ? <div className="text-xs" style={{ color: "var(--muted)" }}>{s.body}</div> : null}
          </div>
        ))}
        <Row label="Caption" value={b.caption} />
        <Tags tags={b.hashtags} />
      </div>
    );
  }
  if (format === "reel") {
    const b = body as ReelBody;
    if (!b.hook_text && !b.beats?.length && !b.caption) return null;
    return (
      <div className="space-y-2">
        {b.hook_text ? <div className="rounded-lg p-2.5 text-sm font-semibold" style={{ background: "var(--panel-2)" }}>🎬 {b.hook_text}</div> : null}
        <div className="flex gap-3 text-[11px]" style={{ color: "var(--muted)" }}>
          {b.duration_sec ? <span>⏱ {b.duration_sec}s</span> : null}
          {b.audio ? <span>♪ {b.audio}</span> : null}
        </div>
        {b.beats?.length ? (
          <div className="space-y-1.5">
            {b.beats.map((beat, i) => (
              <div key={i} className="rounded-lg p-2" style={{ background: "var(--panel-2)" }}>
                <div className="text-[10px] font-bold" style={{ color: "var(--accent-ink)" }}>{beat.time || `Beat ${i + 1}`}</div>
                {beat.scene ? <div className="text-xs"><span style={{ color: "var(--faint)" }}>Scene: </span>{beat.scene}</div> : null}
                {beat.on_screen ? <div className="text-xs"><span style={{ color: "var(--faint)" }}>On-screen: </span>{beat.on_screen}</div> : null}
                {beat.voiceover ? <div className="text-xs"><span style={{ color: "var(--faint)" }}>Voiceover: </span>{beat.voiceover}</div> : null}
              </div>
            ))}
          </div>
        ) : null}
        <Row label="Caption" value={b.caption} />
        <Tags tags={b.hashtags} />
      </div>
    );
  }
  if (format === "story") {
    const b = body as StoryBody;
    if (!b.frames?.length) return null;
    return (
      <div className="space-y-2">
        {b.frames.map((f, i) => (
          <div key={i} className="rounded-lg p-2.5" style={{ background: "var(--panel-2)" }}>
            <div className="text-[10px] font-bold uppercase" style={{ color: "var(--accent-ink)" }}>Frame {i + 1}</div>
            {f.text ? <div className="text-sm">{f.text}</div> : null}
            {f.sticker ? <div className="text-[11px]" style={{ color: "var(--muted)" }}>🎯 {f.sticker}</div> : null}
          </div>
        ))}
        <Row label="Link" value={b.link} />
      </div>
    );
  }
  const b = body as PostBody;
  if (!b.hook && !b.body && !b.cta && !b.caption) return null;
  return (
    <div className="space-y-2">
      {b.hook ? <p className="text-sm font-semibold">{b.hook}</p> : null}
      {b.body ? <p className="text-sm" style={{ color: "var(--muted)" }}>{b.body}</p> : null}
      {b.cta ? <p className="text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>{b.cta}</p> : null}
      <Row label="Caption" value={b.caption} />
      <Tags tags={b.hashtags} />
    </div>
  );
}

export function CalendarView({ year, month, posts, accent, brandName }: { year: number; month: number; posts: CalPost[]; accent: string; brandName: string }) {
  const [dayIdx, setDayIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [changeType, setChangeType] = useState<"content" | "media" | "editing" | "combination">("content");
  const [pending, start] = useTransition();
  const router = useRouter();

  const byDay = new Map<number, CalPost[]>();
  for (const p of posts) {
    const d = new Date(p.planned_date + "T00:00:00").getDate();
    const l = byDay.get(d) ?? []; l.push(p); byDay.set(d, l);
  }
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayNum = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;
  const cells: (number | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const dayPosts = dayIdx != null ? (byDay.get(dayIdx) ?? []) : [];

  function approve(id: string) {
    setMsg(null);
    start(async () => {
      const res = await clientReview(id, "approve", "");
      if ("error" in res) setMsg(res.error);
      else { setNote(""); router.refresh(); setDayIdx(null); }
    });
  }
  function reqChange(id: string) {
    if (!note.trim()) return;
    setMsg(null);
    start(async () => {
      const res = await requestPostChange(id, changeType, note);
      if ("error" in res) setMsg(res.error);
      else { setNote(""); router.refresh(); setDayIdx(null); }
    });
  }
  function suggest(id: string) {
    if (!note.trim()) return;
    start(async () => {
      const res = await suggestPost(id, note);
      if (!("error" in res)) { setNote(""); setMsg("Sent to your team ✓"); router.refresh(); }
    });
  }

  function go(delta: number) {
    const d = new Date(year, month + delta, 1);
    router.push(`?m=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <>
      {/* Month navigation */}
      <div className="mb-3 flex items-center gap-3">
        <button type="button" onClick={() => go(-1)} className="rounded-lg px-2.5 py-1.5 text-sm transition hover:brightness-95" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>‹</button>
        <div className="min-w-[150px] text-center text-sm font-semibold">{MONTHS[month]} {year}</div>
        <button type="button" onClick={() => go(1)} className="rounded-lg px-2.5 py-1.5 text-sm transition hover:brightness-95" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>›</button>
        {posts.length > 0 ? <span className="ml-auto text-xs" style={{ color: "var(--faint)" }}>{posts.length} post{posts.length !== 1 ? "s" : ""}</span> : null}
      </div>

      {posts.length === 0 ? (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>Nothing planned for {MONTHS[month]} yet — use ‹ › to check another month.</div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7">
          {DOW.map((d) => (
            <div key={d} className="p-2.5 text-center text-[0.66rem] font-bold uppercase tracking-wider" style={{ color: "var(--faint)", borderBottom: "1px solid var(--line)" }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            const list = day ? byDay.get(day) ?? [] : [];
            return (
              <button key={i} type="button" disabled={!day} onClick={() => day && list.length > 0 && setDayIdx(day)}
                className="min-h-[92px] p-1.5 text-left align-top transition"
                style={{ borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--line)", borderBottom: "1px solid var(--line)", cursor: day && list.length ? "pointer" : "default", background: dayIdx === day ? "var(--accent-soft)" : "transparent" }}>
                {day ? (
                  <>
                    <div className="text-xs tabular-nums" style={day === todayNum ? { background: accent, color: "#fff", width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 700 } : { color: "var(--faint)" }}>{day}</div>
                    {list.map((p) => (
                      <div key={p.id} className="mt-1.5 flex items-center gap-1 overflow-hidden rounded-md px-1.5 py-1 text-[0.7rem] leading-tight" style={{ background: "var(--panel-2)", borderLeft: `3px solid ${accent}` }}>
                        <span className="truncate">{p.title}</span>
                        {p.suggestions > 0 ? <span className="ml-auto shrink-0 rounded-full px-1 text-[9px] font-bold text-white" style={{ background: accent }}>{p.suggestions}</span> : null}
                      </div>
                    ))}
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>Tap any day with posts to see the full details.</p>

      {/* Day detail drawer */}
      {dayIdx != null ? (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setDayIdx(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto p-5" style={{ background: "var(--panel)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{MONTHS[month]} {dayIdx}, {year}</div>
                <h3 className="text-lg font-bold" style={{ fontFamily: "var(--serif)" }}>{dayPosts.length} post{dayPosts.length !== 1 ? "s" : ""}</h3>
              </div>
              <button type="button" onClick={() => setDayIdx(null)} style={{ color: "var(--faint)" }}>×</button>
            </div>

            {msg ? <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{msg}</div> : null}

            <div className="space-y-5">
              {dayPosts.map((p) => {
                const brief = p.brief ?? {};
                const hasContent = !!p.body || p.hook || p.bridge || p.cta;
                return (
                  <div key={p.id} className="card overflow-hidden">
                    {/* Visual: real creative(s) if any, else the live preview mockup */}
                    {p.creatives.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1 p-1">
                        {p.creatives.map((c, i) => (
                          <div key={i} className="overflow-hidden rounded-lg" style={{ background: "var(--panel-2)" }}>
                            {c.isVideo ? <video src={c.url} controls className="h-full w-full object-cover" /> :
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.url} alt={p.title} className="h-full w-full object-cover" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-center p-4" style={{ background: "var(--panel-2)" }}>
                        <ContentPreview format={p.format as ContentFormat} body={p.body ?? {}} brand={{ name: brandName, accent }} />
                      </div>
                    )}

                    <div className="space-y-3 p-4">
                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="pill scheduled">{stageLabel(p.stage)}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{p.format}</span>
                        {p.platform ? <span className="text-[11px]" style={{ color: "var(--faint)" }}>{p.platform}</span> : null}
                      </div>
                      <h4 className="text-base font-bold" style={{ fontFamily: "var(--serif)" }}>{p.title}</h4>

                      {/* The brief — why this post exists */}
                      {(brief.angle || brief.key_message || brief.creative_direction || p.objective || p.pillar || p.campaign) ? (
                        <div className="space-y-2 rounded-xl p-3" style={{ background: "var(--accent-soft)" }}>
                          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--accent-ink)" }}>What this post is</div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--muted)" }}>
                            {p.objective ? <span><b style={{ color: "var(--ink)" }}>Goal:</b> {OBJ_LABEL[p.objective] ?? p.objective}</span> : null}
                            {p.pillar ? <span><b style={{ color: "var(--ink)" }}>Pillar:</b> {p.pillar}</span> : null}
                            {p.campaign ? <span><b style={{ color: "var(--ink)" }}>Campaign:</b> {p.campaign}</span> : null}
                          </div>
                          <Row label="Angle" value={brief.angle} />
                          <Row label="Key message" value={brief.key_message} />
                          <Row label="Creative direction" value={brief.creative_direction} />
                          {brief.plan && brief.plan.length ? (
                            <div>
                              <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{p.format === "carousel" ? "Slide" : p.format === "reel" ? "Beat" : p.format === "story" ? "Frame" : "Step"} plan</div>
                              <div className="mt-1 space-y-0.5">
                                {brief.plan.map((s, k) => (
                                  <div key={k} className="flex gap-1.5 text-[11px]"><span className="shrink-0 font-semibold" style={{ color: "var(--accent-ink)" }}>{k + 1} · {s.purpose}</span><span style={{ color: "var(--muted)" }}>{s.note}</span></div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {/* The content */}
                      {hasContent ? (
                        <div>
                          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--faint)" }}>The content</div>
                          {p.body ? <ContentDetail format={p.format} body={p.body} />
                            : <div className="space-y-1.5 text-sm">
                                {p.hook ? <p className="font-semibold">{p.hook}</p> : null}
                                {p.bridge ? <p style={{ color: "var(--muted)" }}>{p.bridge}</p> : null}
                                {p.cta ? <p className="font-semibold" style={{ color: "var(--accent-ink)" }}>{p.cta}</p> : null}
                              </div>}
                        </div>
                      ) : <p className="text-xs italic" style={{ color: "var(--faint)" }}>The team is still writing this one.</p>}

                      {/* Actions */}
                      {p.stage === "client_review" ? (
                        <div className="space-y-2 rounded-xl p-3" style={{ background: "var(--panel-2)" }}>
                          <button type="button" disabled={pending} onClick={() => approve(p.id)} className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--good)" }}>Approve this post</button>
                          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>…or request a change</div>
                          <div className="flex flex-wrap gap-1.5">
                            {CHANGE_TYPES.map((t) => (
                              <button key={t.key} type="button" onClick={() => setChangeType(t.key)} className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition" style={changeType === t.key ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{t.label}</button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change?" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
                            <button type="button" disabled={pending || !note.trim()} onClick={() => reqChange(p.id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--danger)" }}>Send</button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Suggest a change</div>
                          <div className="flex gap-2">
                            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ask a question or request a tweak…" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
                            <button type="button" disabled={pending || !note.trim()} onClick={() => suggest(p.id)} className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Send</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
