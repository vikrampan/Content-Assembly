import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/pipeline";
import { OBJECTIVE_LABELS, type Objective } from "@/lib/mendly/strategy";
import type { ContentItem, Workspace } from "@/lib/types";
import { AssignPanel } from "./AssignPanel";
import { ContentEditor } from "./ContentEditor";
import { QaFirewall } from "./QaFirewall";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide opacity-55">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAccess("content_detail");

  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", id)
    .single<ContentItem>();
  if (!item) notFound();

  const { data: ws } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", item.workspace_id)
    .single<Workspace>();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/dashboard" className="text-xs opacity-60 hover:underline">
          ← Board
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{item.title}</h1>
          <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-xs dark:bg-white/10">
            {STATUS_LABELS[item.status]}
          </span>
          <span className="text-xs uppercase tracking-wide opacity-55">{item.format}</span>
        </div>
        {ws ? <p className="text-sm opacity-60">{ws.name}</p> : null}
      </div>

      {/* Admin routing / desk hand-off. */}
      <AssignPanel
        contentId={item.id}
        assignedDept={item.assigned_dept}
        note={item.assignment_note}
        fn={session.fn}
      />

      {/* The brief that travels with the asset (Stage 04). */}
      <section className="grid gap-4 rounded-2xl border border-black/10 bg-white/60 p-4 sm:grid-cols-2 dark:border-white/10 dark:bg-white/5">
        <Field
          label="Objective"
          value={item.objective ? (OBJECTIVE_LABELS[item.objective as Objective] ?? item.objective) : null}
        />
        <Field label="Chosen format" value={item.format_type} />
        {item.format_rationale ? (
          <div className="sm:col-span-2">
            <div className="text-[11px] uppercase tracking-wide opacity-55">Why this format</div>
            <div className="mt-0.5 text-xs opacity-80">{item.format_rationale}</div>
          </div>
        ) : null}
      </section>

      {/* The three-tier copy (Stage 05) — editable: AI proposes, humans refine. */}
      <ContentEditor item={item} />

      {/* The firewall (Stage 06) — the gate to the client. */}
      <QaFirewall contentId={item.id} status={item.status} initial={item.qa_checklist} />
    </div>
  );
}
