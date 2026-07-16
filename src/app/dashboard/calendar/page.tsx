import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ContentItem, Workspace } from "@/lib/types";
import { Calendar } from "./Calendar";

export default async function CalendarPage() {
  const session = await requireAccess("calendar");

  const supabase = await createClient();
  const [{ data: ws }, { data: items }] = await Promise.all([
    supabase.from("workspaces").select("*").order("name"),
    supabase.from("content_items").select("*").not("planned_date", "is", null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Content Calendar</h1>
        <p className="text-sm opacity-60">
          Plan the month — each post you place enters the pipeline and can be
          worked, reviewed, and shipped. Drag to reschedule.
        </p>
      </div>
      <Calendar workspaces={(ws as Workspace[]) ?? []} items={(items as ContentItem[]) ?? []} />
    </div>
  );
}
