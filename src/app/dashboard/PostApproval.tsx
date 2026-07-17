"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientReview } from "./actions";

export function PostApproval({
  contentId,
  hook,
  bridge,
  cta,
  format,
}: {
  contentId: string;
  hook: string | null;
  bridge: string | null;
  cta: string | null;
  format: string;
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

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 text-[11px] uppercase tracking-wide opacity-45">{format}</div>
      <div className="space-y-1.5 text-sm">
        {hook ? <p className="font-medium leading-snug">{hook}</p> : null}
        {bridge ? <p className="opacity-80">{bridge}</p> : null}
        {cta ? <p className="text-[var(--brand,#B4622E)]">{cta}</p> : null}
      </div>

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="What would you like changed?"
            className="w-full resize-y rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/10"
          />
          <div className="flex gap-2">
            <button type="button" disabled={pending || !comment.trim()} onClick={() => act("request_changes")} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40">Send request</button>
            <button type="button" onClick={() => { setRejecting(false); setComment(""); }} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={pending} onClick={() => act("approve")} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">Approve</button>
          <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">Request changes</button>
        </div>
      )}
      {msg ? <div className="mt-2 text-xs text-red-600">{msg}</div> : null}
    </div>
  );
}
