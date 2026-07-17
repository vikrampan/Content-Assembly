"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { suggestPost } from "./actions";

export function CalendarPostChip({
  contentId,
  title,
  accent,
  suggestionCount,
}: {
  contentId: string;
  title: string;
  accent: string;
  suggestionCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setErr(null);
    start(async () => {
      const res = await suggestPost(contentId, text);
      if ("error" in res) setErr(res.error);
      else { setDone(true); setText(""); router.refresh(); setTimeout(() => setOpen(false), 900); }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setDone(false); }}
        className="mt-1.5 flex w-full items-center gap-1 overflow-hidden rounded-md px-1.5 py-1 text-left text-[0.7rem] leading-tight"
        style={{ background: "var(--panel-2)", borderLeft: `3px solid ${accent}` }}
        title={`${title} — click to suggest a change`}
      >
        <span className="truncate">{title}</span>
        {suggestionCount > 0 ? (
          <span className="ml-auto shrink-0 rounded-full px-1.5 text-[9px] font-bold text-white" style={{ background: accent }}>{suggestionCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }} onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Suggest a change</div>
            <div className="mb-3 text-base font-semibold" style={{ fontFamily: "var(--serif)" }}>{title}</div>
            {done ? (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--good-soft)", color: "var(--good)" }}>Sent to your team — thank you!</div>
            ) : (
              <>
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  placeholder="e.g. Can we move this to the weekend and feature the new dish?"
                  className="w-full resize-y rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}
                />
                {err ? <div className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{err}</div> : null}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={submit} disabled={pending || !text.trim()} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
                    {pending ? "Sending…" : "Send suggestion"}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
