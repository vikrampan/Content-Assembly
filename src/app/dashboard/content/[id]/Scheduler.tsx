"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentVariant, ScheduledPost } from "@/lib/types";
import { PLATFORMS } from "@/lib/mendly/copy";
import { suggestSlots, toLocalInput } from "@/lib/social/times";
import { cancelScheduled, publishScheduled, reschedulePlatform, schedulePlatforms } from "./actions";

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

export function Scheduler({
  contentId,
  stage,
  variants,
  scheduled,
}: {
  contentId: string;
  stage: string;
  variants: ContentVariant[];
  scheduled: ScheduledPost[];
}) {
  const scheduledBy = new Map(scheduled.map((s) => [s.platform, s]));
  const initialSel: Record<string, { on: boolean; when: string; firstComment: string }> = {};
  for (const p of PLATFORMS) {
    const existing = scheduledBy.get(p.key);
    initialSel[p.key] = {
      on: !!existing,
      when: toLocalInput(existing?.scheduled_at ?? suggestSlots(p.key)[0] ?? new Date(Date.now() + 3600_000).toISOString()),
      firstComment: existing?.first_comment ?? "",
    };
  }
  const [sel, setSel] = useState(initialSel);
  const [utm, setUtm] = useState(scheduled[0]?.utm ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (stage !== "scheduling" && stage !== "published") return null;

  const upd = (k: string, patch: Partial<{ on: boolean; when: string; firstComment: string }>) => setSel((s) => ({ ...s, [k]: { ...s[k], ...patch } }));
  const run = (p: Promise<{ ok: true; message?: string } | { error: string }>) => {
    setMsg(null);
    start(async () => {
      const res = await p;
      if ("error" in res) setMsg({ kind: "err", text: res.error });
      else { if ("message" in res && res.message) setMsg({ kind: "ok", text: res.message }); router.refresh(); }
    });
  };

  function scheduleSelected() {
    const entries = PLATFORMS.filter((p) => sel[p.key].on).map((p) => ({ platform: p.key, scheduledAt: new Date(sel[p.key].when).toISOString(), firstComment: sel[p.key].firstComment }));
    if (entries.length === 0) { setMsg({ kind: "err", text: "Select at least one platform." }); return; }
    run(schedulePlatforms(contentId, entries, utm));
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Social scheduling</h2>
        <span className="text-xs" style={{ color: "var(--muted)" }}>Queue this post to each platform at its best time.</span>
      </div>

      {msg ? <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={msg.kind === "ok" ? { background: "var(--good-soft)", color: "var(--good)" } : { background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>{msg.text}</div> : null}

      <div className="space-y-2">
        {PLATFORMS.map((p) => {
          const s = sel[p.key];
          const existing = scheduledBy.get(p.key);
          const hasVariant = variants.some((v) => v.platform === p.key);
          return (
            <div key={p.key} className="rounded-xl p-3" style={{ background: s.on ? "var(--panel-2)" : "transparent", border: `1px solid ${s.on ? "var(--line)" : "transparent"}` }}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={s.on} onChange={(e) => upd(p.key, { on: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="capitalize">{p.label}</span>
                </label>
                {!hasVariant ? <span className="text-[10px]" style={{ color: "var(--faint)" }}>no variant — uses base copy</span> : null}
                {existing ? <span className={`pill ${existing.status === "published" ? "published" : "scheduled"}`}>{existing.status}</span> : null}
                {s.on ? (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <input type="datetime-local" value={s.when} onChange={(e) => upd(p.key, { when: e.target.value })} className="rounded-lg px-2 py-1.5 text-xs outline-none" style={inputStyle} />
                    <div className="flex gap-1">
                      {suggestSlots(p.key).slice(0, 3).map((iso) => (
                        <button key={iso} type="button" onClick={() => upd(p.key, { when: toLocalInput(iso) })} className="rounded px-1.5 py-1 text-[10px]" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--muted)" }} title="Best-time suggestion">
                          {new Date(iso).toLocaleDateString("en-US", { weekday: "short" })} {new Date(iso).getHours()}:00
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              {s.on ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input value={s.firstComment} onChange={(e) => upd(p.key, { firstComment: e.target.value })} placeholder="First comment (hashtags / link)…" className="min-w-[200px] flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
                  {existing ? (
                    <div className="flex gap-1.5">
                      {existing.status !== "published" ? <button type="button" onClick={() => run(publishScheduled(existing.id, contentId))} disabled={pending} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white" style={{ background: "var(--good)" }}>Publish now</button> : null}
                      {existing.status !== "published" ? <button type="button" onClick={() => run(reschedulePlatform(existing.id, new Date(s.when).toISOString(), contentId))} disabled={pending} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Reschedule</button> : null}
                      <button type="button" onClick={() => run(cancelScheduled(existing.id, contentId))} disabled={pending} className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--danger)" }}>Remove</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={utm} onChange={(e) => setUtm(e.target.value)} placeholder="UTM campaign (optional) — e.g. diwali_2026" className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        <button type="button" onClick={scheduleSelected} disabled={pending} className="ml-auto rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {pending ? "Scheduling…" : "Schedule selected"}
        </button>
      </div>
    </section>
  );
}
