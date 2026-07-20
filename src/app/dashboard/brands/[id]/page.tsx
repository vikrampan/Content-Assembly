import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Asset, BrandBookVersion, Workspace } from "@/lib/types";
import { BrandBookForm } from "./BrandBookForm";
import { BrandKit, type BrandAssetView } from "./BrandKit";
import { BrandImport } from "./BrandImport";
import { BrandBookSections } from "./BrandBookSections";
import { BrandLabs } from "./BrandLabs";
import { BrandLockBar } from "./BrandLockBar";
import { BrandHistory } from "./BrandHistory";

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
  await requireAccess("brands");

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("*").eq("id", id).single<Workspace>();
  if (!data) notFound();

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

  // Signed URL for the primary logo (for the labs preview).
  let logoUrl: string | null = null;
  if (data.logo_path) {
    const { data: signed } = await supabase.storage.from("assets").createSignedUrl(data.logo_path, 3600);
    logoUrl = signed?.signedUrl ?? null;
  }

  const score = coreScore(data);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/dashboard/brands" className="text-xs hover:underline" style={{ color: "var(--muted)" }}>
          ← Brand Books
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{data.name} — Brand Book</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          The constitution. Locked here, obeyed everywhere — copy desk, AI prompts, and the QA firewall.
        </p>
      </div>

      <BrandLockBar workspaceId={id} status={data.brand_status} lockedAt={data.locked_at} filled={score.filled} total={score.total} />
      <BrandImport workspaceId={id} />
      <BrandKit brand={data} assets={kit} />
      <BrandBookForm brand={data} />
      <BrandBookSections workspaceId={id} initial={data.brand_book ?? {}} />
      <BrandLabs brand={data} logoUrl={logoUrl} />
      <BrandHistory versions={versions} />
    </div>
  );
}
