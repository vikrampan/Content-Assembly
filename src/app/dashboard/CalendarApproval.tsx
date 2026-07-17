"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewCalendar } from "./actions";

export function CalendarApproval({
  workspaceId,
  month,
  status,
  note,
}: {
  workspaceId: string;
  month: string;
  status: "pending" | "approved" | "changes_requested";
  note: string | null;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function act(decision: "approve" | "request_changes") {
    setMsg(null);
    start(async () => {
      const res = await reviewCalendar(workspaceId, month, decision, comment);
      if ("error" in res) setMsg(res.error);
      else { setRejecting(false); setComment(""); router.refresh(); }
    });
  }

  if (status === "approved") {
    return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">✓ Approved</span>;
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {status === "changes_requested" ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Changes requested</span>
        ) : null}
        {!rejecting ? (
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => act("approve")} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">Approve this month</button>
            <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">Request changes</button>
          </div>
        ) : null}
      </div>
      {note && status === "changes_requested" ? (
        <p className="mt-2 text-xs opacity-70"><span className="font-semibold">Your note: </span>{note}</p>
      ) : null}
      {rejecting ? (
        <div className="mt-2 space-y-2">
          <textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="What should change in the plan?" className="w-full resize-y rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/10" />
          <div className="flex gap-2">
            <button type="button" disabled={pending || !comment.trim()} onClick={() => act("request_changes")} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40">Send request</button>
            <button type="button" onClick={() => { setRejecting(false); setComment(""); }} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">Cancel</button>
          </div>
        </div>
      ) : null}
      {msg ? <div className="mt-2 text-xs text-red-600">{msg}</div> : null}
    </div>
  );
}
