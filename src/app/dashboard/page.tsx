import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/KanbanBoard";
import { HomeView } from "./client/HomeView";
import type { ContentItem, Workspace } from "@/lib/types";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4 shadow-sm">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide opacity-55">{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireAccess("board");

  // Clients get their own multi-section portal, not the internal control room.
  if (session.fn === "client") return <HomeView />;

  const supabase = await createClient();
  const [{ data: contentRaw }, { data: wsRaw }] = await Promise.all([
    supabase.from("content_items").select("*").order("updated_at", { ascending: false }),
    supabase.from("workspaces").select("*").order("name"),
  ]);
  const content = (contentRaw as ContentItem[]) ?? [];
  const workspaces = (wsRaw as Workspace[]) ?? [];
  const wsName = Object.fromEntries(workspaces.map((w) => [w.id, w.name]));

  const count = (stages: string[]) => content.filter((c) => stages.includes(c.stage)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl font-semibold" style={{ fontFamily: "Georgia, serif" }}>
          {session.fn === "admin" ? "Control Room" : "Pipeline"}
        </h1>
        <p className="text-sm opacity-60">
          {session.fn === "admin"
            ? "Every card, every desk — route work and watch it flow."
            : "Plan the month and move work through the pipeline."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric label="Total cards" value={content.length} />
        <Metric label="With admin" value={count(["planning"])} />
        <Metric label="In production" value={count(["content", "production"])} />
        <Metric label="With client" value={count(["client_review"])} />
        <Metric label="Live / scheduled" value={count(["scheduling", "published"])} />
      </div>

      {session.fn === "admin" && workspaces.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {workspaces.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[var(--panel)] px-3 py-1 text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: `#${w.primary_hex ?? "cccccc"}` }} />
              {w.name}
            </span>
          ))}
        </div>
      ) : null}

      {content.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm opacity-60 dark:border-white/15">
          No cards yet. {session.fn === "admin" ? "Onboard a brand and plan the calendar to get started." : "Plan the calendar to get started."}
        </div>
      ) : (
        <KanbanBoard items={content} wsName={wsName} />
      )}
    </div>
  );
}
