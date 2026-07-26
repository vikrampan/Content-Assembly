import Link from "next/link";
import type { CalendarApproval, ContentItem } from "@/lib/types";
import { ClientPipeline } from "../ClientPipeline";
import { accentOf, brandFonts, BrandStyle, clientWorkspace, logoUrlOf } from "./shared";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{label}</div>
    </div>
  );
}

export async function HomeView() {
  const { supabase, ws } = await clientWorkspace();
  if (!ws) {
    return <div className="card p-10 text-center text-sm" style={{ color: "var(--muted)" }}>Your brand workspace isn&apos;t set up yet.</div>;
  }
  const accent = accentOf(ws);
  const [{ faces, headlineFamily }, logoUrl] = await Promise.all([brandFonts(supabase, ws), logoUrlOf(supabase, ws)]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [{ data: calRaw }, { data: apprRaw }, { data: schedRaw }] = await Promise.all([
    supabase.from("content_items").select("*").not("planned_date", "is", null).gte("planned_date", iso(monthStart)).lte("planned_date", iso(monthEnd)),
    supabase.from("calendar_approvals").select("*").eq("month", iso(monthStart)).maybeSingle<CalendarApproval>(),
    supabase.from("scheduled_posts").select("scheduled_at, status, content_items(title)").eq("status", "queued").gte("scheduled_at", now.toISOString()).order("scheduled_at").limit(3),
  ]);
  const calendar = (calRaw as ContentItem[]) ?? [];
  const approval = apprRaw as CalendarApproval | null;
  const pending = calendar.filter((c) => c.stage === "client_review");
  const live = calendar.filter((c) => c.stage === "published").length;
  const scheduled = calendar.filter((c) => c.stage === "scheduling").length;
  const upcoming = ((schedRaw as { scheduled_at: string; content_items: { title: string } | null }[] | null) ?? []);

  const needsCalendar = !approval || approval.status !== "approved";

  return (
    <div className="space-y-8">
      <BrandStyle faces={faces} />
      {/* Brand hero */}
      <header className="card overflow-hidden">
        <div className="h-1.5" style={{ background: accent }} />
        <div className="flex flex-wrap items-center gap-4 p-6">
          {logoUrl ? (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl p-1.5" style={{ border: "1px solid var(--line)", background: "var(--panel-2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={ws.name} className="max-h-full max-w-full object-contain" />
            </span>
          ) : null}
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--faint)" }}>Welcome back</div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: headlineFamily, letterSpacing: "-.01em" }}>{ws.name}</h1>
          </div>
        </div>
      </header>

      {/* Attention banner — the one thing to do */}
      {(pending.length > 0 || needsCalendar) ? (
        <div className="card p-5" style={{ borderColor: "var(--accent)" }}>
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--accent-ink)" }}>Needs you</div>
          <div className="mt-2 flex flex-wrap gap-3">
            {pending.length > 0 ? (
              <Link href="/dashboard/approvals" className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "var(--accent-soft)" }}>
                <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: "var(--accent)" }}>{pending.length}</span>
                <span className="text-sm font-semibold">post{pending.length > 1 ? "s" : ""} to approve →</span>
              </Link>
            ) : null}
            {needsCalendar ? (
              <Link href="/dashboard/plan" className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "var(--panel-2)" }}>
                <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--line-2)" }}>📅</span>
                <span className="text-sm font-semibold">Review this month&apos;s plan →</span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card p-5 text-sm" style={{ color: "var(--muted)" }}>You&apos;re all caught up — nothing needs you right now. ✓</div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="To approve" value={pending.length} />
        <Stat label="This month" value={calendar.length} />
        <Stat label="Scheduled" value={scheduled} />
        <Stat label="Published" value={live} />
      </div>

      {/* Where posts are */}
      <ClientPipeline posts={calendar} accent={accent} />

      {/* Coming up */}
      {upcoming.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--serif)" }}>Coming up</h2>
            <Link href="/dashboard/plan" className="text-xs font-semibold hover:underline" style={{ color: "var(--accent-ink)" }}>See calendar →</Link>
          </div>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {upcoming.map((u, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5">
                <span className="w-28 shrink-0 text-sm font-semibold tabular-nums" style={{ color: accent }}>{new Date(u.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <span className="flex-1 truncate text-sm">{u.content_items?.title ?? "Post"}</span>
                <span className="text-xs" style={{ color: "var(--faint)" }}>{new Date(u.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
