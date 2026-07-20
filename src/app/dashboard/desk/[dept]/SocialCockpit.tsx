"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelScheduled, publishScheduled } from "@/app/dashboard/content/[id]/actions";

export interface SocialEntry {
  id: string;
  content_id: string;
  platform: string;
  scheduled_at: string;
  status: "queued" | "published" | "canceled" | "failed";
  title: string;
  brand: string;
}

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

export function SocialCockpit({ entries, metaConnected }: { entries: SocialEntry[]; metaConnected: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const queued = entries.filter((e) => e.status === "queued");
  const published = entries.filter((e) => e.status === "published");

  const byDay = new Map<string, SocialEntry[]>();
  for (const e of [...queued].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))) {
    const k = e.scheduled_at.slice(0, 10);
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e);
  }

  function run(p: Promise<{ ok: true; message?: string } | { error: string }>) {
    setMsg(null);
    start(async () => {
      const res = await p;
      if ("error" in res) setMsg(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-3 text-xs" style={metaConnected ? { background: "var(--good-soft)", color: "var(--good)" } : { background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
        {metaConnected ? "✓ Meta connected — queued posts auto-publish at their time." : "Meta not connected — the queue is live, and you publish with one click. Auto-publish activates once Meta is linked (Admin phase)."}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-2xl font-bold tabular-nums">{queued.length}</div><div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Queued</div></div>
        <div className="card p-4"><div className="text-2xl font-bold tabular-nums">{published.length}</div><div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Published</div></div>
        <div className="card p-4"><div className="text-2xl font-bold tabular-nums">{new Set(entries.map((e) => e.content_id)).size}</div><div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Posts</div></div>
      </div>

      {msg ? <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>{msg}</div> : null}

      {byDay.size === 0 ? (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>Nothing queued — approved posts get scheduled from the content page.</div>
      ) : (
        <div className="space-y-4">
          {[...byDay.entries()].map(([day, list]) => (
            <div key={day}>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{DAY(day + "T00:00:00")}</div>
              <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
                {list.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 p-3" style={{ borderColor: "var(--line)" }}>
                    <span className="w-14 shrink-0 text-sm font-semibold tabular-nums" style={{ color: "var(--accent-ink)" }}>{new Date(e.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                    <span className="pill scheduled capitalize">{e.platform}</span>
                    <Link href={`/dashboard/content/${e.content_id}`} className="flex-1 truncate text-sm font-medium hover:underline">{e.title}</Link>
                    <span className="text-xs" style={{ color: "var(--faint)" }}>{e.brand}</span>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => run(publishScheduled(e.id, e.content_id))} disabled={pending} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: "var(--good)" }}>Publish now</button>
                      <button type="button" onClick={() => run(cancelScheduled(e.id, e.content_id))} disabled={pending} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--danger)" }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
