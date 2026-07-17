import { createClient } from "@/lib/supabase/server";
import type { CalendarApproval, ContentItem, Workspace } from "@/lib/types";
import { PostApproval } from "./PostApproval";
import { CalendarApproval as CalendarApprovalControl } from "./CalendarApproval";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function DnaRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-2">
      <div className="text-[11px] uppercase tracking-wide opacity-50">{label}</div>
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
      <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm opacity-60 dark:border-white/15">
        Your brand workspace isn&apos;t set up yet. Your team will have it ready shortly.
      </div>
    );
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [{ data: pendingRaw }, { data: approvedRaw }, { data: calRaw }, { data: approvalRaw }] =
    await Promise.all([
      supabase.from("content_items").select("*").in("status", ["ready_for_client_review", "changes_requested"]).order("updated_at", { ascending: false }),
      supabase.from("content_items").select("*").in("status", ["approved", "scheduled", "published"]).order("updated_at", { ascending: false }),
      supabase.from("content_items").select("*").not("planned_date", "is", null).gte("planned_date", iso(monthStart)).lte("planned_date", iso(monthEnd)).order("planned_date"),
      supabase.from("calendar_approvals").select("*").eq("month", iso(monthStart)).maybeSingle<CalendarApproval>(),
    ]);

  const pending = (pendingRaw as ContentItem[]) ?? [];
  const approved = (approvedRaw as ContentItem[]) ?? [];
  const calendar = (calRaw as ContentItem[]) ?? [];
  const approval = approvalRaw as CalendarApproval | null;
  const accent = ws.primary_hex ? `#${ws.primary_hex}` : "#B4622E";

  return (
    <div className="space-y-8" style={{ "--brand": accent } as React.CSSProperties}>
      {/* Brand header */}
      <header className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10">
        <div className="h-1.5" style={{ background: accent }} />
        <div className="flex items-center gap-4 bg-white/60 p-6 dark:bg-white/5">
          <span className="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
            <span className="h-full w-1/2" style={{ background: accent }} />
            <span className="h-full w-1/2" style={{ background: ws.secondary_hex ? `#${ws.secondary_hex}` : "#e5e5e5" }} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-wide opacity-50">Your brand</div>
            <h1 className="font-serif text-2xl font-semibold" style={{ fontFamily: "Georgia, serif" }}>{ws.name}</h1>
          </div>
          <div className="ml-auto flex gap-6 text-center">
            <div><div className="text-2xl font-semibold tabular-nums">{pending.length}</div><div className="text-[11px] uppercase tracking-wide opacity-50">To approve</div></div>
            <div><div className="text-2xl font-semibold tabular-nums">{approved.length}</div><div className="text-[11px] uppercase tracking-wide opacity-50">Approved</div></div>
          </div>
        </div>
      </header>

      {/* Pending approval */}
      <section>
        <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: "Georgia, serif" }}>Pending your approval</h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm opacity-55 dark:border-white/15">
            Nothing waiting on you — you&apos;re all caught up.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <PostApproval key={p.id} contentId={p.id} hook={p.hook} bridge={p.educational_shift} cta={p.solution} format={p.format} />
            ))}
          </div>
        )}
      </section>

      {/* Monthly calendar */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif" }}>{MONTHS[now.getMonth()]} plan</h2>
          <CalendarApprovalControl workspaceId={ws.id} month={iso(monthStart)} status={approval?.status ?? "pending"} note={approval?.note ?? null} />
        </div>
        {calendar.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm opacity-55 dark:border-white/15">
            Your team is preparing this month&apos;s plan.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
            {calendar.map((c, i) => (
              <div key={c.id} className={`flex items-center gap-3 bg-white/60 px-4 py-3 dark:bg-white/5 ${i > 0 ? "border-t border-black/5 dark:border-white/5" : ""}`}>
                <span className="w-14 shrink-0 text-sm font-medium tabular-nums" style={{ color: accent }}>
                  {c.planned_date ? new Date(c.planned_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                </span>
                <span className="flex-1 text-sm">{c.title}</span>
                <span className="text-[11px] uppercase tracking-wide opacity-45">{c.format}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Brand book (read-only) */}
      <section>
        <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: "Georgia, serif" }}>Your brand book</h2>
        <div className="rounded-2xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
          <div className="mb-3 flex gap-2">
            {ws.primary_hex ? <Swatch hex={ws.primary_hex} /> : null}
            {ws.secondary_hex ? <Swatch hex={ws.secondary_hex} /> : null}
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/5">
            <DnaRow label="Voice & tone" value={ws.voice_tone} />
            <DnaRow label="Photography" value={ws.photography_style} />
            <DnaRow label="Do" value={ws.do_rules} />
            <DnaRow label="Never" value={ws.never_rules} />
            <DnaRow label="Typography" value={[ws.headline_font, ws.body_font].filter(Boolean).join(" · ") || null} />
          </div>
        </div>
      </section>

      {/* Approved & live */}
      {approved.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: "Georgia, serif" }}>Approved &amp; scheduled</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {approved.map((p) => (
              <div key={p.id} className="rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-medium leading-snug">{p.title}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide opacity-45">{p.status} · {p.format}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10">
      <span className="h-4 w-4 rounded" style={{ background: `#${hex}` }} />
      <span className="font-mono opacity-70">#{hex}</span>
    </div>
  );
}
