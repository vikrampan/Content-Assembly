import type { CalendarApproval, ContentItem } from "@/lib/types";
import { CalendarApproval as CalendarApprovalControl } from "../CalendarApproval";
import { CalendarView, type CalPost } from "./CalendarView";
import { accentOf, brandFonts, BrandStyle, clientWorkspace, creativesFor, SectionHeader } from "./shared";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function PlanView() {
  const { supabase, ws } = await clientWorkspace();
  if (!ws) return <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your workspace isn&apos;t set up yet.</div>;
  const accent = accentOf(ws);
  const { faces, headlineFamily } = await brandFonts(supabase, ws);

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const monthStart = new Date(y, m, 1), monthEnd = new Date(y, m + 1, 0);

  const [{ data: calRaw }, { data: apprRaw }] = await Promise.all([
    supabase.from("content_items").select("*").not("planned_date", "is", null).gte("planned_date", iso(monthStart)).lte("planned_date", iso(monthEnd)).order("planned_date"),
    supabase.from("calendar_approvals").select("*").eq("month", iso(monthStart)).maybeSingle<CalendarApproval>(),
  ]);
  const calendar = (calRaw as ContentItem[]) ?? [];
  const approval = apprRaw as CalendarApproval | null;

  const creativesBy = await creativesFor(supabase, calendar.map((c) => c.id));

  // Suggestion counts.
  const suggestionCounts = new Map<string, number>();
  if (calendar.length > 0) {
    const { data: sugg } = await supabase.from("comments").select("content_id").eq("internal", false).in("content_id", calendar.map((c) => c.id));
    for (const r of (sugg as { content_id: string }[]) ?? []) suggestionCounts.set(r.content_id, (suggestionCounts.get(r.content_id) ?? 0) + 1);
  }

  const posts: CalPost[] = calendar.map((c) => {
    const cr = creativesBy.get(c.id)?.[0];
    return {
      id: c.id, title: c.title, stage: c.stage, format: c.format, planned_date: c.planned_date!,
      hook: c.hook, bridge: c.educational_shift, cta: c.solution,
      creative: cr?.url ?? null, isVideo: cr?.isVideo ?? false, suggestions: suggestionCounts.get(c.id) ?? 0,
    };
  });

  return (
    <div className="space-y-5">
      <BrandStyle faces={faces} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader title={`${MONTHS[m]} ${y}`} subtitle="Your plan for the month — tap any day to see the post and give feedback." family={headlineFamily} />
        <CalendarApprovalControl workspaceId={ws.id} month={iso(monthStart)} status={approval?.status ?? "pending"} note={approval?.note ?? null} />
      </div>
      {calendar.length === 0 ? (
        <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your team is preparing this month&apos;s plan.</div>
      ) : (
        <CalendarView year={y} month={m} posts={posts} accent={accent} />
      )}
    </div>
  );
}
