import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEPARTMENTS } from "@/lib/mendly/departments";
import type { ContentItem } from "@/lib/types";

export default async function PortalsPage() {
  const session = await requireAccess("portals");

  const supabase = await createClient();
  const { data } = await supabase.from("content_items").select("status");
  const items = (data as Pick<ContentItem, "status">[]) ?? [];
  const countFor = (statuses: string[]) =>
    statuses.length === 0 ? null : items.filter((i) => statuses.includes(i.status)).length;

  const myDepts = new Set(
    session.memberships.map((m) => m.department).filter(Boolean) as string[],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">The Pipeline · Desks</h1>
        <p className="text-sm opacity-60">
          Every department is a desk in one pipeline. Open a desk to see its queue,
          its AI persona, and its tools.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((d, i) => {
          const count = countFor(d.statuses);
          const mine = myDepts.has(d.key);
          return (
            <Link
              key={d.key}
              href={`/dashboard/desk/${d.key}`}
              className={`group rounded-2xl border bg-white/60 p-4 transition hover:shadow-md dark:bg-white/5 ${
                mine ? "border-amber-500" : "border-black/10 dark:border-white/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs opacity-45">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-medium">{d.label}</span>
                {mine ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    your desk
                  </span>
                ) : null}
                {count !== null ? (
                  <span className="ml-auto rounded-full bg-black/10 px-2 py-0.5 text-xs tabular-nums dark:bg-white/10">
                    {count}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide opacity-45">{d.stage}</div>
              <p className="mt-2 text-xs opacity-70">{d.blurb}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
