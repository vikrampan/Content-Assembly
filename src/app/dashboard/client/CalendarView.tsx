"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientReview, requestPostChange, suggestPost } from "../actions";
import { stageLabel } from "./stage";

const CHANGE_TYPES = [
  { key: "content", label: "Caption" },
  { key: "media", label: "Photo/video" },
  { key: "editing", label: "Design" },
  { key: "combination", label: "A mix" },
] as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CalPost {
  id: string; title: string; stage: string; format: string; planned_date: string;
  hook: string | null; bridge: string | null; cta: string | null; creative: string | null; isVideo: boolean; suggestions: number;
}

export function CalendarView({ year, month, posts, accent }: { year: number; month: number; posts: CalPost[]; accent: string }) {
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

  return (
    <>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7">
          {DOW.map((d) => (
            <div key={d} className="p-2.5 text-center text-[0.66rem] font-bold uppercase tracking-wider" style={{ color: "var(--faint)", borderBottom: "1px solid var(--line)" }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            const list = day ? byDay.get(day) ?? [] : [];
            return (
              <button
                key={i}
                type="button"
                disabled={!day}
                onClick={() => day && list.length > 0 && setDayIdx(day)}
                className="min-h-[92px] p-1.5 text-left align-top transition"
                style={{
                  borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--line)",
                  borderBottom: "1px solid var(--line)",
                  cursor: day && list.length ? "pointer" : "default",
                  background: dayIdx === day ? "var(--accent-soft)" : "transparent",
                }}
              >
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
      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>Tap any day with posts to see the details.</p>

      {/* Day detail drawer */}
      {dayIdx != null ? (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setDayIdx(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto p-5" style={{ background: "var(--panel)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{MONTHS[month]} {dayIdx}, {year}</div>
                <h3 className="text-lg font-bold" style={{ fontFamily: "var(--serif)" }}>{dayPosts.length} post{dayPosts.length !== 1 ? "s" : ""}</h3>
              </div>
              <button type="button" onClick={() => setDayIdx(null)} style={{ color: "var(--faint)" }}>×</button>
            </div>

            {msg ? <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{msg}</div> : null}

            <div className="space-y-4">
              {dayPosts.map((p) => (
                <div key={p.id} className="card overflow-hidden">
                  {p.creative ? (
                    <div className="aspect-[4/5] w-full" style={{ background: "var(--panel-2)" }}>
                      {p.isVideo ? <video src={p.creative} controls className="h-full w-full object-cover" /> :
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.creative} alt={p.title} className="h-full w-full object-cover" />}
                    </div>
                  ) : null}
                  <div className="space-y-2 p-4">
                    <div className="flex items-center gap-2">
                      <span className="pill scheduled">{stageLabel(p.stage)}</span>
                      <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{p.format}</span>
                    </div>
                    <h4 className="text-base font-bold" style={{ fontFamily: "var(--serif)" }}>{p.title}</h4>
                    {p.hook ? <p className="text-sm font-medium">{p.hook}</p> : null}
                    {p.bridge ? <p className="text-sm" style={{ color: "var(--muted)" }}>{p.bridge}</p> : null}
                    {p.cta ? <p className="text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>{p.cta}</p> : null}
                    {!p.hook && !p.bridge ? <p className="text-xs italic" style={{ color: "var(--faint)" }}>The team is still writing this one.</p> : null}

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
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
