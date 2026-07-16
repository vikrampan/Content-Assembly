import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDeskAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartment, DEPARTMENT_LABELS } from "@/lib/mendly/departments";
import { STATUS_LABELS } from "@/lib/pipeline";
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

  // The desk's live queue (content items sitting at the statuses it owns).
  let queue: ContentItem[] = [];
  if (d.statuses.length > 0) {
    const { data } = await supabase
      .from("content_items")
      .select("*")
      .in("status", d.statuses)
      .order("updated_at", { ascending: false });
    queue = (data as ContentItem[]) ?? [];
  }

  // The desk's AI persona(s) + a workspace-name lookup.
  const [{ data: personasRaw }, { data: wsRaw }] = await Promise.all([
    supabase.from("ai_personas").select("*").eq("department", d.key).order("name"),
    supabase.from("workspaces").select("id,name"),
  ]);
  const personas = (personasRaw as AiPersona[]) ?? [];
  const wsName = new Map(((wsRaw as Pick<Workspace, "id" | "name">[]) ?? []).map((w) => [w.id, w.name]));

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

      {/* The live queue */}
      {d.statuses.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            Your queue <span className="opacity-50">({queue.length})</span>
          </h2>
          {queue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm opacity-55 dark:border-white/15">
              Nothing at this desk right now — work arrives here when it reaches{" "}
              {d.statuses.map((s) => STATUS_LABELS[s]).join(" / ")}.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {queue.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/content/${item.id}`}
                  className="rounded-xl border border-black/10 bg-white/60 p-3 transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-center gap-2 text-xs opacity-50">
                    <span className="uppercase tracking-wide">{item.format}</span>
                    <span className="ml-auto">{wsName.get(item.workspace_id) ?? ""}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium leading-snug">{item.title}</div>
                  <div className="mt-1.5 text-[11px] opacity-45">{STATUS_LABELS[item.status]}</div>
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
