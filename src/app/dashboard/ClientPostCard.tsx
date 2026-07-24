"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientReview, requestPostChange, suggestPost } from "./actions";

const CHANGE_TYPES = [
  { key: "content", label: "The caption / words" },
  { key: "media", label: "The photo / video" },
  { key: "editing", label: "The design / edit" },
  { key: "combination", label: "A mix of things" },
] as const;

export interface Creative { url: string; isVideo: boolean }
export interface ThreadMsg { id: string; body: string; mine: boolean; at: string }
export interface Variant { platform: string; body: string }

const FMT: Record<string, string> = { post: "Single post", carousel: "Carousel", reel: "Reel" };

export function ClientPostCard({
  contentId, title, hook, bridge, cta, format, plannedDate, accent, creatives, variants, thread,
}: {
  contentId: string; title: string; hook: string | null; bridge: string | null; cta: string | null;
  format: string; plannedDate: string | null; accent: string;
  creatives: Creative[]; variants: Variant[]; thread: ThreadMsg[];
}) {
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [changeType, setChangeType] = useState<"content" | "media" | "editing" | "combination">("content");
  const [chat, setChat] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const hero = creatives[0];
  const dateLabel = plannedDate ? new Date(plannedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  function approve() {
    setMsg(null);
    start(async () => {
      const res = await clientReview(contentId, "approve", "");
      if ("error" in res) setMsg(res.error);
      else { setOpen(false); router.refresh(); }
    });
  }
  function requestChange() {
    setMsg(null);
    start(async () => {
      const res = await requestPostChange(contentId, changeType, comment);
      if ("error" in res) setMsg(res.error);
      else { setOpen(false); router.refresh(); }
    });
  }
  function send() {
    if (!chat.trim()) return;
    start(async () => {
      const res = await suggestPost(contentId, chat);
      if (!("error" in res)) { setChat(""); router.refresh(); }
    });
  }

  return (
    <>
      <div className="card flex flex-col overflow-hidden">
        <button type="button" onClick={() => setOpen(true)} className="relative flex aspect-[4/5] items-end p-3.5 text-left"
          style={hero && !hero.isVideo ? { backgroundImage: `url(${hero.url})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(150deg, ${accent}, color-mix(in srgb, ${accent} 45%, #3a2a1a))` }}>
          {hero?.isVideo ? <video src={hero.url} className="absolute inset-0 h-full w-full object-cover" muted /> : null}
          <span className="absolute left-3 top-3 rounded-full bg-black/30 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-white backdrop-blur-sm">{FMT[format] ?? format}</span>
          {creatives.length > 1 ? <span className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-1 text-[0.6rem] font-bold text-white">+{creatives.length - 1}</span> : null}
          {!hero ? <h3 className="relative font-bold leading-tight text-white" style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", textShadow: "0 2px 12px rgba(0,0,0,.35)" }}>{title}</h3> : null}
        </button>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--faint)" }}>
            <span className="pill pending">Needs approval</span>
            {thread.length ? <span>💬 {thread.length}</span> : null}
            {dateLabel ? <span className="ml-auto">{dateLabel}</span> : null}
          </div>
          {hook ? <p className="text-sm font-semibold leading-snug">{hook}</p> : null}
          <div className="mt-auto flex gap-2 pt-2">
            <button type="button" disabled={pending} onClick={approve} className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--good)" }}>Approve</button>
            <button type="button" onClick={() => setOpen(true)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>View &amp; discuss</button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setOpen(false)}>
          <div className="card my-6 w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--line)" }}>
              <h3 className="text-base font-bold" style={{ fontFamily: "var(--serif)" }}>{title}</h3>
              <button type="button" onClick={() => setOpen(false)} style={{ color: "var(--faint)" }}>×</button>
            </div>

            <div className="grid gap-0 md:grid-cols-2">
              {/* Creative + copy */}
              <div className="space-y-3 p-4" style={{ borderRight: "1px solid var(--line)" }}>
                {creatives.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {creatives.map((c, i) => (
                      <div key={i} className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--line)" }}>
                        {c.isVideo ? <video src={c.url} controls className="h-full w-full" /> :
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.url} alt="" className="h-full w-full object-cover" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg p-6 text-center text-xs" style={{ background: "var(--panel-2)", color: "var(--faint)" }}>Creative in production.</div>
                )}
                <div className="space-y-1.5 text-sm">
                  {hook ? <p className="font-semibold">{hook}</p> : null}
                  {bridge ? <p style={{ color: "var(--muted)" }}>{bridge}</p> : null}
                  {cta ? <p className="font-semibold" style={{ color: "var(--accent-ink)" }}>{cta}</p> : null}
                </div>
                {variants.length > 0 ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold" style={{ color: "var(--muted)" }}>Per-platform versions ({variants.length})</summary>
                    <div className="mt-2 space-y-2">
                      {variants.map((v) => (
                        <div key={v.platform} className="rounded-lg p-2" style={{ background: "var(--panel-2)" }}>
                          <div className="mb-0.5 text-[10px] font-bold uppercase" style={{ color: "var(--accent-ink)" }}>{v.platform}</div>
                          <div className="whitespace-pre-wrap">{v.body}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>

              {/* Thread */}
              <div className="flex flex-col p-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Conversation</div>
                <div className="mb-3 flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 220 }}>
                  {thread.length === 0 ? <p className="text-xs" style={{ color: "var(--faint)" }}>Ask a question or suggest a change — your team will reply here.</p> : null}
                  {thread.map((m) => (
                    <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${m.mine ? "ml-auto" : ""}`} style={m.mine ? { background: accent, color: "#fff" } : { background: "var(--panel-2)" }}>
                      <div className="mb-0.5 text-[9px] font-bold uppercase opacity-70">{m.mine ? "You" : "Your team"}</div>
                      {m.body}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={chat} onChange={(e) => setChat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Write a message…" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
                  <button type="button" onClick={send} disabled={pending || !chat.trim()} className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Send</button>
                </div>
              </div>
            </div>

            {/* Decision bar */}
            <div className="border-t p-4" style={{ borderColor: "var(--line)" }}>
              {rejecting ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>What needs to change?</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CHANGE_TYPES.map((t) => (
                      <button key={t.key} type="button" onClick={() => setChangeType(t.key)} className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                        style={changeType === t.key ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{t.label}</button>
                    ))}
                  </div>
                  <textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Tell the team what to change…" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
                  <div className="flex gap-2">
                    <button type="button" disabled={pending || !comment.trim()} onClick={requestChange} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--danger)" }}>Send request</button>
                    <button type="button" onClick={() => setRejecting(false)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button type="button" disabled={pending} onClick={approve} className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--good)" }}>Approve this post</button>
                  <button type="button" onClick={() => setRejecting(true)} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Request changes</button>
                </div>
              )}
              {msg ? <div className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{msg}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
