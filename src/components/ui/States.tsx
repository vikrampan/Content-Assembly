// Shared UI states — the vocabulary every SaaS screen needs: loading, empty,
// error (with retry), and inline spinners. Themed via the design tokens.
import type { ReactNode } from "react";

export function Spinner({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 p-8 text-sm" style={{ color: "var(--muted)" }} role="status" aria-live="polite">
      <Spinner /> {label}
    </div>
  );
}

/** Nothing here yet — icon, message, and an optional call to action. */
export function EmptyState({ icon = "✦", title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl text-2xl" style={{ background: "var(--panel-2)" }}>{icon}</div>
      <div className="max-w-sm">
        <div className="text-base font-semibold">{title}</div>
        {description ? <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Something failed — a clear message and, when recoverable, a retry. */
export function ErrorState({ title = "Something went wrong", description, onRetry, retrying, offline }: {
  title?: string; description?: string; onRetry?: () => void; retrying?: boolean; offline?: boolean;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center" role="alert">
      <div className="grid h-12 w-12 place-items-center rounded-2xl text-xl" style={{ background: offline ? "var(--panel-2)" : "rgba(192,85,63,.12)" }}>{offline ? "📡" : "⚠️"}</div>
      <div className="max-w-sm">
        <div className="text-sm font-semibold" style={{ color: offline ? "var(--ink)" : "var(--danger)" }}>{title}</div>
        {description ? <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{description}</p> : null}
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} disabled={retrying}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:brightness-95 disabled:opacity-60"
          style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>
          {retrying ? <Spinner size={14} /> : "↻"} Try again
        </button>
      ) : null}
    </div>
  );
}
