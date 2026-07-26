"use client";

import { useFormStatus } from "react-dom";
import { signIn } from "./actions";
import { Spinner } from "@/components/ui/States";

const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition";
const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

/** Inputs + submit, sharing one pending signal so the whole form locks + the
 *  button shows real progress the moment you click — no "is it stuck?" moment. */
function Fields() {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Email</span>
        <input name="email" type="email" required autoComplete="email" autoFocus placeholder="you@brand.com"
          className={inputCls} style={inputStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-2)")} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Password</span>
        <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••"
          className={inputCls} style={inputStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-2)")} />
      </label>
      <button type="submit" aria-busy={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-progress disabled:opacity-90"
        style={{ background: "var(--accent)" }}>
        {pending ? <><Spinner size={16} color="#fff" /> Signing you in…</> : "Sign in"}
      </button>
    </fieldset>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signIn} className="space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ background: "rgba(192,85,63,.12)", color: "var(--danger)" }} role="alert">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      ) : null}
      <Fields />
    </form>
  );
}
