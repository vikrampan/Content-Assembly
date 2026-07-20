import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Asset, CaptureBrief, Workspace } from "@/lib/types";
import { CaptureDesk, type AssetView } from "./CaptureDesk";

const basename = (p: string) => (p.split("/").pop() ?? p).replace(/^[0-9a-f-]{36}-/i, "").replace(/^gen-/, "AI · ");

export default async function LibraryPage() {
  await requireAccess("library");

  const supabase = await createClient();
  const [{ data: ws }, { data: assetRows }, { data: briefRows }] = await Promise.all([
    supabase.from("workspaces").select("*").order("name"),
    // Library media only (not per-content deliverables, not brand kit assets).
    supabase.from("assets").select("*").is("content_id", null).in("kind", ["raw", "generated", "final"]).order("created_at", { ascending: false }),
    supabase.from("capture_briefs").select("*").order("created_at", { ascending: false }),
  ]);
  const workspaces = (ws as Workspace[]) ?? [];
  const assets = (assetRows as Asset[]) ?? [];
  const briefs = (briefRows as CaptureBrief[]) ?? [];

  // Signed URLs (skip pending generations that have no stored file yet).
  const views: AssetView[] = await Promise.all(
    assets.map(async (a) => {
      let url: string | null = null;
      if (a.gen_status !== "pending") {
        const { data } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
        url = data?.signedUrl ?? null;
      }
      return {
        id: a.id, workspace_id: a.workspace_id, storage_path: a.storage_path, kind: a.kind, url,
        name: a.label ?? basename(a.storage_path),
        tags: a.tags ?? [], rating: a.rating ?? 0, select_status: a.select_status ?? "none",
        collection: a.collection, note: a.note, captured_at: a.captured_at, rights: a.rights,
        prompt: a.prompt, gen_status: a.gen_status ?? "ready",
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Media Studio</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Capture, curate, and generate — every brand&apos;s photos, video &amp; audio in one place. Private storage; previews via secure links.
        </p>
      </div>
      {workspaces.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-sm" style={{ border: "1px dashed var(--line-2)", color: "var(--muted)" }}>
          Create a brand first, then capture or generate its media.
        </div>
      ) : (
        <CaptureDesk workspaces={workspaces} assets={views} briefs={briefs} />
      )}
    </div>
  );
}
