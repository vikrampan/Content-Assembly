"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { aiConcierge } from "../aiClient";
import { useOnline } from "@/components/ui/Network";

interface Msg { role: "user" | "assistant"; text: string }

const SUGGESTIONS = [
  "What's coming up this week?",
  "How are my posts doing?",
  "What's my brand voice?",
];

export function Concierge({ brandName }: { brandName: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const online = useOnline();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, pending]);

  function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    if (!online) {
      setMsgs((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "📡 You're offline right now — reconnect and I'll pick right back up." }]);
      setInput("");
      return;
    }
    const history = msgs.slice();
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    start(async () => {
      try {
        const res = await aiConcierge(q, history);
        setMsgs((m) => [...m, { role: "assistant", text: res.text ?? res.error ?? "Sorry, I couldn't answer that." }]);
      } catch {
        setMsgs((m) => [...m, { role: "assistant", text: "Something went wrong reaching the assistant. Please try again in a moment." }]);
      }
    });
  }

  return (
    <>
      {/* Launcher */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Ask AI"
        data-tour="concierge"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105"
        style={{ background: "var(--accent)", boxShadow: "0 8px 30px rgba(45,32,20,.35)" }}>
        <span className="text-xl">{open ? "✕" : "✦"}</span>
      </button>

      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[560px] sm:max-h-[80vh] sm:w-[380px]"
          style={{ maxHeight: "85vh" }}>
          <div className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-none sm:rounded-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b p-4" style={{ borderColor: "var(--line)", background: "linear-gradient(120deg, var(--accent-soft), transparent)" }}>
              <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: "var(--accent)" }}>✦</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Brand assistant</div>
                <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>Ask anything about {brandName}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-lg sm:hidden" style={{ color: "var(--faint)" }}>✕</button>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: "var(--muted)" }}>Hi 👋 I&apos;m your brand assistant. I know your calendar, brand book, and how your posts are doing. Try:</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => send(s)}
                        className="rounded-full px-3 py-1.5 text-xs font-medium transition hover:brightness-95"
                        style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{s}</button>
                    ))}
                  </div>
                </div>
              ) : null}
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
                    style={m.role === "user"
                      ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 }
                      : { background: "var(--panel-2)", color: "var(--ink)", borderBottomLeftRadius: 4 }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {pending ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-3.5 py-2.5" style={{ background: "var(--panel-2)" }}>
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--faint)", animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--faint)", animationDelay: "120ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--faint)", animationDelay: "240ms" }} />
                    </span>
                  </div>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t p-3" style={{ borderColor: "var(--line)" }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your brand…"
                className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
              <button type="submit" disabled={pending || !input.trim()}
                className="shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                style={{ background: "var(--accent)" }}>Send</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
