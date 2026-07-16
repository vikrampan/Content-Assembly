import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";
import { CreateBrandForm } from "./CreateBrandForm";

/** How much of the Brand DNA is locked — a quick completeness signal. */
function dnaScore(w: Workspace): { filled: number; total: number } {
  const fields = [
    w.primary_hex, w.secondary_hex, w.headline_font, w.body_font,
    w.voice_tone, w.voice_never, w.photography_style, w.do_rules,
    w.never_rules, w.locations, w.ai_style_suffix,
  ];
  return { filled: fields.filter((f) => f && String(f).trim()).length, total: fields.length };
}

export default async function BrandsPage() {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("*").order("name");
  const brands = (data as Workspace[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Brand Books</h1>
          <p className="text-sm opacity-60">
            Stage 01 — lock each brand&apos;s constitution. Every desk builds from it;
            the QA firewall enforces it.
          </p>
        </div>
        <CreateBrandForm />
      </div>

      {brands.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm opacity-60 dark:border-white/15">
          No brands yet. Create your first brand above.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {brands.map((b) => {
            const s = dnaScore(b);
            const complete = s.filled === s.total;
            return (
              <Link
                key={b.id}
                href={`/dashboard/brands/${b.id}`}
                className="group rounded-2xl border border-black/10 bg-white/60 p-4 transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
                    <span className="h-full w-1/2" style={{ background: `#${b.primary_hex ?? "cccccc"}` }} />
                    <span className="h-full w-1/2" style={{ background: `#${b.secondary_hex ?? "e5e5e5"}` }} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.name}</div>
                    <div className="truncate text-xs opacity-55">/{b.slug}</div>
                  </div>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      complete
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    }`}
                  >
                    {complete ? "Locked" : `${s.filled}/${s.total} DNA`}
                  </span>
                </div>
                {b.voice_tone ? (
                  <p className="mt-3 line-clamp-2 text-xs opacity-70">{b.voice_tone}</p>
                ) : (
                  <p className="mt-3 text-xs italic opacity-45">Brand DNA not set — click to lock it.</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
