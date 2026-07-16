"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id?: string } | { error: string };

async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Forbidden: admin only");
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

/** Create a new brand (workspace). Brand DNA is filled in on the editor after. */
export async function createBrand(input: {
  name: string;
  slug?: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  const name = input.name.trim();
  if (!name) return { error: "Brand name is required." };
  const slug = slugify(input.slug?.trim() || name);
  if (!slug) return { error: "Could not derive a slug from that name." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name, slug, created_by: session.userId })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (error.code === "23505") return { error: `A brand with slug "${slug}" already exists.` };
    return { error: error.message };
  }
  revalidatePath("/dashboard/brands");
  return { ok: true, id: data!.id };
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
  await requireAdmin();

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
