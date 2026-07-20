// Server component — read-only "what's going live" for the client.
export interface UpcomingEntry { id: string; platform: string; scheduled_at: string; title: string; status: string }

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

export function UpcomingSchedule({ entries, accent }: { entries: UpcomingEntry[]; accent: string }) {
  if (entries.length === 0) return null;
  const byDay = new Map<string, UpcomingEntry[]>();
  for (const e of entries) {
    const k = e.scheduled_at.slice(0, 10);
    const list = byDay.get(k) ?? [];
    list.push(e);
    byDay.set(k, list);
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>Going live</h2>
      <div className="space-y-3">
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day} className="card p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{DAY(day + "T00:00:00")}</div>
            <div className="space-y-2">
              {list.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm font-semibold tabular-nums" style={{ color: accent }}>{new Date(e.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                  <span className="pill scheduled capitalize">{e.platform}</span>
                  <span className="flex-1 truncate text-sm">{e.title}</span>
                  {e.status === "published" ? <span className="pill published">Live</span> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
