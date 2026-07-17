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

// ===========================================================================
// Brand Designer — visual kit (logos, fonts, palette, logo rules).
// Uploads happen client-side (Supabase Storage RLS scopes them to the brand);
// these actions record the asset rows and the palette/rule metadata.
// ===========================================================================

/** Save the extra palette + accent colour + logo usage rules. */
export async function saveVisualKit(input: {
  id: string;
  accent_hex: string | null;
  palette: { hex: string; name?: string }[];
  logo_rules: string | null;
}): Promise<ActionResult> {
  await requireBrandEditor();
  const clean = (input.palette ?? [])
    .map((p) => ({ hex: (p.hex ?? "").replace(/^#/, "").trim(), name: (p.name ?? "").trim() || undefined }))
    .filter((p) => HEX_RE.test(p.hex));
  const accent = (input.accent_hex ?? "").replace(/^#/, "").trim();
  if (accent && !HEX_RE.test(accent)) return { error: `Accent hex "${accent}" is not a 6-digit hex code.` };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({
      accent_hex: accent || null,
      palette: clean.length ? clean : null,
      logo_rules: (input.logo_rules ?? "").trim() || null,
    })
    .eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/brands/${input.id}`);
  return { ok: true };
}

/** Register an uploaded brand asset (logo/font/brand) and optionally make it the primary logo. */
export async function registerBrandAsset(input: {
  workspaceId: string;
  storagePath: string;
  kind: "logo" | "font" | "brand";
  label: string;
  makePrimaryLogo?: boolean;
}): Promise<ActionResult> {
  const session = await requireBrandEditor();
  const supabase = await createClient();
  const { error } = await supabase.from("assets").insert({
    workspace_id: input.workspaceId,
    kind: input.kind,
    storage_path: input.storagePath,
    label: input.label,
    uploaded_by: session.userId,
  });
  if (error) return { error: error.message };
  if (input.makePrimaryLogo || input.kind === "logo") {
    await supabase.from("workspaces").update({ logo_path: input.storagePath }).eq("id", input.workspaceId);
  }
  revalidatePath(`/dashboard/brands/${input.workspaceId}`);
  return { ok: true };
}

/** Delete a brand asset (object + row); clears logo_path if it was the primary. */
export async function deleteBrandAsset(assetId: string): Promise<ActionResult> {
  await requireBrandEditor();
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("assets")
    .select("id, storage_path, workspace_id")
    .eq("id", assetId)
    .single<{ id: string; storage_path: string; workspace_id: string }>();
  if (!a) return { error: "Not found." };
  await supabase.storage.from("assets").remove([a.storage_path]);
  await supabase.from("assets").delete().eq("id", assetId);
  await supabase
    .from("workspaces")
    .update({ logo_path: null })
    .eq("id", a.workspace_id)
    .eq("logo_path", a.storage_path);
  revalidatePath(`/dashboard/brands/${a.workspace_id}`);
  return { ok: true };
}
