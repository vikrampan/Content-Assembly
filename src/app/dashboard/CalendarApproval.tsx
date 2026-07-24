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

  // Finalized — locked. Allow reopening if the client wants further changes.
  if (status === "approved") {
    return (
      <div className="flex items-center gap-2">
        <span className="pill approved">✓ Finalized</span>
        <button type="button" disabled={pending} onClick={() => act("request_changes")} className="text-xs font-medium hover:underline" style={{ color: "var(--muted)" }}>Reopen</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {status === "changes_requested" ? <span className="pill pending">Changes requested</span> : null}
        {!rejecting ? (
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => act("approve")} className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--good)" }}>Finalize the plan</button>
            <button type="button" onClick={() => setRejecting(true)} className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Request changes</button>
          </div>
        ) : null}
      </div>
      {note && status === "changes_requested" ? (
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}><span className="font-semibold">Your note: </span>{note}</p>
      ) : null}
      {rejecting ? (
        <div className="mt-2 space-y-2">
          <textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="What should change in the plan?" className="w-full resize-y rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
          <div className="flex gap-2">
            <button type="button" disabled={pending || !comment.trim()} onClick={() => act("request_changes")} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-40" style={{ background: "var(--danger)" }}>Send request</button>
            <button type="button" onClick={() => { setRejecting(false); setComment(""); }} className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Cancel</button>
          </div>
        </div>
      ) : null}
      {msg ? <div className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{msg}</div> : null}
    </div>
  );
}
