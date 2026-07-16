"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { userFunction } from "@/lib/mendly/access";

export type ActionResult = { ok: true; id?: string } | { error: string };

// Admin creates brands; the Brand Designer (and admin) edit brand books.
async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Forbidden: admin only");
  return session;
}

async function requireBrandEditor() {
  const session = await requireSession();
  const fn = userFunction(session.profile);
  if (fn !== "admin" && fn !== "brand") throw new Error("Forbidden: brand designer or admin only");
  return session;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Onboard a brand: create the workspace AND the client owner's login in one
 * step (admin only). The Brand Designer fills in the brand book afterwards.
 * Creating the client login uses the Supabase Admin API → needs service_role.
 */
export async function createBrand(input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  const name = input.name.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  if (!name) return { error: "Brand name is required." };
  if (!ownerEmail) return { error: "Client owner email is required." };
  if (!input.ownerPassword || input.ownerPassword.length < 8)
    return { error: "Owner password must be at least 8 characters." };
  if (!hasServiceRole())
    return { error: "Add the service_role key (Vercel + .env.local) to create the client login." };

  const slug = slugify(name);
  if (!slug) return { error: "Could not derive a slug from that name." };

  const admin = createAdminClient();

  // 1. Create the brand.
  const { data: ws, error: wsErr } = await admin
    .from("workspaces")
    .insert({ name, slug, created_by: session.userId })
    .select("id")
    .single<{ id: string }>();
  if (wsErr) {
    if (wsErr.code === "23505") return { error: `A brand with slug "${slug}" already exists.` };
    return { error: wsErr.message };
  }

  // 2. Create the client owner's login.
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: input.ownerPassword,
    email_confirm: true,
    user_metadata: { full_name: input.ownerName.trim() || ownerEmail },
  });
  if (userErr) {
    await admin.from("workspaces").delete().eq("id", ws!.id); // roll back the brand
    return { error: `Client login failed: ${userErr.message}` };
  }
  const clientId = created.user.id;

  // 3. Mark them a client + grant membership to their brand.
  await admin
    .from("profiles")
    .update({ account_type: "client", full_name: input.ownerName.trim() || ownerEmail })
    .eq("id", clientId);
  const { error: memErr } = await admin
    .from("memberships")
    .insert({ workspace_id: ws!.id, user_id: clientId, role: "client" });
  if (memErr) {
    await admin.auth.admin.deleteUser(clientId);
    await admin.from("workspaces").delete().eq("id", ws!.id);
    return { error: `Membership failed: ${memErr.message}` };
  }

  revalidatePath("/dashboard/brands");
  return { ok: true, id: ws!.id };
}

export interface BrandBookInput {
  id: string;
  name: string;
  slug: string;
  primary_hex: string | null;
  secondary_hex: string | null;
  headline_font: string | null;
  body_font: string | null;
  voice_tone: string | null;
  voice_never: string | null;
  photography_style: string | null;
  do_rules: string | null;
  never_rules: string | null;
  locations: string | null;
  ai_style_suffix: string | null;
  scrape_location: string | null;
  scrape_radius_km: number;
}

const HEX_RE = /^[0-9a-fA-F]{6}$/;

/** Lock / update a brand's Brand DNA (the constitution every desk reads). */
export async function updateBrandBook(input: BrandBookInput): Promise<ActionResult> {
  await requireBrandEditor();

  const name = input.name.trim();
  if (!name) return { error: "Brand name is required." };
  const slug = slugify(input.slug.trim() || name);

  const norm = (v: string | null) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  };
  const hex = (v: string | null) => {
    const t = norm(v)?.replace(/^#/, "") ?? null;
    if (t !== null && !HEX_RE.test(t)) return { bad: true as const, v: t };
    return { bad: false as const, v: t };
  };
  const primary = hex(input.primary_hex);
  const secondary = hex(input.secondary_hex);
  if (primary.bad) return { error: `Primary hex "${primary.v}" is not a 6-digit hex code.` };
  if (secondary.bad) return { error: `Secondary hex "${secondary.v}" is not a 6-digit hex code.` };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({
      name,
      slug,
      primary_hex: primary.v,
      secondary_hex: secondary.v,
      headline_font: norm(input.headline_font),
      body_font: norm(input.body_font),
      voice_tone: norm(input.voice_tone),
      voice_never: norm(input.voice_never),
      photography_style: norm(input.photography_style),
      do_rules: norm(input.do_rules),
      never_rules: norm(input.never_rules),
      locations: norm(input.locations),
      ai_style_suffix: norm(input.ai_style_suffix),
      scrape_location: norm(input.scrape_location),
      scrape_radius_km: Number.isFinite(input.scrape_radius_km)
        ? Math.max(1, Math.min(200, Math.floor(input.scrape_radius_km)))
        : 25,
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") return { error: `Slug "${slug}" is already taken.` };
    return { error: error.message };
  }
  revalidatePath("/dashboard/brands");
  revalidatePath(`/dashboard/brands/${input.id}`);
  return { ok: true };
}
