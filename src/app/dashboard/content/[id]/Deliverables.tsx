"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { attachLibraryAsset, listLibraryPicks, removeAsset, type LibraryPick } from "./actions";

export interface DeliverableView {
  id: string;
  url: string | null;
  name: string;
  kind: string;
  isImage: boolean;
  isVideo: boolean;
}

export function Deliverables({
  contentId,
  workspaceId,
  items,
}: {
  contentId: string;
  workspaceId: string;
  items: DeliverableView[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markFinal, setMarkFinal] = useState(true);
  const [picker, setPicker] = useState(false);
  const [picks, setPicks] = useState<LibraryPick[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, start] = useTransition();

  function openPicker() {
    setPicker(true); setPicks(null); setError(null);
    start(async () => { setPicks(await listLibraryPicks(workspaceId)); });
  }
  function attach(assetId: string) {
    start(async () => {
      const res = await attachLibraryAsset(contentId, assetId);
      if ("error" in res) setError(res.error);
      else { setPicker(false); router.refresh(); }
    });
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${workspaceId}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("assets").upload(path, file);
        if (upErr) throw upErr;
        const { error: rowErr } = await supabase.from("assets").insert({
          workspace_id: workspaceId,
          content_id: contentId,
          storage_path: path,
          kind: markFinal ? "final" : "raw",
          label: file.name,
        });
        if (rowErr) throw rowErr;
      }
      if (fileRef.current) fileRef.current.value = "";
      start(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const res = await removeAsset(id);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Creative deliverables</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Attach the designed / shot / edited creative for this post.</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
          <input type="checkbox" checked={markFinal} onChange={(e) => setMarkFinal(e.target.checked)} className="accent-[var(--accent)]" />
          Mark as final
        </label>
      </div>

      {items.length > 0 ? (
        <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))" }}>
          {items.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
              <div className="flex aspect-square items-center justify-center" style={{ background: "var(--panel-2)" }}>
                {a.isImage && a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                ) : a.isVideo && a.url ? (
                  <video src={a.url} className="h-full w-full object-cover" muted />
                ) : (
                  <span className="text-2xl" style={{ color: "var(--faint)" }}>▤</span>
                )}
              </div>
              {a.kind === "final" ? <span className="pill approved absolute left-1.5 top-1.5">Final</span> : null}
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md text-white opacity-0 transition group-hover:opacity-100"
                style={{ background: "rgba(0,0,0,.55)" }}
                title="Remove"
              >×</button>
              <div className="truncate px-2 py-1 text-[10px]" style={{ color: "var(--muted)" }}>{a.name}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-3 rounded-xl p-6 text-center text-xs" style={{ border: "1px dashed var(--line-2)", color: "var(--faint)" }}>
          No creative attached yet.
        </div>
      )}

      <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,video/*,audio/*,.pdf" onChange={(e) => onFiles(e.target.files)} />
      <div className="flex gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {busy ? "Uploading…" : "Upload creative"}
        </button>
        <button type="button" onClick={openPicker} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>
          Add from Library
        </button>
      </div>
      {error ? <div className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{error}</div> : null}

      {picker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }} onClick={() => setPicker(false)}>
          <div className="card max-h-[80vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Pick from the Media Library</h3>
              <button type="button" onClick={() => setPicker(false)} style={{ color: "var(--faint)" }}>×</button>
            </div>
            {picks === null ? (
              <div className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
            ) : picks.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>No library media for this brand yet.</div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {picks.map((p) => (
                  <button key={p.id} type="button" onClick={() => attach(p.id)} className="group overflow-hidden rounded-xl text-left transition hover:shadow-md" style={{ border: "1px solid var(--line)" }}>
                    <div className="flex aspect-square items-center justify-center" style={{ background: "var(--panel-2)" }}>
                      {p.isImage && p.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                      ) : p.isVideo && p.url ? (
                        <video src={p.url} className="h-full w-full object-cover" muted />
                      ) : <span className="text-2xl" style={{ color: "var(--faint)" }}>▤</span>}
                    </div>
                    <div className="truncate px-2 py-1 text-[10px]" style={{ color: "var(--muted)" }}>{p.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
