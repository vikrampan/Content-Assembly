"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientReview } from "./actions";

const FMT_LABEL: Record<string, string> = { post: "Single post", carousel: "Carousel", reel: "Reel" };

export function PostApproval({
  contentId,
  title,
  hook,
  bridge,
  cta,
  format,
  plannedDate,
  accent,
}: {
  contentId: string;
  title: string;
  hook: string | null;
  bridge: string | null;
  cta: string | null;
  format: string;
  plannedDate: string | null;
  accent: string;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function act(decision: "approve" | "request_changes") {
    setMsg(null);
    start(async () => {
      const res = await clientReview(contentId, decision, comment);
      if ("error" in res) setMsg(res.error);
      else router.refresh();
    });
  }

  const dateLabel = plannedDate
    ? new Date(plannedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* Branded thumbnail placeholder — real creative slots in here later */}
      <div
        className="relative flex aspect-[4/5] items-end p-3.5"
        style={{ background: `linear-gradient(150deg, ${accent}, color-mix(in srgb, ${accent} 45%, #3a2a1a))` }}
      >
        <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
          {FMT_LABEL[format] ?? format}
        </span>
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(120px 90px at 70% 25%, rgba(255,220,150,.45), transparent 70%)" }}
        />
        <h3
          className="relative font-bold leading-tight text-white"
          style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", textShadow: "0 2px 12px rgba(0,0,0,.35)" }}
        >
          {title}
        </h3>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--faint)" }}>
          <span className="pill pending">Needs approval</span>
          {dateLabel ? <span className="ml-auto">{dateLabel}</span> : null}
        </div>
        <div className="space-y-1 text-sm">
          {hook ? <p className="font-semibold leading-snug">{hook}</p> : null}
          {bridge ? <p style={{ color: "var(--muted)" }}>{bridge}</p> : null}
          {cta ? <p className="font-semibold" style={{ color: "var(--accent-ink)" }}>{cta}</p> : null}
        </div>

        {rejecting ? (
          <div className="mt-auto space-y-2 pt-2">
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="What would you like changed?"
              className="w-full resize-y rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}
            />
            <div className="flex gap-2">
              <button type="button" disabled={pending || !comment.trim()} onClick={() => act("request_changes")} className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-40" style={{ background: "var(--danger)" }}>Send request</button>
              <button type="button" onClick={() => { setRejecting(false); setComment(""); }} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex gap-2 pt-2">
            <button type="button" disabled={pending} onClick={() => act("approve")} className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--good)" }}>Approve</button>
            <button type="button" onClick={() => setRejecting(true)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Request changes</button>
          </div>
        )}
        {msg ? <div className="text-xs" style={{ color: "var(--danger)" }}>{msg}</div> : null}
      </div>
    </div>
  );
}
