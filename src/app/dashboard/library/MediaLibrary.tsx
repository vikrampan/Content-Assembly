"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Workspace } from "@/lib/types";

export interface AssetView {
  id: string;
  workspace_id: string;
  storage_path: string;
  kind: string;
  url: string | null;
  name: string;
}

const IMG = /\.(png|jpe?g|gif|webp|avif)$/i;
const VID = /\.(mp4|mov|webm|m4v)$/i;
const AUD = /\.(mp3|wav|m4a|aac|ogg)$/i;

export function MediaLibrary({
  workspaces,
  assets,
}: {
  workspaces: Workspace[];
  assets: AssetView[];
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const mine = useMemo(
    () => assets.filter((a) => a.workspace_id === workspaceId),
    [assets, workspaceId],
  );

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || !workspaceId) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${workspaceId}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("assets").upload(path, file);
        if (upErr) throw upErr;
        const kind: string = IMG.test(file.name) || VID.test(file.name) ? "raw" : "raw";
        const { error: rowErr } = await supabase.from("assets").insert({
          workspace_id: workspaceId,
          storage_path: path,
          kind,
        });
        if (rowErr) throw rowErr;
      }
      if (fileRef.current) fileRef.current.value = "";
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs">
          <span className="mb-1 block opacity-70">Brand</span>
          <select
            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>

        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
            accept="image/*,video/*,audio/*"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || !workspaceId}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload media"}
          </button>
        </div>
        <span className="text-xs opacity-55">Photos, video &amp; audio · stored per-brand, private</span>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div>
      ) : null}

      {mine.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm opacity-55 dark:border-white/15">
          No media for this brand yet. Upload the shoot above.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {mine.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-xl border border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5">
              <div className="flex aspect-square items-center justify-center bg-black/[0.03] dark:bg-white/[0.03]">
                {a.url && IMG.test(a.name) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                ) : a.url && VID.test(a.name) ? (
                  <video src={a.url} className="h-full w-full object-cover" muted />
                ) : (
                  <span className="text-3xl opacity-40">{AUD.test(a.name) ? "♪" : "▤"}</span>
                )}
              </div>
              <div className="p-2">
                <div className="truncate text-[11px]" title={a.name}>{a.name}</div>
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-[11px] text-amber-700 hover:underline dark:text-amber-400">Open ↗</a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
