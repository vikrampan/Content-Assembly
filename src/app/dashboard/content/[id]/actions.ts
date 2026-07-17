"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { userFunction } from "@/lib/mendly/access";
import { QA_FIREWALL } from "@/lib/mendly/pipeline";
import type { ContentStatus } from "@/lib/types";

export type ActionResult = { ok: true; message?: string } | { error: string };

/** Admin routes an item to a desk with a brief. */
export async function assignToDept(
  contentId: string,
  dept: string,
  note: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "admin") return { error: "Only admin can assign work." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ assigned_dept: dept, assignment_note: note.trim() || null })
    .eq("id", contentId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/content/${contentId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: `Sent to the ${dept} desk.` };
}

/** The assigned desk (or admin) returns an item to admin. */
export async function returnToAdmin(contentId: string, note: string): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };
  const fn = userFunction(session.profile);

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_items")
    .select("assigned_dept")
    .eq("id", contentId)
    .single<{ assigned_dept: string | null }>();
  if (!item) return { error: "Not found." };
  if (fn !== "admin" && fn !== item.assigned_dept) {
    return { error: "This item isn't on your desk." };
  }

  const { error } = await supabase
    .from("content_items")
    .update({ assigned_dept: null, assignment_note: note.trim() || null })
    .eq("id", contentId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/content/${contentId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Returned to admin." };
}

/**
 * Refine the AI-drafted content: title + the three-tier copy. Team/admin only
 * (RLS enforces workspace). The objective/format decision stays read-only — it
 * came from the strategy desk and is "never by taste".
 */
export async function updateContent(input: {
  id: string;
  title: string;
  hook: string;
  educationalShift: string;
  solution: string;
}): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };

  const title = input.title.trim();
  if (!title) return { error: "Title cannot be empty." };
  const norm = (s: string) => (s.trim() === "" ? null : s.trim());

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({
      title,
      hook: norm(input.hook),
      educational_shift: norm(input.educationalShift),
      solution: norm(input.solution),
    })
    .eq("id", input.id);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/content/${input.id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved." };
}

/** Every firewall check key — the full set that must pass to ship. */
const QA_KEYS: string[] = QA_FIREWALL.flatMap((g) => g.checks.map((c) => c.key));

/** Stages from which an item may be submitted through the firewall to the client. */
const SUBMITTABLE: ContentStatus[] = ["assembly", "admin_review", "changes_requested"];

/** Save firewall progress without submitting. Team/admin only (RLS enforces workspace). */
export async function saveQaChecklist(
  contentId: string,
  checklist: Record<string, boolean>,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_items")
    .update({ qa_checklist: checklist })
    .eq("id", contentId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/content/${contentId}`);
  return { ok: true };
}

/**
 * The firewall gate: transition to `ready_for_client_review` ONLY if every one
 * of the 16 checks passes. Enforced HERE, server-side — the UI disabling the
 * button is convenience; this is the boundary. "Nothing ships until it passes."
 */
export async function submitForClientReview(
  contentId: string,
  checklist: Record<string, boolean>,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role === "client") return { error: "Not authorized." };

  const failed = QA_KEYS.filter((k) => checklist[k] !== true);
  if (failed.length > 0) {
    return { error: `${failed.length} firewall check(s) still failing — cannot ship.` };
  }

  const supabase = await createClient();

  // Re-read current status to guard the transition (don't ship published work, etc.).
  const { data: item } = await supabase
    .from("content_items")
    .select("status")
    .eq("id", contentId)
    .single<{ status: ContentStatus }>();
  if (!item) return { error: "Content not found or not accessible." };
  if (!SUBMITTABLE.includes(item.status)) {
    return { error: `Cannot submit from the "${item.status}" stage.` };
  }

  const { error } = await supabase
    .from("content_items")
    .update({ status: "ready_for_client_review", qa_checklist: checklist })
    .eq("id", contentId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/content/${contentId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Passed the firewall — sent to the client for sign-off." };
}
