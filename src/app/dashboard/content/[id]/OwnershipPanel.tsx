"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOwnership } from "./actions";

export interface StaffOption { id: string; name: string; department: string | null }

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

export function OwnershipPanel({ contentId, assignedTo, dueDate, staff }: { contentId: string; assignedTo: string | null; dueDate: string | null; staff: StaffOption[] }) {
  const [assignee, setAssignee] = useState(assignedTo ?? "");
  const [due, setDue] = useState(dueDate ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const dirty = assignee !== (assignedTo ?? "") || due !== (dueDate ?? "");
  const overdue = due && new Date(due) < new Date(new Date().toDateString());

  function save() {
    setMsg(null);
    start(async () => {
      const res = await setOwnership(contentId, assignee || null, due || null);
      if ("error" in res) setMsg({ kind: "err", text: res.error });
      else { setMsg({ kind: "ok", text: "Saved." }); router.refresh(); }
    });
  }

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold">Ownership</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs">
          <span className="mb-1 block" style={{ color: "var(--muted)" }}>Assigned to</span>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
            <option value="">— unassigned —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.department ? ` · ${s.department}` : ""}</option>)}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block" style={{ color: "var(--muted)" }}>Due date</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, borderColor: overdue ? "var(--danger)" : "var(--line-2)" }} />
        </label>
        {overdue ? <span className="pill" style={{ background: "rgba(192,85,63,.14)", color: "var(--danger)" }}>Overdue</span> : null}
        <button type="button" onClick={save} disabled={pending || !dirty} className="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {msg ? <div className="mt-2 text-xs" style={{ color: msg.kind === "ok" ? "var(--good)" : "var(--danger)" }}>{msg.text}</div> : null}
    </section>
  );
}
