import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasAnthropic } from "@/lib/ai/strategist";
import type { AiPersona, ContentPillar, Workspace } from "@/lib/types";
import { StrategyCockpit } from "./StrategyCockpit";

export default async function StrategyPage() {
  await requireAccess("strategy");

  const supabase = await createClient();
  const [{ data }, { data: personas }, { data: pillarRows }] = await Promise.all([
    supabase.from("workspaces").select("*").order("name"),
    supabase.from("ai_personas").select("*").order("name"),
    supabase.from("content_pillars").select("*").order("sort"),
  ]);
  const workspaces = (data as Workspace[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Strategy · Monthly Plan</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Stage 04 — set the pillars, let AI draft a balanced month from the brand book, review, and commit it to the calendar.
        </p>
      </div>

      {!hasAnthropic() ? (
        <div className="rounded-xl p-4 text-sm" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
          <div className="font-medium">AI planning runs in stub mode</div>
          <p className="mt-1 text-xs leading-relaxed">
            The format decision is fully live. Month planning &amp; copy drafting activate when <code>ANTHROPIC_API_KEY</code> is set on the server.
          </p>
        </div>
      ) : null}

      {workspaces.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm" style={{ border: "1px dashed var(--line-2)", color: "var(--muted)" }}>
          Create a brand first, then plan its month.
        </div>
      ) : (
        <StrategyCockpit workspaces={workspaces} personas={(personas as AiPersona[]) ?? []} pillars={(pillarRows as ContentPillar[]) ?? []} />
      )}
    </div>
  );
}
