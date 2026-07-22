import type { ContentItem } from "@/lib/types";
import { ClientPostCard, type Creative, type ThreadMsg, type Variant } from "../ClientPostCard";
import { accentOf, brandFonts, BrandStyle, clientWorkspace, creativesFor, SectionHeader } from "./shared";

export async function ApprovalsView() {
  const { supabase, ws } = await clientWorkspace();
  if (!ws) return <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your workspace isn&apos;t set up yet.</div>;
  const accent = accentOf(ws);
  const { faces, headlineFamily } = await brandFonts(supabase, ws);

  const { data: { user } } = await supabase.auth.getUser();
  const meId = user?.id ?? null;

  const { data: pendingRaw } = await supabase.from("content_items").select("*").eq("stage", "client_review").order("updated_at", { ascending: false });
  const pending = (pendingRaw as ContentItem[]) ?? [];
  const ids = pending.map((p) => p.id);

  const creativesBy = await creativesFor(supabase, ids);
  const variantsBy = new Map<string, Variant[]>();
  const threadBy = new Map<string, ThreadMsg[]>();
  if (ids.length > 0) {
    const [{ data: vRows }, { data: cRows }] = await Promise.all([
      supabase.from("content_variants").select("content_id, platform, body").in("content_id", ids),
      supabase.from("comments").select("id, content_id, body, author_id, created_at").eq("internal", false).in("content_id", ids).order("created_at"),
    ]);
    for (const v of (vRows as { content_id: string; platform: string; body: string }[]) ?? []) {
      const l = variantsBy.get(v.content_id) ?? []; l.push({ platform: v.platform, body: v.body }); variantsBy.set(v.content_id, l);
    }
    for (const c of (cRows as { id: string; content_id: string; body: string; author_id: string | null }[]) ?? []) {
      const l = threadBy.get(c.content_id) ?? []; l.push({ id: c.id, body: c.body, mine: c.author_id === meId, at: "" }); threadBy.set(c.content_id, l);
    }
  }

  return (
    <div className="space-y-6">
      <BrandStyle faces={faces} />
      <SectionHeader title="Approvals" subtitle="Approve to schedule, or request changes — click a post to see everything." family={headlineFamily} />
      {pending.length === 0 ? (
        <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Nothing waiting on you — you&apos;re all caught up. ✓</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))" }}>
          {pending.map((p) => (
            <ClientPostCard
              key={p.id}
              contentId={p.id}
              title={p.title}
              hook={p.hook}
              bridge={p.educational_shift}
              cta={p.solution}
              format={p.format}
              plannedDate={p.planned_date}
              accent={accent}
              creatives={(creativesBy.get(p.id) ?? []) as Creative[]}
              variants={variantsBy.get(p.id) ?? []}
              thread={threadBy.get(p.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
