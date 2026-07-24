"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addClientMember, removeClientMember, resetUserPassword } from "../actions";

export interface ClientMember { userId: string; email: string; name: string; role: string }

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

export function ClientTeamCard({ workspaceId, members }: { workspaceId: string; members: ClientMember[] }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [role, setRole] = useState<"owner" | "reviewer">("reviewer");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(p: Promise<{ ok: true } | { error: string }>, okText: string) {
    setMsg(null);
    start(async () => {
      const res = await p;
      if ("error" in res) setMsg({ kind: "err", text: res.error });
      else { setMsg({ kind: "ok", text: okText }); router.refresh(); }
    });
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">Client team <span className="text-[11px] font-normal" style={{ color: "var(--faint)" }}>(admin only)</span></h2>
      <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>Everyone here can sign into this brand&apos;s portal. Add reviewers alongside the owner.</p>

      <div className="mt-3 space-y-2">
        {members.length === 0 ? <div className="text-xs" style={{ color: "var(--faint)" }}>No client logins yet.</div> : null}
        {members.map((m) => (
          <div key={m.userId} className="rounded-xl p-3" style={{ background: "var(--panel-2)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill" style={m.role === "owner" ? { background: "var(--accent-soft)", color: "var(--accent-ink)" } : { background: "var(--line-2)", color: "var(--muted)" }}>{m.role || "reviewer"}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{m.name}</div>
                <div className="truncate font-mono text-[11px]" style={{ color: "var(--muted)" }}>{m.email}</div>
              </div>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => { setResetFor(resetFor === m.userId ? null : m.userId); setResetPw(""); }} className="text-xs font-medium hover:underline" style={{ color: "var(--muted)" }}>Reset</button>
                <button type="button" onClick={() => run(removeClientMember(workspaceId, m.userId), "Removed.")} disabled={pending} className="text-xs font-medium" style={{ color: "var(--danger)" }}>Remove</button>
              </div>
            </div>
            {resetFor === m.userId ? (
              <div className="mt-2 flex gap-2">
                <input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="new password (min 8)" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none" style={inputStyle} />
                <button type="button" onClick={() => run(resetUserPassword(m.userId, resetPw), "Password updated.")} disabled={pending || resetPw.length < 8} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Set</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl p-3" style={{ border: "1px dashed var(--line-2)" }}>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Add a client user</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password (min 8)" className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          <select value={role} onChange={(e) => setRole(e.target.value as "owner" | "reviewer")} className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
            <option value="reviewer">Reviewer</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <button type="button" onClick={() => { run(addClientMember(workspaceId, { email, name, password: pw, role }), "Client user added."); setEmail(""); setName(""); setPw(""); }} disabled={pending || !email || pw.length < 8} className="mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {pending ? "Adding…" : "Add client user"}
        </button>
      </div>
      {msg ? <div className="mt-2 text-xs" style={{ color: msg.kind === "ok" ? "var(--good)" : "var(--danger)" }}>{msg.text}</div> : null}
    </section>
  );
}
