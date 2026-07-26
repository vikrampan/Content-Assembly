"use client";

// Network-layer awareness — a live online/offline signal and a global banner
// so the app degrades gracefully when the connection drops.

import { useEffect, useRef, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

/**
 * Fixed banner: persistent while offline; a brief "Back online" confirmation
 * that auto-dismisses ~2.5s after the connection returns.
 */
export function NetworkBanner() {
  const online = useOnline();
  const [reconnected, setReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setReconnected(false);
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setReconnected(true);
      const t = setTimeout(() => setReconnected(false), 2500);
      return () => clearTimeout(t);
    }
  }, [online]);

  if (!online) {
    return (
      <div className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 py-1.5 text-center text-xs font-semibold text-white" style={{ background: "var(--danger)" }} role="alert">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> You&apos;re offline — changes may not save until you reconnect.
      </div>
    );
  }
  if (reconnected) {
    return (
      <div className="fixed inset-x-0 top-0 z-[90] py-1.5 text-center text-xs font-semibold text-white" style={{ background: "var(--good)", animation: "netIn .2s ease-out" }}>
        Back online ✓
        <style>{`@keyframes netIn{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:none}}`}</style>
      </div>
    );
  }
  return null;
}
