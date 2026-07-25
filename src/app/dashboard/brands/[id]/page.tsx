import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { Asset, BrandBookVersion, Workspace } from "@/lib/types";
import { type ClientMember } from "./ClientTeamCard";
import { type BrandAssetView } from "./BrandKit";
import { BrandDeskShell } from "./BrandDeskShell";

const IMG = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const basename = (p: string) => (p.split("/").pop() ?? p).replace(/^[0-9a-f-]{36}-/i, "");

// The core fields whose completeness gates "Lock brand book".
function coreScore(w: Workspace) {
  const fields = [
    w.primary_hex, w.secondary_hex, w.accent_hex, w.headline_font, w.body_font,
    w.voice_tone, w.voice_never, w.photography_style, w.do_rules, w.never_rules,
    w.locations, w.logo_rules, w.ai_style_suffix, w.logo_path,
  ];
  return { filled: fields.filter((f) => f && String(f).trim()).length, total: fields.length };
}

export default async function BrandEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAccess("brands");

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("*").eq("id", id).single<Workspace>();
  if (!data) notFound();

  // Admin-only: the brand's client team (for management).
  let clientMembers: ClientMember[] = [];
  if (session.fn === "admin" && hasServiceRole()) {
    const admin = createAdminClient();
    const { data: mems } = await admin.from("memberships").select("user_id, client_role").eq("workspace_id", id).eq("role", "client");
    const rows = (mems as { user_id: string; client_role: string | null }[]) ?? [];
    clientMembers = await Promise.all(rows.map(async (m) => {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id);
      return { userId: m.user_id, email: u.user?.email ?? "—", name: (u.user?.user_metadata?.full_name as string) ?? u.user?.email ?? "Client", role: m.client_role ?? "owner" };
    }));
  }

  const [{ data: assetRows }, { data: versionRows }] = await Promise.all([
    supabase.from("assets").select("*").eq("workspace_id", id).is("content_id", null).in("kind", ["logo", "font", "brand"]).order("created_at", { ascending: false }),
    supabase.from("brand_book_versions").select("*").eq("workspace_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  const assets = (assetRows as Asset[]) ?? [];
  const versions = (versionRows as BrandBookVersion[]) ?? [];

  const kit: BrandAssetView[] = await Promise.all(
    assets.map(async (a) => {
      const { data: signed } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
      return {
        id: a.id,
        url: signed?.signedUrl ?? null,
        name: a.label ?? basename(a.storage_path),
        kind: a.kind,
        isImage: IMG.test(a.storage_path),
        isPrimaryLogo: data.logo_path === a.storage_path,
      };
    }),
  );

  const score = coreScore(data);

  // Primary logo + injectable @font-face for the live preview.
  const logoUrl = kit.find((a) => a.isPrimaryLogo)?.url ?? kit.find((a) => a.kind === "logo")?.url ?? null;
  const fontAssets = kit.filter((a) => a.kind === "font" && a.url);
  const fmt = (name: string) => (/\.woff2$/i.test(name) ? "woff2" : /\.woff$/i.test(name) ? "woff" : /\.otf$/i.test(name) ? "opentype" : "truetype");
  const fontFaces: string[] = [];
  if (fontAssets[0] && data.headline_font) fontFaces.push(`@font-face{font-family:"${data.headline_font}";src:url("${fontAssets[0].url}") format("${fmt(fontAssets[0].name)}");font-display:swap}`);
  if (fontAssets[1] && data.body_font) fontFaces.push(`@font-face{font-family:"${data.body_font}";src:url("${fontAssets[1].url}") format("${fmt(fontAssets[1].name)}");font-display:swap}`);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/dashboard/brands" className="text-xs hover:underline" style={{ color: "var(--muted)" }}>
          ← Brand Books
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{data.name} — Brand Book</h1>
          <span className={`pill ${data.brand_status === "locked" ? "approved" : "pending"}`}>{data.brand_status === "locked" ? "Locked" : "Draft"}</span>
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          The constitution — the identity every desk and every AI prompt builds from.
        </p>
      </div>

      <BrandDeskShell
        brand={data}
        kit={kit}
        versions={versions}
        clientMembers={clientMembers}
        isAdmin={session.fn === "admin"}
        score={score}
        fontFaces={fontFaces}
        logoUrl={logoUrl}
      />
    </div>
  );
}
