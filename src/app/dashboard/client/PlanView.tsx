import type { CalendarApproval, ContentItem } from "@/lib/types";
import { CalendarApproval as CalendarApprovalControl } from "../CalendarApproval";
import { CalendarView, type CalPost } from "./CalendarView";
import { accentOf, brandFonts, BrandStyle, clientWorkspace, creativesFor, SectionHeader } from "./shared";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function PlanView({ month }: { month?: string }) {
  const { supabase, ws } = await clientWorkspace();
  if (!ws) return <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your workspace isn&apos;t set up yet.</div>;
  const accent = accentOf(ws);
  const { faces, headlineFamily } = await brandFonts(supabase, ws);

  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) { const [yy, mm] = month.split("-").map(Number); y = yy; m = mm - 1; }
  const monthStart = new Date(y, m, 1), monthEnd = new Date(y, m + 1, 0);

  const [{ data: calRaw }, { data: apprRaw }] = await Promise.all([
    supabase.from("content_items").select("*").not("planned_date", "is", null).gte("planned_date", iso(monthStart)).lte("planned_date", iso(monthEnd)).order("planned_date"),
    supabase.from("calendar_approvals").select("*").eq("month", iso(monthStart)).maybeSingle<CalendarApproval>(),
  ]);
  const calendar = (calRaw as ContentItem[]) ?? [];
  const approval = apprRaw as CalendarApproval | null;

  const creativesBy = await creativesFor(supabase, calendar.map((c) => c.id));
  const { data: pillarRows } = await supabase.from("content_pillars").select("id, name").eq("workspace_id", ws.id);
  const pmap = new Map(((pillarRows as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name]));

  // Suggestion counts.
  const suggestionCounts = new Map<string, number>();
  if (calendar.length > 0) {
    const { data: sugg } = await supabase.from("comments").select("content_id").eq("internal", false).in("content_id", calendar.map((c) => c.id));
    for (const r of (sugg as { content_id: string }[]) ?? []) suggestionCounts.set(r.content_id, (suggestionCounts.get(r.content_id) ?? 0) + 1);
  }

  const posts: CalPost[] = calendar.map((c) => ({
    id: c.id, title: c.title, stage: c.stage, format: c.format, planned_date: c.planned_date!,
    objective: c.objective, campaign: c.campaign, pillar: c.pillar_id ? pmap.get(c.pillar_id) ?? null : null,
    platform: c.platform, formatType: c.format_type,
    brief: (c.brief as CalPost["brief"]) ?? null,
    body: (c.content_body as CalPost["body"]) ?? null,
    hook: c.hook, bridge: c.educational_shift, cta: c.solution,
    creatives: creativesBy.get(c.id) ?? [], suggestions: suggestionCounts.get(c.id) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <BrandStyle faces={faces} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader title={`${MONTHS[m]} ${y}`} subtitle="Your plan for the month — tap any day to see the post and give feedback." family={headlineFamily} />
        <CalendarApprovalControl workspaceId={ws.id} month={iso(monthStart)} status={approval?.status ?? "pending"} note={approval?.note ?? null} />
      </div>
      <CalendarView year={y} month={m} posts={posts} accent={accent} brandName={ws.name} />
    </div>
  );
}
