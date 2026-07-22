// Server component — shows the client exactly where each post sits in the pipeline.
import type { ContentItem } from "@/lib/types";
import { CLIENT_STEPS as STEPS, stageStep } from "./client/shared";

function Track({ step, accent }: { step: number; accent: string }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => {
        const done = i < step;
        const cur = i === step;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1" style={{ minWidth: 0 }}>
              <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold"
                style={done || cur ? { background: accent, color: "#fff" } : { background: "var(--panel-2)", color: "var(--faint)", border: "1px solid var(--line-2)" }}>
                {done ? "✓" : i + 1}
              </span>
              <span className="hidden text-[9px] font-semibold uppercase tracking-wide sm:block" style={{ color: cur ? accent : "var(--faint)", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < STEPS.length - 1 ? <span className="mx-1 h-0.5 flex-1" style={{ background: i < step ? accent : "var(--line-2)" }} /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function ClientPipeline({ posts, accent }: { posts: ContentItem[]; accent: string }) {
  // Only posts still moving through the pipeline (hide long-published ones).
  const inFlight = posts
    .filter((p) => p.stage !== "published")
    .sort((a, b) => (a.planned_date ?? "").localeCompare(b.planned_date ?? ""));
  if (inFlight.length === 0) return null;

  return (
    <section>
      <div className="mb-1 flex items-baseline gap-3">
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>Where your posts are</h2>
        <span className="pill scheduled">{inFlight.length} in progress</span>
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>Live status of everything the team is working on for you this month.</p>
      <div className="space-y-2.5">
        {inFlight.map((p) => {
          const step = stageStep(p.stage);
          return (
            <div key={p.id} className="card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{p.title}</span>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{p.format}</span>
                {p.planned_date ? <span className="text-[11px]" style={{ color: "var(--faint)" }}>· {new Date(p.planned_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : null}
                <span className="pill pending ml-auto">{STEPS[step]}</span>
              </div>
              <Track step={step} accent={accent} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
