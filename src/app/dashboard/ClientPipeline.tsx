"use client";

// "Where your posts are" — instead of repeating a 6-step tracker on every post,
// we show the journey ONCE as glanceable stage counts (with "Ready for you"
// emphasised), then group the posts under their current stage. Tap a stage to
// filter. Fully responsive; friendly, plain-English status.

import { useState } from "react";
import Link from "next/link";
import type { ContentItem } from "@/lib/types";
import { stageStep } from "./client/stage";

interface StageMeta { label: string; icon: string; blurb: string; tone: string; href?: string }

// In-flight stages only (published is hidden here). Index === stageStep.
const STAGES: StageMeta[] = [
  { label: "Planned", icon: "🗓️", blurb: "On the calendar, not started yet", tone: "var(--faint)" },
  { label: "In production", icon: "🎬", blurb: "Your team is creating these", tone: "var(--info)" },
  { label: "Quality check", icon: "🔍", blurb: "Being checked before you see them", tone: "var(--accent-ink)" },
  { label: "Ready for you", icon: "✅", blurb: "Waiting for your approval", tone: "var(--accent)", href: "/dashboard/approvals" },
  { label: "Scheduled", icon: "📤", blurb: "Approved and queued to post", tone: "var(--good)" },
];

function fmtDate(d: string | null) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
}

export function ClientPipeline({ posts }: { posts: ContentItem[]; accent?: string }) {
  const [filter, setFilter] = useState<number | null>(null);

  const inFlight = posts
    .filter((p) => p.stage !== "published")
    .map((p) => ({ ...p, step: Math.min(stageStep(p.stage), 4) }))
    .sort((a, b) => (a.planned_date ?? "").localeCompare(b.planned_date ?? ""));
  if (inFlight.length === 0) return null;

  const counts = STAGES.map((_, i) => inFlight.filter((p) => p.step === i).length);
  const readyCount = counts[3];

  // Stages to render as groups: the active filter, else every non-empty stage,
  // with "Ready for you" floated to the top because it needs the client.
  const order = [3, 0, 1, 2, 4];
  const visibleSteps = (filter === null ? order : [filter]).filter((i) => counts[i] > 0);

  return (
    <section>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>Where your posts are</h2>
        <span className="pill scheduled">{inFlight.length} in progress</span>
        {readyCount > 0 ? (
          <Link href="/dashboard/approvals" className="ml-auto text-xs font-semibold hover:underline" style={{ color: "var(--accent-ink)" }}>
            {readyCount} ready for you →
          </Link>
        ) : null}
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>Tap a stage to see what&apos;s there. Everything the team is working on for you this month.</p>

      {/* Journey overview — counts per stage, tappable to filter */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STAGES.map((s, i) => {
          const active = filter === i;
          const has = counts[i] > 0;
          const ready = i === 3 && counts[i] > 0;
          return (
            <button key={s.label} type="button" disabled={!has}
              onClick={() => setFilter(active ? null : i)}
              className="flex flex-col rounded-xl p-3 text-left transition disabled:cursor-default disabled:opacity-45"
              style={{
                border: `1px solid ${active ? s.tone : "var(--line)"}`,
                background: active ? "var(--accent-soft)" : ready ? "var(--accent-soft)" : "var(--panel)",
                boxShadow: active ? "var(--shadow)" : "none",
              }}>
              <div className="flex items-center justify-between">
                <span className="text-base leading-none">{s.icon}</span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: has ? s.tone : "var(--faint)" }}>{counts[i]}</span>
              </div>
              <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: has ? "var(--ink)" : "var(--faint)" }}>{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Grouped posts */}
      {filter !== null ? (
        <button type="button" onClick={() => setFilter(null)} className="mb-3 text-xs font-semibold hover:underline" style={{ color: "var(--muted)" }}>← Show all stages</button>
      ) : null}

      <div className="space-y-5">
        {visibleSteps.map((i) => {
          const s = STAGES[i];
          const group = inFlight.filter((p) => p.step === i);
          return (
            <div key={s.label}>
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full text-[11px]" style={{ background: "var(--panel-2)" }}>{s.icon}</span>
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>{group.length}</span>
                <span className="hidden text-xs sm:inline" style={{ color: "var(--faint)" }}>· {s.blurb}</span>
                {s.href ? <Link href={s.href} className="ml-auto text-xs font-semibold hover:underline" style={{ color: "var(--accent-ink)" }}>Review →</Link> : null}
              </div>
              <div className="card divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
                {group.map((p) => {
                  const date = fmtDate(p.planned_date);
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.tone }} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
                      <span className="hidden shrink-0 text-[11px] uppercase tracking-wide sm:inline" style={{ color: "var(--faint)" }}>{p.format}</span>
                      {date ? <span className="shrink-0 text-xs tabular-nums" style={{ color: "var(--muted)" }}>{date}</span> : null}
                      {i === 3 ? (
                        <Link href="/dashboard/approvals" className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105" style={{ background: "var(--accent)" }}>Approve</Link>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
