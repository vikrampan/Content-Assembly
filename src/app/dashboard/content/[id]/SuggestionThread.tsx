"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { suggestPost } from "@/app/dashboard/actions";

export interface Msg { id: string; body: string; mine: boolean }

export function SuggestionThread({ contentId, messages }: { contentId: string; messages: Msg[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function send() {
    if (!text.trim()) return;
    start(async () => {
      const res = await suggestPost(contentId, text);
      if (!("error" in res)) { setText(""); router.refresh(); }
    });
  }

  return (
    <section className="card p-4" style={{ borderColor: "var(--accent)" }}>
      <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>Client conversation</h2>
      <div className="mb-3 space-y-2">
        {messages.length === 0 ? <p className="text-xs" style={{ color: "var(--faint)" }}>No messages yet — reply here and the client sees it in their portal.</p> : null}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.mine ? "ml-auto" : ""}`} style={m.mine ? { background: "var(--accent)", color: "#fff" } : { background: "var(--accent-soft)" }}>
            <div className="mb-0.5 text-[9px] font-bold uppercase opacity-70">{m.mine ? "You (team)" : "Client"}</div>
            {m.body}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Reply to the client…" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
        <button type="button" onClick={send} disabled={pending || !text.trim()} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Send</button>
      </div>
    </section>
  );
}
