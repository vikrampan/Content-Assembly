"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPublished, schedulePost } from "./actions";

export function Scheduler({
  contentId,
  stage,
  scheduledAt,
}: {
  contentId: string;
  stage: string;
  scheduledAt: string | null;
}) {
  const [when, setWhen] = useState(() => {
    const d = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 3600_000);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (stage !== "scheduling" && stage !== "published") return null;

  function run(p: Promise<{ ok: true; message?: string } | { error: string }>) {
    setMsg(null);
    start(async () => {
      const res = await p;
      if ("error" in res) setMsg({ kind: "err", text: res.error });
      else { setMsg({ kind: "ok", text: res.message ?? "Done." }); router.refresh(); }
    });
  }

  const published = stage === "published";

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Social scheduling</h2>
        <span className={`pill ${published ? "published" : "scheduled"}`}>{published ? "Published" : scheduledAt ? "Scheduled" : "Unscheduled"}</span>
      </div>

      {published ? (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          This post is live{scheduledAt ? ` (queued for ${new Date(scheduledAt).toLocaleString()})` : ""}. Meta auto-publish + analytics land here once connected.
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>Publish date &amp; time</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => run(schedulePost(contentId, when))} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
              {scheduledAt ? "Reschedule" : "Schedule"}
            </button>
            <button type="button" onClick={() => run(markPublished(contentId))} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--good)" }}>
              Mark published
            </button>
          </div>
        </div>
      )}
      {msg ? (
        <div className="mt-2 text-xs" style={{ color: msg.kind === "ok" ? "var(--good)" : "var(--danger)" }}>{msg.text}</div>
      ) : null}
    </section>
  );
}
