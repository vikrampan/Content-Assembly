import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDeskAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartment, DEPARTMENT_LABELS } from "@/lib/mendly/departments";
import { deskStage, STAGE_LABEL } from "@/lib/mendly/stages";
import type { AiPersona, ContentItem, Workspace } from "@/lib/types";

// Desks whose production tools depend on an external AI/service key you'll add
// later. The seam is ready; this is the honest "awaiting integration" panel.
const AWAITING: Record<string, { needs: string }> = {
  capture: { needs: "AI shot-list generation (uploads are live via the Media Library)" },
  image: { needs: "an image-generation provider (Firefly / Replicate / …)" },
  audio: { needs: "an audio provider (ElevenLabs / …)" },
  video: { needs: "a video-generation provider (Runway / …) for AI clips" },
  social: { needs: "Meta Suite publishing + analytics ingest" },
};

export default async function DeskPage({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  const { dept } = await params;
  const d = getDepartment(dept);
  if (!d) notFound();
  await requireDeskAccess(dept); // only this desk's function (or admin)

  const supabase = await createClient();

  // Items that have flowed to this desk's pipeline stage (the inbox).
  const myStage = deskStage(d.key);
  const { data: assignedRaw } = myStage
    ? await supabase
        .from("content_items")
        .select("*")
        .eq("stage", myStage)
        .order("updated_at", { ascending: false })
    : { data: [] };
  const assigned = (assignedRaw as ContentItem[]) ?? [];

  // The desk's AI persona(s) + a workspace-name lookup.
  const [{ data: personasRaw }, { data: wsRaw }] = await Promise.all([
    supabase.from("ai_personas").select("*").eq("department", d.key).order("name"),
    supabase.from("workspaces").select("id,name"),
  ]);
  const personas = (personasRaw as AiPersona[]) ?? [];
  const wsName = new Map(((wsRaw as Pick<Workspace, "id" | "name">[]) ?? []).map((w) => [w.id, w.name]));

  // Social desk: the publish queue (everything scheduled / live).
  let queue: ContentItem[] = [];
  if (d.key === "social") {
    const { data: q } = await supabase
      .from("content_items")
      .select("*")
      .in("stage", ["scheduling", "published"])
      .order("scheduled_at", { ascending: true, nullsFirst: false });
    queue = (q as ContentItem[]) ?? [];
  }

  const awaiting = AWAITING[d.key];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/portals" className="text-xs opacity-60 hover:underline">← All desks</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{d.label} desk</h1>
          <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-xs dark:bg-white/10">{d.stage}</span>
        </div>
        <p className="text-sm opacity-60">{d.blurb}</p>
      </div>

      {/* Tool shortcut (brand / strategy desks reuse an existing tool) */}
      {d.toolHref ? (
        <Link
          href={d.toolHref}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-500/20 dark:text-amber-300"
        >
          {d.toolLabel} →
        </Link>
      ) : null}

      {/* The inbox — items the admin routed to this desk */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Assigned to your desk <span className="opacity-50">({assigned.length})</span>
        </h2>
        {assigned.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm opacity-55 dark:border-white/15">
            Nothing on your desk right now — the admin routes work here with a brief.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {assigned.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/content/${item.id}`}
                className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 transition hover:shadow-md dark:border-amber-900/50 dark:bg-amber-950/20"
              >
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <span className="uppercase tracking-wide">{item.format}</span>
                  <span className="ml-auto">{wsName.get(item.workspace_id) ?? ""}</span>
                </div>
                <div className="mt-1 text-sm font-medium leading-snug">{item.title}</div>
                {item.assignment_note ? (
                  <div className="mt-1.5 line-clamp-2 text-[11px] opacity-70">
                    <span className="font-semibold">Brief: </span>{item.assignment_note}
                  </div>
                ) : (
                  <div className="mt-1.5 text-[11px] opacity-45">{STAGE_LABEL[item.stage] ?? item.stage}</div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Social publish queue */}
      {d.key === "social" ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Publish queue <span className="opacity-50">({queue.length})</span></h2>
          {queue.length === 0 ? (
            <div className="rounded-2xl p-8 text-center text-sm card" style={{ color: "var(--muted)" }}>
              Nothing scheduled yet — approved posts land here to be queued.
            </div>
          ) : (
            <div className="card overflow-hidden">
              {queue.map((c, i) => (
                <Link key={c.id} href={`/dashboard/content/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]" style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}>
                  <span className={`pill ${c.stage === "published" ? "published" : "scheduled"}`}>{c.stage === "published" ? "Live" : "Queued"}</span>
                  <span className="flex-1 truncate text-sm font-medium">{c.title}</span>
                  <span className="text-xs" style={{ color: "var(--faint)" }}>{wsName.get(c.workspace_id) ?? ""}</span>
                  <span className="w-40 text-right text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                    {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "unscheduled"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Awaiting-integration seam */}
      {awaiting ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-medium">Tools ready for integration</div>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            This desk&apos;s production tools are wired as a seam and will activate once you add{" "}
            <strong>{awaiting.needs}</strong>. The workflow, roles, and hand-offs already work end-to-end.
          </p>
        </section>
      ) : null}

      {/* The desk's AI brain(s) */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">AI persona for this desk</h2>
          <Link href="/dashboard/personas" className="text-xs text-amber-700 hover:underline dark:text-amber-400">
            Configure →
          </Link>
        </div>
        {personas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-xs opacity-55 dark:border-white/15">
            No persona set for the {d.label} desk yet. Configure one to tune how its AI thinks.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {personas.map((p) => (
              <div key={p.id} className="rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.is_default ? (
                    <span className="rounded-full border border-emerald-400/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">default</span>
                  ) : null}
                  <span className="ml-auto text-[11px] opacity-45">{wsName.get(p.workspace_id) ?? ""}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs opacity-70">{p.personality}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
