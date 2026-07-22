import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";
export { CLIENT_STEPS, stageStep, stageLabel } from "./stage";

export const CV_IMG = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
export const CV_VID = /\.(mp4|mov|webm|m4v)$/i;

/** The single brand a client can see (RLS returns only theirs). */
export async function clientWorkspace() {
  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("*").limit(1).maybeSingle<Workspace>();
  return { supabase, ws };
}

export function accentOf(ws: Workspace) {
  return ws.primary_hex ? `#${ws.primary_hex}` : "#C8853F";
}

/** Inject the brand's uploaded fonts + return the headline family. */
export async function brandFonts(supabase: Awaited<ReturnType<typeof createClient>>, ws: Workspace) {
  const { data: fontRows } = await supabase.from("assets").select("storage_path").eq("workspace_id", ws.id).eq("kind", "font").order("created_at");
  const paths = (fontRows as { storage_path: string }[] | null) ?? [];
  const fmt = (p: string) => (/\.woff2$/i.test(p) ? "woff2" : /\.woff$/i.test(p) ? "woff" : /\.otf$/i.test(p) ? "opentype" : "truetype");
  const faces: string[] = [];
  if (paths[0] && ws.headline_font) {
    const { data } = await supabase.storage.from("assets").createSignedUrl(paths[0].storage_path, 3600);
    if (data?.signedUrl) faces.push(`@font-face{font-family:"${ws.headline_font}";src:url("${data.signedUrl}") format("${fmt(paths[0].storage_path)}");font-display:swap}`);
  }
  if (paths[1] && ws.body_font) {
    const { data } = await supabase.storage.from("assets").createSignedUrl(paths[1].storage_path, 3600);
    if (data?.signedUrl) faces.push(`@font-face{font-family:"${ws.body_font}";src:url("${data.signedUrl}") format("${fmt(paths[1].storage_path)}");font-display:swap}`);
  }
  return { faces, headlineFamily: ws.headline_font ? `"${ws.headline_font}", var(--serif)` : "var(--serif)" };
}

/** Signed logo URL, if set. */
export async function logoUrlOf(supabase: Awaited<ReturnType<typeof createClient>>, ws: Workspace) {
  if (!ws.logo_path) return null;
  const { data } = await supabase.storage.from("assets").createSignedUrl(ws.logo_path, 3600);
  return data?.signedUrl ?? null;
}

/** First creative image/video (signed) for each content id. */
export async function creativesFor(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const map = new Map<string, { url: string; isVideo: boolean }[]>();
  if (ids.length === 0) return map;
  const { data } = await supabase.from("assets").select("content_id, storage_path").in("content_id", ids).in("kind", ["final", "raw", "generated"]);
  for (const a of (data as { content_id: string; storage_path: string }[]) ?? []) {
    if (!CV_IMG.test(a.storage_path) && !CV_VID.test(a.storage_path)) continue;
    const { data: s } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
    if (!s?.signedUrl) continue;
    const list = map.get(a.content_id) ?? [];
    list.push({ url: s.signedUrl, isVideo: CV_VID.test(a.storage_path) });
    map.set(a.content_id, list);
  }
  return map;
}

/** Page frame: brand fonts + a section title/subtitle. */
export function SectionHeader({ title, subtitle, family }: { title: string; subtitle?: string; family: string }) {
  return (
    <div className="mb-1">
      <h1 className="text-2xl font-bold" style={{ fontFamily: family, letterSpacing: "-.01em" }}>{title}</h1>
      {subtitle ? <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>{subtitle}</p> : null}
    </div>
  );
}

export function BrandStyle({ faces }: { faces: string[] }) {
  if (faces.length === 0) return null;
  return <style dangerouslySetInnerHTML={{ __html: faces.join("") }} />;
}
