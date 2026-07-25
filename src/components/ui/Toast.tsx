"use client";

// Toaster — transient feedback for success / error / info / loading. No deps.
// Mount <ToastProvider> once at the root; call useToast() anywhere beneath it.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Spinner } from "./States";

type Kind = "success" | "error" | "info" | "loading";
interface Toast { id: number; kind: Kind; message: string }

interface ToastApi {
  show: (kind: Kind, message: string, opts?: { duration?: number; id?: number }) => number;
  success: (m: string) => number;
  error: (m: string) => number;
  info: (m: string) => number;
  loading: (m: string) => number;
  dismiss: (id: number) => void;
  /** Run a promise with loading→success/error toasts; returns the promise. */
  promise: <T>(p: Promise<T>, msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) }) => Promise<T>;
}

const Ctx = createContext<ToastApi | null>(null);

const ICON: Record<Kind, ReactNode> = {
  success: "✓",
  error: "!",
  info: "i",
  loading: <Spinner size={14} />,
};
const TONE: Record<Kind, { bg: string; fg: string }> = {
  success: { bg: "var(--good)", fg: "#fff" },
  error: { bg: "var(--danger)", fg: "#fff" },
  info: { bg: "var(--ink)", fg: "var(--panel)" },
  loading: { bg: "var(--panel-2)", fg: "var(--ink)" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const tm = timers.current.get(id);
    if (tm) { clearTimeout(tm); timers.current.delete(id); }
  }, []);

  const show = useCallback((kind: Kind, message: string, opts?: { duration?: number; id?: number }) => {
    const id = opts?.id ?? ++seq.current;
    setToasts((t) => {
      const exists = t.some((x) => x.id === id);
      return exists ? t.map((x) => (x.id === id ? { ...x, kind, message } : x)) : [...t, { id, kind, message }];
    });
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    const duration = opts?.duration ?? (kind === "loading" ? 0 : 4000);
    if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (m) => show("success", m),
    error: (m) => show("error", m),
    info: (m) => show("info", m),
    loading: (m) => show("loading", m),
    dismiss,
    promise: async (p, msgs) => {
      const id = show("loading", msgs.loading);
      try {
        const v = await p;
        show("success", typeof msgs.success === "function" ? msgs.success(v) : msgs.success, { id });
        return v;
      } catch (e) {
        show("error", typeof msgs.error === "function" ? msgs.error(e) : msgs.error, { id });
        throw e;
      }
    },
  }), [show, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:items-end" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium shadow-lg"
            style={{ background: TONE[t.kind].bg, color: TONE[t.kind].fg, animation: "toastIn .18s ease-out" }}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,.22)" }}>{ICON[t.kind]}</span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}`}</style>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
