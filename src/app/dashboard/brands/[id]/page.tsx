import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Asset, Workspace } from "@/lib/types";
import { BrandBookForm } from "./BrandBookForm";
import { BrandKit, type BrandAssetView } from "./BrandKit";

const IMG = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const basename = (p: string) => (p.split("/").pop() ?? p).replace(/^[0-9a-f-]{36}-/i, "");

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

  // Brand-level assets (logos/fonts/brand) — content_id is null for these.
  const { data: assetRows } = await supabase
    .from("assets")
    .select("*")
    .eq("workspace_id", id)
    .is("content_id", null)
    .in("kind", ["logo", "font", "brand"])
    .order("created_at", { ascending: false });
  const assets = (assetRows as Asset[]) ?? [];

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/brands" className="text-xs hover:underline" style={{ color: "var(--muted)" }}>
          ← Brand Books
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{data.name} — Brand Book</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          The constitution. Locked here, obeyed everywhere — copy desk, AI prompts, and the QA firewall.
        </p>
      </div>
      <BrandKit brand={data} assets={kit} />
      <BrandBookForm brand={data} />
    </div>
  );
}
