"use client";

import { useState, useTransition } from "react";
import { resetClientLogin } from "../actions";

export function ClientLoginCard({ workspaceId, email }: { workspaceId: string; email: string | null }) {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setMsg(null);
    start(async () => {
      const res = await resetClientLogin(workspaceId, pw);
      if ("error" in res) setMsg({ kind: "err", text: res.error });
      else { setMsg({ kind: "ok", text: "Password updated. Share it securely with the client." }); setPw(""); }
    });
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">Client login <span className="text-[11px] font-normal" style={{ color: "var(--faint)" }}>(admin only)</span></h2>
      <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>The brand owner signs into their portal with this email.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="text-sm">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Email</div>
          <div className="font-mono">{email ?? "— no client login —"}</div>
        </div>
        {email ? (
          <div className="ml-auto flex items-end gap-2">
            <label className="text-xs">
              <span className="mb-1 block" style={{ color: "var(--muted)" }}>New password</span>
              <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="min 8 chars" className="rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
            </label>
            <button type="button" onClick={reset} disabled={pending || pw.length < 8} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
              {pending ? "…" : "Reset password"}
            </button>
          </div>
        ) : null}
      </div>
      {msg ? <div className="mt-2 text-xs" style={{ color: msg.kind === "ok" ? "var(--good)" : "var(--danger)" }}>{msg.text}</div> : null}
    </section>
  );
}
