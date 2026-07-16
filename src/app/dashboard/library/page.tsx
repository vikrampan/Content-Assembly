import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Asset, Workspace } from "@/lib/types";
import { MediaLibrary, type AssetView } from "./MediaLibrary";

const basename = (p: string) => {
  const raw = p.split("/").pop() ?? p;
  // strip the "<uuid>-" prefix we add on upload
  return raw.replace(/^[0-9a-f-]{36}-/i, "");
};

export default async function LibraryPage() {
  const session = await requireSession();
  if (session.role === "client") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: ws }, { data: assetRows }] = await Promise.all([
    supabase.from("workspaces").select("*").order("name"),
    supabase.from("assets").select("*").order("created_at", { ascending: false }),
  ]);
  const workspaces = (ws as Workspace[]) ?? [];
  const assets = (assetRows as Asset[]) ?? [];

  // Signed URLs for preview (private bucket).
  const views: AssetView[] = await Promise.all(
    assets.map(async (a) => {
      const { data } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
      return {
        id: a.id,
        workspace_id: a.workspace_id,
        storage_path: a.storage_path,
        kind: a.kind,
        url: data?.signedUrl ?? null,
        name: basename(a.storage_path),
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Media Library</h1>
        <p className="text-sm opacity-60">
          The central library — every shoot lives here, per brand, ready for the
          editors. Private storage; previews via secure links.
        </p>
      </div>
      {workspaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm opacity-60 dark:border-white/15">
          Create a brand first, then upload its media.
        </div>
      ) : (
        <MediaLibrary workspaces={workspaces} assets={views} />
      )}
    </div>
  );
}
