"use client";

// Network-layer awareness — a live online/offline signal and a global banner
// so the app degrades gracefully when the connection drops.

import { useEffect, useState } from "react";

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

/** Fixed banner shown whenever the browser reports no connection. */
export function NetworkBanner() {
  const online = useOnline();
  const [everOffline, setEverOffline] = useState(false);
  useEffect(() => { if (!online) setEverOffline(true); }, [online]);

  if (online) {
    // Briefly confirm reconnection after having been offline.
    if (!everOffline) return null;
    return (
      <div className="fixed inset-x-0 top-0 z-[90] py-1.5 text-center text-xs font-semibold text-white" style={{ background: "var(--good)", animation: "netIn .2s ease-out" }}>
        Back online ✓
        <style>{`@keyframes netIn{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:none}}`}</style>
      </div>
    );
  }
  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 py-1.5 text-center text-xs font-semibold text-white" style={{ background: "var(--danger)" }} role="alert">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> You&apos;re offline — changes may not save until you reconnect.
    </div>
  );
}
