import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AiPersona, Workspace } from "@/lib/types";
import { PersonaManager } from "./PersonaManager";

export default async function PersonasPage() {
  const session = await requireSession();
  if (session.role === "client") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: ws }, { data: personas }] = await Promise.all([
    supabase.from("workspaces").select("*").order("name"),
    supabase.from("ai_personas").select("*").order("department"),
  ]);
  const workspaces = (ws as Workspace[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">AI Personas</h1>
        <p className="text-sm opacity-60">
          Set the personality of the AI for each department — the stance a marketing
          strategist would take. It&apos;s injected ahead of the brand book, so the AI keeps
          the brand&apos;s voice while adopting your direction.
        </p>
      </div>
      {workspaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm opacity-60 dark:border-white/15">
          Create a brand first, then configure its AI personas.
        </div>
      ) : (
        <PersonaManager workspaces={workspaces} personas={(personas as AiPersona[]) ?? []} />
      )}
    </div>
  );
}
