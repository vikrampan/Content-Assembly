import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasAnthropic } from "@/lib/ai/strategist";
import type { AiPersona, Workspace } from "@/lib/types";
import { StrategyDesk } from "./StrategyDesk";

export default async function StrategyPage() {
  const session = await requireAccess("strategy");

  const supabase = await createClient();
  const [{ data }, { data: personas }] = await Promise.all([
    supabase.from("workspaces").select("*").order("name"),
    supabase.from("ai_personas").select("*").order("name"),
  ]);
  const workspaces = (data as Workspace[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Strategy Desk</h1>
        <p className="text-sm opacity-60">
          Stage 04 — you bring the message; the desk chooses the format and drafts
          on-brand copy, then drops a Draft into the pipeline.
        </p>
      </div>

      {!hasAnthropic() ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-medium">AI Strategist running in stub mode</div>
          <p className="mt-1 text-xs leading-relaxed opacity-90">
            The format decision is fully live (deterministic). Copy drafting uses a
            placeholder until <code>ANTHROPIC_API_KEY</code> is set in{" "}
            <code>.env.local</code> — then the same flow calls Claude with the
            brand book injected. No code change needed.
          </p>
        </div>
      ) : null}

      <StrategyDesk workspaces={workspaces} personas={(personas as AiPersona[]) ?? []} />
    </div>
  );
}
