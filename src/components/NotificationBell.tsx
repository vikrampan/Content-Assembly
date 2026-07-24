"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/types";
import { markNotificationsRead } from "@/app/dashboard/actions";

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationBell({ items, unread }: { items: Notification[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next && unread > 0) start(async () => { await markNotificationsRead(); router.refresh(); });
      return next;
    });
  }

  return (
    <div className="relative">
      <button type="button" onClick={toggle} aria-label="Notifications" className="grid h-8 w-8 place-items-center rounded-lg" style={{ color: "var(--side-muted)" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white" style={{ background: "var(--accent)" }}>{unread > 9 ? "9+" : unread}</span> : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-10 left-0 z-50 w-72 overflow-hidden rounded-xl shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
            <div className="border-b px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>Notifications</div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--muted)" }}>You&apos;re all caught up.</div>
              ) : items.map((n) => (
                <Link key={n.id} href={n.link ?? "/dashboard"} onClick={() => setOpen(false)} className="flex flex-col gap-0.5 border-b px-3 py-2.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]" style={{ borderColor: "var(--line)", background: n.read ? "transparent" : "var(--accent-soft)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>{n.title}</span>
                    <span className="ml-auto text-[10px]" style={{ color: "var(--faint)" }}>{ago(n.created_at)}</span>
                  </div>
                  {n.body ? <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>{n.body}</div> : null}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
