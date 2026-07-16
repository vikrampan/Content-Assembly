"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id?: string } | { error: string };

async function requireTeam() {
  const session = await requireSession();
  if (session.role === "client") throw new Error("Not authorized.");
  return session;
}

export interface PersonaInput {
  id?: string;
  workspaceId: string;
  department: string;
  name: string;
  personality: string;
  guidance: string;
  isDefault: boolean;
}

export async function savePersona(input: PersonaInput): Promise<ActionResult> {
  const session = await requireTeam();
  const name = input.name.trim();
  const personality = input.personality.trim();
  if (!name) return { error: "Name is required." };
  if (!personality) return { error: "Give the AI a personality — the instructions can't be empty." };

  const supabase = await createClient();
  const norm = (s: string) => (s.trim() === "" ? null : s.trim());

  // Only one default per department per workspace — clear others if this is default.
  if (input.isDefault) {
    await supabase
      .from("ai_personas")
      .update({ is_default: false })
      .eq("workspace_id", input.workspaceId)
      .eq("department", input.department);
  }

  const row = {
    workspace_id: input.workspaceId,
    department: input.department,
    name,
    personality,
    guidance: norm(input.guidance),
    is_default: input.isDefault,
  };

  if (input.id) {
    const { error } = await supabase.from("ai_personas").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("ai_personas")
      .insert({ ...row, created_by: session.userId });
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/personas");
  return { ok: true };
}

export async function deletePersona(id: string): Promise<ActionResult> {
  await requireTeam();
  const supabase = await createClient();
  const { error } = await supabase.from("ai_personas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/personas");
  return { ok: true };
}
