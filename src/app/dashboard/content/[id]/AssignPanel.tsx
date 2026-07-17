"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/mendly/departments";
import { assignToDept, returnToAdmin } from "./actions";

const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5";

// Desks admin can route work to (the doing desks).
const TARGETS = DEPARTMENTS.filter((d) =>
  ["capture", "content", "design", "video", "image", "audio", "qa", "social"].includes(d.key),
);

export function AssignPanel({
  contentId,
  assignedDept,
  note,
  fn,
}: {
  contentId: string;
  assignedDept: string | null;
  note: string | null;
  fn: string;
}) {
  const [dept, setDept] = useState(TARGETS[0]?.key ?? "content");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const isAdmin = fn === "admin";
  const isMine = fn === assignedDept;

  function assign() {
    setMsg(null);
    start(async () => {
      const res = await assignToDept(contentId, dept, text);
      if ("error" in res) setMsg(res.error);
      else { setText(""); router.refresh(); }
    });
  }
  function ret() {
    setMsg(null);
    start(async () => {
      const res = await returnToAdmin(contentId, text);
      if ("error" in res) setMsg(res.error);
      else { setText(""); router.refresh(); }
    });
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Assignment</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${assignedDept ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" : "bg-black/10 dark:bg-white/10"}`}>
          {assignedDept ? `With the ${DEPARTMENT_LABELS[assignedDept] ?? assignedDept} desk` : "With Admin"}
        </span>
      </div>

      {note ? (
        <div className="mb-3 rounded-lg border-l-2 border-amber-500 bg-amber-500/5 px-3 py-2 text-xs">
          <span className="font-semibold opacity-70">Brief: </span>{note}
        </div>
      ) : null}

      {isAdmin ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select className={`${inputCls} max-w-[200px]`} value={dept} onChange={(e) => setDept(e.target.value)}>
              {TARGETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            <button onClick={assign} disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50">
              {assignedDept ? "Reassign" : "Send to desk"}
            </button>
          </div>
          <textarea className={inputCls} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Brief for this desk (optional)…" />
        </div>
      ) : isMine ? (
        <div className="space-y-2">
          <textarea className={inputCls} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Note back to admin (optional)…" />
          <button onClick={ret} disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">
            Return to admin
          </button>
        </div>
      ) : (
        <p className="text-xs opacity-55">Only the admin routes this item, and only the assigned desk can return it.</p>
      )}

      {msg ? <div className="mt-2 text-xs text-red-600">{msg}</div> : null}
    </section>
  );
}
