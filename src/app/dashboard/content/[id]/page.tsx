import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL } from "@/lib/mendly/stages";
import { OBJECTIVE_LABELS, type Objective } from "@/lib/mendly/strategy";
import type { Asset, ContentItem, ContentVariant, ContentVersion, Comment, QaGroup, ScheduledPost, Workspace } from "@/lib/types";
import { QA_FIREWALL } from "@/lib/mendly/pipeline";
import { AssignPanel } from "./AssignPanel";
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

  const versions = (versionRows as ContentVersion[]) ?? [];
  const assets = (assetRows as Asset[]) ?? [];
  const suggestions = (commentRows as Comment[]) ?? [];
  const variants = (variantRows as ContentVariant[]) ?? [];
  const brandGroups = (checklistRow as { groups: QaGroup[] } | null)?.groups ?? [];
  const checklist = brandGroups.length > 0 ? brandGroups : (QA_FIREWALL as QaGroup[]);
  const { data: { user: me } } = await supabase.auth.getUser();
  const meId = me?.id ?? null;

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/dashboard" className="text-xs hover:underline" style={{ color: "var(--muted)" }}>← Board</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{item.title}</h1>
          <span className="pill pending">{STAGE_LABEL[item.stage] ?? item.stage}</span>
          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--faint)" }}>{item.format}</span>
        </div>
        {ws ? <p className="text-sm" style={{ color: "var(--muted)" }}>{ws.name}</p> : null}
      </div>

      {/* Two-way client conversation (surfaced from the portal). */}
      <SuggestionThread contentId={item.id} messages={suggestions.map((c) => ({ id: c.id, body: c.body, mine: c.author_id === meId }))} />

      {/* Pipeline routing / hand-off. */}
      <AssignPanel contentId={item.id} stage={item.stage} note={item.assignment_note} fn={session.fn} />

      {/* The brief that travels with the asset (Stage 04). */}
      <section className="card grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Objective" value={item.objective ? (OBJECTIVE_LABELS[item.objective as Objective] ?? item.objective) : null} />
        <Field label="Chosen format" value={item.format_type} />
        {item.format_rationale ? (
          <div className="sm:col-span-2">
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Why this format</div>
            <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{item.format_rationale}</div>
          </div>
        ) : null}
      </section>

      {/* The three-tier copy (Stage 05) — editable + AI regenerate + history. */}
      <ContentEditor item={item} versions={versions} />

      {/* The Content desk's copy engineering — hooks, triggers, voice, variants. */}
      <CopyStudio item={item} variants={variants} />

      {/* Creative deliverables — the design/video/image/audio desks' output. */}
      <Deliverables contentId={item.id} workspaceId={item.workspace_id} items={deliverables} />

      {/* Brand reference + the firewall (Stage 06) — the gate to the client. */}
      {ws ? <BrandRef ws={ws} /> : null}
      <QaFirewall contentId={item.id} stage={item.stage} initial={item.qa_checklist} initialNotes={item.qa_notes} checklist={checklist} brandFirewall={brandGroups.length > 0} />

      {/* Social scheduling (Stage 07). */}
      <Scheduler contentId={item.id} stage={item.stage} variants={variants} scheduled={(scheduledRows as ScheduledPost[]) ?? []} />
    </div>
  );
}
