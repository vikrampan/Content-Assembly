import { createClient } from "@/lib/supabase/server";
import type { CalendarApproval, ContentItem, PostMetric, Workspace } from "@/lib/types";
import { PostApproval } from "./PostApproval";
import { CalendarApproval as CalendarApprovalControl } from "./CalendarApproval";
import { CalendarPostChip } from "./CalendarPostChip";
import { ClientAnalytics } from "./ClientAnalytics";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums" style={{ letterSpacing: "-.02em" }}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{hint}</div> : null}
    </div>
  );
}

function DnaRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export async function ClientPortal() {
  const supabase = await createClient();

  // A client sees exactly one brand (RLS returns only theirs).
  const { data: ws } = await supabase.from("workspaces").select("*").limit(1).maybeSingle<Workspace>();
  if (!ws) {
    return (
      <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>
        Your brand workspace isn&apos;t set up yet. Your team will have it ready shortly.
      </div>
    );
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [{ data: pendingRaw }, { data: approvedRaw }, { data: calRaw }, { data: approvalRaw }, { data: metricRaw }] =
    await Promise.all([
      supabase.from("content_items").select("*").eq("stage", "client_review").order("updated_at", { ascending: false }),
      supabase.from("content_items").select("*").in("stage", ["scheduling", "published"]).order("updated_at", { ascending: false }),
      supabase.from("content_items").select("*").not("planned_date", "is", null).gte("planned_date", iso(monthStart)).lte("planned_date", iso(monthEnd)).order("planned_date"),
      supabase.from("calendar_approvals").select("*").eq("month", iso(monthStart)).maybeSingle<CalendarApproval>(),
      supabase.from("post_metrics").select("*"),
    ]);

  const pending = (pendingRaw as ContentItem[]) ?? [];
  const approved = (approvedRaw as ContentItem[]) ?? [];
  const calendar = (calRaw as ContentItem[]) ?? [];
  const approval = approvalRaw as CalendarApproval | null;
  const metrics = (metricRaw as PostMetric[]) ?? [];
  const accent = ws.primary_hex ? `#${ws.primary_hex}` : "#C8853F";
  const accentReadable = accent; // used by charts + chips
  const live = approved.filter((p) => p.stage === "published").length;

  // Suggestion counts per calendar post (client's own non-internal comments).
  const suggestionCounts = new Map<string, number>();
  if (calendar.length > 0) {
    const { data: sugg } = await supabase
      .from("comments")
      .select("content_id")
      .eq("internal", false)
      .in("content_id", calendar.map((c) => c.id));
    for (const row of (sugg as { content_id: string }[]) ?? []) {
      suggestionCounts.set(row.content_id, (suggestionCounts.get(row.content_id) ?? 0) + 1);
    }
  }

  // Bucket planned posts by day-of-month for the calendar grid.
  const byDay = new Map<number, ContentItem[]>();
  for (const c of calendar) {
    if (!c.planned_date) continue;
    const day = new Date(c.planned_date + "T00:00:00").getDate();
    const list = byDay.get(day) ?? [];
    list.push(c);
    byDay.set(day, list);
  }
  const firstWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = monthEnd.getDate();
  const todayNum = now.getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-8" style={{ ["--brand" as string]: accent }}>
      {/* Brand hero */}
      <header className="card overflow-hidden">
        <div className="h-1.5" style={{ background: accent }} />
        <div className="flex flex-wrap items-center gap-4 p-6">
          <span className="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
            <span className="h-full w-1/2" style={{ background: accent }} />
            <span className="h-full w-1/2" style={{ background: ws.secondary_hex ? `#${ws.secondary_hex}` : "var(--panel-2)" }} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--faint)" }}>Welcome back</div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--serif)", letterSpacing: "-.01em" }}>{ws.name}</h1>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Awaiting you" value={pending.length} hint={pending.length ? "Review below" : "All caught up"} />
        <Kpi label="This month" value={calendar.length} hint={`${MONTHS[now.getMonth()]} plan`} />
        <Kpi label="Scheduled" value={approved.length - live} hint="Queued to post" />
        <Kpi label="Published" value={live} hint="Live now" />
      </div>

      {/* Pending approval */}
      <section>
        <div className="mb-1 flex items-baseline gap-3">
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>Ready for your review</h2>
          {pending.length ? <span className="pill pending">{pending.length}</span> : null}
        </div>
        <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>Approve to schedule, or request changes and we&apos;ll revise.</p>
        {pending.length === 0 ? (
          <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
            Nothing waiting on you — you&apos;re all caught up. ✓
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))" }}>
            {pending.map((p) => (
              <PostApproval
                key={p.id}
                contentId={p.id}
                title={p.title}
                hook={p.hook}
                bridge={p.educational_shift}
                cta={p.solution}
                format={p.format}
                plannedDate={p.planned_date}
                accent={accent}
              />
            ))}
          </div>
        )}
      </section>

      {/* Monthly calendar */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>{MONTHS[now.getMonth()]} {now.getFullYear()}</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Tap any post to suggest a change.</p>
          </div>
          <CalendarApprovalControl workspaceId={ws.id} month={iso(monthStart)} status={approval?.status ?? "pending"} note={approval?.note ?? null} />
        </div>
        {calendar.length === 0 ? (
          <div className="card p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
            Your team is preparing this month&apos;s plan.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="grid grid-cols-7">
              {DOW.map((d) => (
                <div key={d} className="p-2.5 text-center text-[0.66rem] font-bold uppercase tracking-wider" style={{ color: "var(--faint)", borderBottom: "1px solid var(--line)" }}>{d}</div>
              ))}
              {cells.map((day, i) => (
                <div
                  key={i}
                  className="min-h-[92px] p-1.5"
                  style={{
                    borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--line)",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  {day ? (
                    <>
                      <div
                        className="text-xs tabular-nums"
                        style={
                          day === todayNum
                            ? { background: accent, color: "#fff", width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 700 }
                            : { color: "var(--faint)" }
                        }
                      >
                        {day}
                      </div>
                      {(byDay.get(day) ?? []).map((c) => (
                        <CalendarPostChip
                          key={c.id}
                          contentId={c.id}
                          title={c.title}
                          accent={accent}
                          suggestionCount={suggestionCounts.get(c.id) ?? 0}
                        />
                      ))}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Approved & live */}
      {approved.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>Approved &amp; scheduled</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {approved.map((p) => (
              <div key={p.id} className="card p-3.5">
                <div className="flex items-center gap-2">
                  <span className={`pill ${p.stage === "published" ? "published" : "scheduled"}`}>{p.stage === "published" ? "Live" : "Scheduled"}</span>
                  <span className="ml-auto text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{p.format}</span>
                </div>
                <div className="mt-2 text-sm font-medium leading-snug">{p.title}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Analytics */}
      <ClientAnalytics metrics={metrics} posts={approved} accent={accentReadable} />

      {/* Brand book (read-only) */}
      <section>
        <h2 className="mb-3 text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>Your brand book</h2>
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {ws.primary_hex ? <Swatch hex={ws.primary_hex} /> : null}
            {ws.secondary_hex ? <Swatch hex={ws.secondary_hex} /> : null}
          </div>
          <div>
            <DnaRow label="Voice & tone" value={ws.voice_tone} />
            <DnaRow label="Photography" value={ws.photography_style} />
            <DnaRow label="Do" value={ws.do_rules} />
            <DnaRow label="Never" value={ws.never_rules} />
            <DnaRow label="Typography" value={[ws.headline_font, ws.body_font].filter(Boolean).join(" · ") || null} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--line)" }}>
      <span className="h-4 w-4 rounded" style={{ background: `#${hex}` }} />
      <span className="font-mono" style={{ color: "var(--muted)" }}>#{hex}</span>
    </div>
  );
}
