import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/KanbanBoard";
import { columnsForRole } from "@/lib/pipeline";
import { getDepartment } from "@/lib/mendly/departments";
import type { ContentItem, ContentStatus, Workspace } from "@/lib/types";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide opacity-55">
        {label}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  // RLS scopes every one of these queries automatically. A client literally
  // cannot receive another workspace's rows or internal WIP — the filters
  // below are for UX ordering, not the security boundary.
  const { data: contentRaw } = await supabase
    .from("content_items")
    .select("*")
    .order("updated_at", { ascending: false });
  const content = (contentRaw as ContentItem[]) ?? [];

  const { data: workspacesRaw } = await supabase
    .from("workspaces")
    .select("*")
    .order("name");
  const workspaces = (workspacesRaw as Workspace[]) ?? [];

  const columns = columnsForRole(session.role);

  const countBy = (statuses: ContentStatus[]) =>
    content.filter((c) => statuses.includes(c.status)).length;

  // --- Role-specific header ------------------------------------------------
  const headers: Record<string, { title: string; subtitle: string }> = {
    admin: {
      title: "Master Control Room",
      subtitle: "All workspaces, pipeline bottlenecks, and team activity.",
    },
    team_incharge: {
      title: "Creator Workspace",
      subtitle: "Execute the 4-Layer SOP across your assigned clients.",
    },
    client: {
      title: "Your Content Pipeline",
      subtitle: "Review, approve, and track your brand's content.",
    },
  };
  const header = headers[session.role];

  // The signed-in team member's desk (from their first membership with one).
  const myDeptKey = session.memberships.map((m) => m.department).find(Boolean) ?? null;
  const myDesk = getDepartment(myDeptKey);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{header.title}</h1>
        <p className="text-sm opacity-60">{header.subtitle}</p>
      </div>

      {myDesk ? (
        <Link
          href={`/dashboard/desk/${myDesk.key}`}
          className="flex items-center gap-3 rounded-2xl border border-amber-500 bg-amber-500/10 px-4 py-3 text-sm transition hover:bg-amber-500/20"
        >
          <span className="font-medium">Go to your desk — {myDesk.label}</span>
          <span className="opacity-70">{myDesk.blurb}</span>
          <span className="ml-auto text-amber-700 dark:text-amber-400">→</span>
        </Link>
      ) : null}

      {/* Metrics vary by role. */}
      {session.role === "admin" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Workspaces" value={workspaces.length} />
          <Metric label="Total content" value={content.length} />
          <Metric label="Awaiting admin" value={countBy(["admin_review"])} />
          <Metric
            label="With client"
            value={countBy(["ready_for_client_review", "changes_requested"])}
          />
        </div>
      ) : session.role === "team_incharge" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            label="In production"
            value={countBy(["research", "copywriting", "visuals", "assembly"])}
          />
          <Metric label="Admin review" value={countBy(["admin_review"])} />
          <Metric
            label="Changes requested"
            value={countBy(["changes_requested"])}
          />
          <Metric
            label="Live / scheduled"
            value={countBy(["scheduled", "published"])}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric
            label="Pending your approval"
            value={countBy(["ready_for_client_review"])}
          />
          <Metric
            label="Approved"
            value={countBy(["approved", "scheduled", "published"])}
          />
          <Metric label="Ideas shared" value={countBy(["ideation"])} />
        </div>
      )}

      {/* Admin sees which workspaces exist; a client never sees this list. */}
      {session.role === "admin" && workspaces.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {workspaces.map((w) => (
            <span
              key={w.id}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs dark:border-white/10 dark:bg-white/5"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: `#${w.primary_hex ?? "cccccc"}` }}
              />
              {w.name}
            </span>
          ))}
        </div>
      ) : null}

      {content.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm opacity-60 dark:border-white/15">
          No content visible to you yet.
          {session.role === "admin"
            ? " Create a workspace and seed some content to get started (see supabase/seed.sql)."
            : session.role === "client"
              ? " Your team will share items here when they're ready for review."
              : " Get assigned to a workspace, or create your first content item."}
        </div>
      ) : (
        <KanbanBoard columns={columns} items={content} role={session.role} />
      )}
    </div>
  );
}
