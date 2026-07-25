import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL } from "@/lib/mendly/stages";
import { OBJECTIVE_LABELS, decideFormat, type Objective, type Medium } from "@/lib/mendly/strategy";
import type { Asset, ContentItem, ContentVariant, ContentVersion, Comment, QaGroup, ScheduledPost, Workspace } from "@/lib/types";
import { QA_FIREWALL } from "@/lib/mendly/pipeline";
import { AssignPanel } from "./AssignPanel";
import { OwnershipPanel, type StaffOption } from "./OwnershipPanel";
import { ContentEditor } from "./ContentEditor";
import { CopyStudio } from "./CopyStudio";
import { SuggestionThread } from "./SuggestionThread";
import { QaFirewall } from "./QaFirewall";
import { BrandRef } from "./BrandRef";
import { Deliverables, type DeliverableView } from "./Deliverables";
import { Scheduler } from "./Scheduler";

const IMG = /\.(png|jpe?g|gif|webp|avif)$/i;
const VID = /\.(mp4|mov|webm|m4v)$/i;
const basename = (p: string) => (p.split("/").pop() ?? p).replace(/^[0-9a-f-]{36}-/i, "");

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
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

  const [{ data: ws }, { data: versionRows }, { data: assetRows }, { data: commentRows }, { data: variantRows }, { data: checklistRow }, { data: scheduledRows }] = await Promise.all([
    supabase.from("workspaces").select("*").eq("id", item.workspace_id).single<Workspace>(),
    supabase.from("content_versions").select("*").eq("content_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("assets").select("*").eq("content_id", id).order("created_at", { ascending: false }),
    supabase.from("comments").select("*").eq("content_id", id).eq("internal", false).order("created_at", { ascending: false }),
    supabase.from("content_variants").select("*").eq("content_id", id).order("platform"),
    supabase.from("qa_checklists").select("groups").eq("workspace_id", item.workspace_id).maybeSingle<{ groups: QaGroup[] }>(),
    supabase.from("scheduled_posts").select("*").eq("content_id", id),
  ]);

  const { data: pillarRow } = item.pillar_id
    ? await supabase.from("content_pillars").select("name").eq("id", item.pillar_id).maybeSingle<{ name: string }>()
    : { data: null };

  const versions = (versionRows as ContentVersion[]) ?? [];
  const assets = (assetRows as Asset[]) ?? [];
  const suggestions = (commentRows as Comment[]) ?? [];
  const variants = (variantRows as ContentVariant[]) ?? [];
  const brandGroups = (checklistRow as { groups: QaGroup[] } | null)?.groups ?? [];
  const checklist = brandGroups.length > 0 ? brandGroups : (QA_FIREWALL as QaGroup[]);
  const { data: { user: me } } = await supabase.auth.getUser();
  const meId = me?.id ?? null;

  const { data: staffRows } = await supabase.from("profiles").select("id, full_name, department").in("account_type", ["admin", "team_incharge"]);
  const staff: StaffOption[] = ((staffRows as { id: string; full_name: string | null; department: string | null }[]) ?? []).map((s) => ({ id: s.id, name: s.full_name ?? "Staff", department: s.department }));

  const deliverables: DeliverableView[] = await Promise.all(
    assets.map(async (a) => {
      const { data } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
      return {
        id: a.id,
        url: data?.signedUrl ?? null,
        name: a.label ?? basename(a.storage_path),
        kind: a.kind,
        isImage: IMG.test(a.storage_path),
        isVideo: VID.test(a.storage_path),
      };
    }),
  );

  // -----------------------------------------------------------------------
  // Desk-aware panels — every desk opens the same route, but each sees only
  // the surfaces it actually acts on. Reference (brief + brand voice) and the
  // ownership/pipeline hand-off are shared; the working tools are per-desk.
  // -----------------------------------------------------------------------
  const fn = session.fn;
  const all = fn === "admin";
  const production = ["design", "video", "image", "audio"].includes(fn);
  const V = {
    conversation: all || fn === "social" || fn === "qa",
    ownership: true,
    pipeline: true,
    brief: true,
    brandref: true,
    copy: all || fn === "content" || fn === "strategy" || fn === "qa",
    studio: all || fn === "content",
    deliverables: all || production || fn === "qa" || fn === "social",
    qa: all || fn === "qa",
    scheduler: all || fn === "social",
  };
  const hasMain = V.conversation || V.copy || V.studio || V.deliverables || V.qa || V.scheduler;

  // Derive the format direction live from the objective + medium so wording
  // always reflects the current (brand-agnostic) mapping, not what was frozen
  // into the row at commit time. `subject` (per brand) personalises it.
  const medium: Medium = item.format === "reel" ? "reel" : "post";
  const decision = item.objective ? decideFormat(item.objective as Objective, medium, ws?.subject ?? null) : null;
  const formatType = decision?.formatType ?? item.format_type;
  const formatWhy = decision?.rationale ?? item.format_rationale;

  const brief = (
    <section className="card p-4">
      <div className="mb-3 text-sm font-semibold">The brief</div>
      <div className="space-y-3">
        <Field label="Objective" value={item.objective ? (OBJECTIVE_LABELS[item.objective as Objective] ?? item.objective) : null} />
        <Field label="Chosen format" value={formatType} />
        <Field label="Content pillar" value={pillarRow?.name ?? null} />
        <Field label="Campaign" value={item.campaign} />
        {formatWhy ? (
          <div>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Why this format</div>
            <div className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{formatWhy}</div>
          </div>
        ) : null}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="text-xs hover:underline" style={{ color: "var(--muted)" }}>← Board</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold" style={{ letterSpacing: "-.01em" }}>{item.title}</h1>
          <span className="pill pending">{STAGE_LABEL[item.stage] ?? item.stage}</span>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{item.format}</span>
        </div>
        {ws ? <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>{ws.name}</p> : null}
      </div>

      {/* Ownership — task metadata sits up top. */}
      {V.ownership ? <OwnershipPanel contentId={item.id} assignedTo={item.assigned_to} dueDate={item.due_date} staff={staff} /> : null}

      {/* Work (left) + reference rail (right, sticky). */}
      <div className={hasMain ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" : ""}>
        {hasMain ? (
          <div className="min-w-0 space-y-5">
            {V.conversation ? <SuggestionThread contentId={item.id} messages={suggestions.map((c) => ({ id: c.id, body: c.body, mine: c.author_id === meId }))} /> : null}
            {V.copy ? <ContentEditor item={item} versions={versions} /> : null}
            {V.studio ? <CopyStudio item={item} variants={variants} /> : null}
            {V.deliverables ? <Deliverables contentId={item.id} workspaceId={item.workspace_id} items={deliverables} /> : null}
            {V.qa ? <QaFirewall contentId={item.id} stage={item.stage} initial={item.qa_checklist} initialNotes={item.qa_notes} checklist={checklist} brandFirewall={brandGroups.length > 0} /> : null}
            {V.scheduler ? <Scheduler contentId={item.id} stage={item.stage} variants={variants} scheduled={(scheduledRows as ScheduledPost[]) ?? []} /> : null}
          </div>
        ) : null}

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {V.brief ? brief : null}
          {V.brandref && ws ? <BrandRef ws={ws} /> : null}
        </aside>
      </div>

      {/* Pipeline hand-off — the final action: ship it to the next desk. */}
      {V.pipeline ? <AssignPanel contentId={item.id} stage={item.stage} note={item.assignment_note} fn={session.fn} /> : null}
    </div>
  );
}
