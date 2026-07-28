"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CaptureBrief, Workspace } from "@/lib/types";
import { AiStudio } from "./AiStudio";
import { ShotLists } from "./ShotLists";
import { ImageAnnotator } from "./ImageAnnotator";
import { checkGeneration, deleteLibraryAsset } from "./actions";

export interface AssetView {
  id: string; workspace_id: string; storage_path: string; kind: string; url: string | null; name: string;
  tags: string[]; rating: number; select_status: "none" | "pick" | "reject";
  collection: string | null; note: string | null; captured_at: string | null; rights: string | null;
  prompt: string | null; gen_status: "ready" | "pending" | "failed";
}

const IMG = /\.(png|jpe?g|gif|webp|avif)$/i;
const VID = /\.(mp4|mov|webm|m4v)$/i;
const AUD = /\.(mp3|wav|m4a|aac|ogg)$/i;
const isImg = (a: AssetView) => IMG.test(a.storage_path);
const isVid = (a: AssetView) => VID.test(a.storage_path);
const isAud = (a: AssetView) => AUD.test(a.storage_path);

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

function Stars({ value, onSet }: { value: number; onSet: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={(e) => { e.stopPropagation(); onSet(n === value ? 0 : n); }} className="text-sm leading-none" style={{ color: n <= value ? "var(--accent)" : "var(--line-2)" }}>★</button>
      ))}
    </div>
  );
}

export function CaptureDesk({ workspaces, assets, briefs, folderNotes = [] }: { workspaces: Workspace[]; assets: AssetView[]; briefs: CaptureBrief[]; folderNotes?: { workspace_id: string; folder: string; note: string | null }[] }) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [tab, setTab] = useState<"library" | "generate" | "shots">("library");
  const [items, setItems] = useState(assets);
  const [search, setSearch] = useState("");
  const [kindF, setKindF] = useState("all");
  const [selF, setSelF] = useState("all");
  const [collF, setCollF] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const n of folderNotes) m[`${n.workspace_id}::${n.folder}`] = n.note ?? "";
    return m;
  });
  const [uploadColl, setUploadColl] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<AssetView | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, start] = useTransition();

  const mine = useMemo(() => items.filter((a) => a.workspace_id === workspaceId), [items, workspaceId]);
  const collections = useMemo(() => Array.from(new Set(mine.map((a) => a.collection).filter(Boolean))).sort() as string[], [mine]);
  const folderCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of mine) { const k = a.collection ?? "__none__"; m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [mine]);

  const filtered = useMemo(() => mine.filter((a) => {
    if (kindF === "generated" && a.kind !== "generated") return false;
    if (kindF === "image" && !isImg(a)) return false;
    if (kindF === "video" && !isVid(a)) return false;
    if (kindF === "audio" && !isAud(a)) return false;
    if (selF === "pick" && a.select_status !== "pick") return false;
    if (selF === "reject" && a.select_status !== "reject") return false;
    if (selF === "rated" && a.rating === 0) return false;
    if (collF === "__none__" ? a.collection != null : collF !== "all" && a.collection !== collF) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !(a.tags ?? []).some((t) => t.toLowerCase().includes(q)) && !(a.collection ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [mine, kindF, selF, collF, search]);

  // Only these are real DB columns — `name`/`url`/`id` are view-only, so sending
  // them made the whole update fail (that's why renames didn't stick).
  const DB_COLS = new Set(["label", "rating", "select_status", "collection", "tags", "note", "captured_at", "rights"]);
  async function patch(id: string, fields: Partial<AssetView> & Record<string, unknown>) {
    setItems((list) => list.map((a) => (a.id === id ? { ...a, ...fields } as AssetView : a)));
    const dbFields = Object.fromEntries(Object.entries(fields).filter(([k]) => DB_COLS.has(k)));
    if (Object.keys(dbFields).length) await createClient().from("assets").update(dbFields).eq("id", id);
  }

  // --- Folders (collections) + bulk selection -----------------------------
  async function moveTo(ids: string[], folder: string | null) {
    setItems((list) => list.map((a) => (ids.includes(a.id) ? { ...a, collection: folder } : a)));
    setSelected(new Set());
    await createClient().from("assets").update({ collection: folder }).in("id", ids);
  }
  async function renameFolder(oldName: string) {
    const nn = window.prompt(`Rename folder "${oldName}" to:`, oldName)?.trim();
    if (!nn || nn === oldName) return;
    setItems((list) => list.map((a) => (a.collection === oldName ? { ...a, collection: nn } : a)));
    setNotes((m) => { const c = { ...m }; const v = c[`${workspaceId}::${oldName}`]; if (v !== undefined) { c[`${workspaceId}::${nn}`] = v; delete c[`${workspaceId}::${oldName}`]; } return c; });
    if (collF === oldName) setCollF(nn);
    const db = createClient();
    await db.from("assets").update({ collection: nn }).eq("workspace_id", workspaceId).eq("collection", oldName);
    await db.from("folder_notes").update({ folder: nn }).eq("workspace_id", workspaceId).eq("folder", oldName);
  }
  async function deleteFolder(name: string) {
    if (!window.confirm(`Delete folder "${name}"? Its files move to Uncategorized (nothing is deleted).`)) return;
    setItems((list) => list.map((a) => (a.collection === name ? { ...a, collection: null } : a)));
    setNotes((m) => { const c = { ...m }; delete c[`${workspaceId}::${name}`]; return c; });
    if (collF === name) setCollF("all");
    const db = createClient();
    await db.from("assets").update({ collection: null }).eq("workspace_id", workspaceId).eq("collection", name);
    await db.from("folder_notes").delete().eq("workspace_id", workspaceId).eq("folder", name);
  }
  async function saveNote(folder: string, note: string) {
    setNotes((m) => ({ ...m, [`${workspaceId}::${folder}`]: note }));
    await createClient().from("folder_notes").upsert({ workspace_id: workspaceId, folder, note: note.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,folder" });
  }
  function newFolderFromSelection() {
    const nn = window.prompt("New folder name:")?.trim();
    if (!nn) return;
    moveTo([...selected], nn);
  }
  async function bulkDelete() {
    const ids = [...selected];
    if (!ids.length || !window.confirm(`Delete ${ids.length} file${ids.length > 1 ? "s" : ""}? This can't be undone.`)) return;
    setItems((list) => list.filter((a) => !ids.includes(a.id)));
    setSelected(new Set());
    for (const id of ids) await deleteLibraryAsset(id);
    router.refresh();
  }
  function toggleSel(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || !workspaceId) return;
    setError(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError("Storage isn't configured — this deployment is missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them in Vercel → Settings → Environment Variables, then redeploy.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    try {
      const fresh: AssetView[] = [];
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${workspaceId}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("assets").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        // Return the created row so we can show it immediately (no refresh needed).
        const { data: row, error: rowErr } = await supabase.from("assets").insert({
          workspace_id: workspaceId, storage_path: path, kind: "raw", label: file.name,
          collection: uploadColl.trim() || null,
        }).select("id").single();
        if (rowErr) throw rowErr;
        const { data: signed } = await supabase.storage.from("assets").createSignedUrl(path, 3600);
        fresh.push({
          id: (row as { id: string }).id, workspace_id: workspaceId, storage_path: path, kind: "raw",
          url: signed?.signedUrl ?? null, name: file.name, tags: [], rating: 0, select_status: "none",
          collection: uploadColl.trim() || null, note: null, captured_at: null, rights: null, prompt: null, gen_status: "ready",
        });
      }
      // Prepend the new assets so they appear then and there.
      if (fresh.length) setItems((cur) => [...fresh, ...cur]);
      if (fileRef.current) fileRef.current.value = "";
      start(() => router.refresh());
    } catch (e) {
      console.error("[capture upload]", e);
      setError(e instanceof Error ? e.message : (typeof e === "string" ? e : "Upload failed — check the browser console."));
    } finally { setBusy(false); }
  }

  function remove(id: string) {
    setDrawerId(null);
    start(async () => { await deleteLibraryAsset(id); setItems((l) => l.filter((a) => a.id !== id)); router.refresh(); });
  }

  function check(id: string) {
    start(async () => { await checkGeneration(id); router.refresh(); });
  }

  const drawer = items.find((a) => a.id === drawerId) ?? null;

  const TABS = [
    { k: "library" as const, label: `Library (${mine.length})` },
    { k: "generate" as const, label: "✦ Generate (AI)" },
    { k: "shots" as const, label: `Shot lists (${briefs.filter((b) => b.workspace_id === workspaceId).length})` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs">
          <span className="mb-1 block" style={{ color: "var(--muted)" }}>Brand</span>
          <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <div className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)} className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
              style={tab === t.k ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === "generate" ? (
        <div className="card p-5"><AiStudio workspaceId={workspaceId} /></div>
      ) : tab === "shots" ? (
        <ShotLists workspaceId={workspaceId} briefs={briefs} />
      ) : (
        <>
          <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,video/*,audio/*" onChange={(e) => onFiles(e.target.files)} />

          {/* Prominent drag-and-drop upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
            onClick={() => !busy && fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-8 text-center transition"
            style={{ border: `2px dashed ${dragOver ? "var(--accent)" : "var(--line-2)"}`, background: dragOver ? "var(--accent-soft)" : "var(--panel)", cursor: busy ? "default" : "pointer" }}
          >
            {busy ? (
              <>
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "var(--accent)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>Uploading…</span>
              </>
            ) : (
              <>
                <span className="grid h-11 w-11 place-items-center rounded-xl text-xl text-white" style={{ background: "var(--accent)" }}>↑</span>
                <span className="text-sm font-semibold">Drag photos, video &amp; audio here</span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>or click to browse · stored privately per brand</span>
                <div className="mt-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px]" style={{ color: "var(--faint)" }}>Add to collection:</span>
                  <input value={uploadColl} onChange={(e) => setUploadColl(e.target.value)} placeholder="optional, e.g. Oct shoot" className="rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ ...inputStyle, width: 160 }} />
                </div>
              </>
            )}
          </div>

          {error ? <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>{error}</div> : null}

          {/* Filters — only when there's media to filter */}
          {mine.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, tag, collection…" className="rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, minWidth: 200 }} />
              <select value={kindF} onChange={(e) => setKindF(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm outline-none" style={inputStyle}>
                <option value="all">All types</option><option value="image">Images</option><option value="video">Video</option><option value="audio">Audio</option><option value="generated">AI generated</option>
              </select>
              <select value={selF} onChange={(e) => setSelF(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm outline-none" style={inputStyle}>
                <option value="all">All</option><option value="pick">Picks ✓</option><option value="reject">Rejects</option><option value="rated">Rated</option>
              </select>
              <span className="ml-auto text-xs" style={{ color: "var(--faint)" }}>{filtered.length} of {mine.length}</span>
            </div>
          ) : null}

          {/* Folders */}
          {mine.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {([["all", `All (${mine.length})`], ["__none__", `Uncategorized (${folderCount.get("__none__") ?? 0})`]] as [string, string][]).map(([k, label]) => (
                (k === "__none__" && !(folderCount.get("__none__") ?? 0)) ? null :
                <button key={k} type="button" onClick={() => setCollF(k)} className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                  style={collF === k ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>
                  {k === "__none__" ? "📂 " : "📁 "}{label}
                </button>
              ))}
              {collections.map((c) => (
                <span key={c} className="inline-flex items-center overflow-hidden rounded-full" style={collF === c ? { background: "var(--accent)" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)" }}>
                  <button type="button" onClick={() => setCollF(c)} className="px-3 py-1.5 text-xs font-medium" style={{ color: collF === c ? "#fff" : "var(--ink)" }}>📁 {c} ({folderCount.get(c) ?? 0})</button>
                  {collF === c ? (
                    <>
                      <button type="button" onClick={() => renameFolder(c)} title="Rename folder" className="px-1.5 text-xs text-white/80 hover:text-white">✎</button>
                      <button type="button" onClick={() => deleteFolder(c)} title="Delete folder" className="pr-2 pl-1 text-xs text-white/80 hover:text-white">🗑</button>
                    </>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}

          {/* Note for the editor — per folder */}
          {collF !== "all" && collF !== "__none__" ? (
            <div className="rounded-xl p-3.5" style={{ background: "var(--accent-soft)", border: "1px solid var(--line)" }}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>📝 Note for the editor · {collF}</span>
                <span className="text-[11px]" style={{ color: "var(--faint)" }}>saved automatically</span>
              </div>
              <textarea
                key={collF}
                defaultValue={notes[`${workspaceId}::${collF}`] ?? ""}
                onBlur={(e) => saveNote(collF, e.target.value)}
                rows={3}
                placeholder={"Points for whoever edits this folder…\n• use the red/black treatment\n• keep logo bottom-right\n• export 1080×1350"}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ ...inputStyle, background: "var(--panel)" }}
              />
            </div>
          ) : null}

          {/* Bulk action toolbar */}
          {selected.size > 0 ? (
            <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl p-2.5" style={{ background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow)" }}>
              <span className="text-sm font-semibold">{selected.size} selected</span>
              <select onChange={(e) => { if (e.target.value) { moveTo([...selected], e.target.value === "__none__" ? null : e.target.value); e.target.value = ""; } }} defaultValue="" className="rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "var(--panel)", color: "var(--ink)", border: "none" }}>
                <option value="" disabled>Move to…</option>
                <option value="__none__">Uncategorized</option>
                {collections.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={newFolderFromSelection} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold" style={{ background: "rgba(255,255,255,.2)" }}>+ New folder</button>
              <button type="button" onClick={bulkDelete} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold" style={{ background: "rgba(255,255,255,.2)" }}>Delete</button>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-semibold underline">Clear</button>
            </div>
          ) : null}

          {mine.length === 0 ? (
            <div className="rounded-2xl p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
              No media yet. Drop a shoot above, or try <button type="button" onClick={() => setTab("generate")} className="font-semibold underline" style={{ color: "var(--accent-ink)" }}>✦ Generate (AI)</button>.
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl p-8 text-center text-sm" style={{ border: "1px dashed var(--line-2)", color: "var(--muted)" }}>Nothing matches these filters.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((a) => (
                <div key={a.id} className="group overflow-hidden rounded-xl transition hover:shadow-md" style={{ border: `2px solid ${selected.has(a.id) ? "var(--accent)" : a.select_status === "pick" ? "var(--good)" : a.select_status === "reject" ? "var(--danger)" : "var(--line)"}`, background: "var(--panel)" }}>
                  <div className="relative flex aspect-square cursor-pointer items-center justify-center" style={{ background: "var(--panel-2)" }} onClick={() => (a.gen_status === "ready" ? setLightbox(a) : null)}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleSel(a.id); }} title="Select"
                      className={`absolute left-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-md text-[11px] font-bold transition ${selected.has(a.id) ? "" : "opacity-0 group-hover:opacity-100"}`}
                      style={selected.has(a.id) ? { background: "var(--accent)", color: "#fff" } : { background: "rgba(255,255,255,.85)", color: "var(--ink)", border: "1px solid var(--line-2)" }}>
                      {selected.has(a.id) ? "✓" : ""}
                    </button>
                    {a.gen_status === "pending" ? (
                      <div className="flex flex-col items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />Rendering…
                      </div>
                    ) : a.url && isImg(a) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                    ) : a.url && isVid(a) ? (
                      <video src={a.url} className="h-full w-full object-cover" muted />
                    ) : (
                      <span className="text-3xl" style={{ color: "var(--faint)" }}>{isAud(a) ? "♪" : "▤"}</span>
                    )}
                    {a.kind === "generated" ? <span className="pill pending absolute bottom-1.5 left-1.5">AI</span> : null}
                    {a.select_status === "pick" ? <span className="pill approved absolute right-1.5 top-1.5">Pick</span> : null}
                  </div>
                  <div className="space-y-1.5 p-2">
                    <div className="flex items-center justify-between">
                      <Stars value={a.rating} onSet={(n) => patch(a.id, { rating: n })} />
                      <div className="flex gap-1">
                        <button type="button" onClick={() => patch(a.id, { select_status: a.select_status === "pick" ? "none" : "pick" })} title="Pick" className="text-xs" style={{ color: a.select_status === "pick" ? "var(--good)" : "var(--faint)" }}>✓</button>
                        <button type="button" onClick={() => patch(a.id, { select_status: a.select_status === "reject" ? "none" : "reject" })} title="Reject" className="text-xs" style={{ color: a.select_status === "reject" ? "var(--danger)" : "var(--faint)" }}>✕</button>
                        <button type="button" onClick={() => setDrawerId(a.id)} title="Details" className="text-xs" style={{ color: "var(--faint)" }}>⋯</button>
                      </div>
                    </div>
                    <div className="truncate text-[11px]" title={a.name}>{a.name}</div>
                    {a.gen_status === "pending" ? (
                      <button type="button" onClick={() => check(a.id)} className="text-[11px] font-medium" style={{ color: "var(--accent-ink)" }}>Check status ↻</button>
                    ) : a.collection ? <div className="truncate text-[10px]" style={{ color: "var(--faint)" }}>{a.collection}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setDrawerId(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto p-5" style={{ background: "var(--panel)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Asset details</h3>
              <button type="button" onClick={() => setDrawerId(null)} style={{ color: "var(--faint)" }}>×</button>
            </div>
            <div className="mb-3 overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
              <div className="flex aspect-video items-center justify-center" style={{ background: "var(--panel-2)" }}>
                {drawer.url && isImg(drawer) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={drawer.url} alt={drawer.name} className="max-h-full max-w-full object-contain" />
                ) : drawer.url && isVid(drawer) ? (
                  <video src={drawer.url} controls className="max-h-full max-w-full" />
                ) : drawer.url && isAud(drawer) ? (
                  <audio src={drawer.url} controls className="w-full px-3" />
                ) : <span className="text-3xl" style={{ color: "var(--faint)" }}>▤</span>}
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Name</span>
                <input defaultValue={drawer.name} onBlur={(e) => patch(drawer.id, { label: e.target.value, name: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
              <div className="flex items-center gap-3">
                <Stars value={drawer.rating} onSet={(n) => patch(drawer.id, { rating: n })} />
                <button type="button" onClick={() => patch(drawer.id, { select_status: drawer.select_status === "pick" ? "none" : "pick" })} className="rounded-lg px-3 py-1 text-xs font-semibold" style={drawer.select_status === "pick" ? { background: "var(--good)", color: "#fff" } : { border: "1px solid var(--line-2)", color: "var(--ink)" }}>Pick</button>
                <button type="button" onClick={() => patch(drawer.id, { select_status: drawer.select_status === "reject" ? "none" : "reject" })} className="rounded-lg px-3 py-1 text-xs font-semibold" style={drawer.select_status === "reject" ? { background: "var(--danger)", color: "#fff" } : { border: "1px solid var(--line-2)", color: "var(--ink)" }}>Reject</button>
              </div>
              <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Collection</span>
                <input defaultValue={drawer.collection ?? ""} onBlur={(e) => patch(drawer.id, { collection: e.target.value || null })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
              <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Tags (comma-separated)</span>
                <input defaultValue={(drawer.tags ?? []).join(", ")} onBlur={(e) => patch(drawer.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
              <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Caption / note</span>
                <textarea defaultValue={drawer.note ?? ""} onBlur={(e) => patch(drawer.id, { note: e.target.value || null })} rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Captured</span>
                  <input type="date" defaultValue={drawer.captured_at ?? ""} onBlur={(e) => patch(drawer.id, { captured_at: e.target.value || null })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
                <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Rights</span>
                  <input defaultValue={drawer.rights ?? ""} onBlur={(e) => patch(drawer.id, { rights: e.target.value || null })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
              </div>
              {drawer.prompt ? (
                <div className="rounded-lg p-2 text-[11px]" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}><b>AI prompt:</b> {drawer.prompt}</div>
              ) : null}
              <div className="flex gap-2 pt-1">
                {drawer.url ? <a href={drawer.url} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-sm font-medium" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Open ↗</a> : null}
                <button type="button" onClick={() => remove(drawer.id)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lightbox — images get pin-a-note annotation; video plays plainly */}
      {lightbox ? (
        lightbox.url && isImg(lightbox) ? (
          <ImageAnnotator assetId={lightbox.id} workspaceId={workspaceId} url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.8)" }} onClick={() => setLightbox(null)}>
            {lightbox.url && isVid(lightbox) ? (
              <video src={lightbox.url} controls autoPlay className="max-h-full max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
            ) : lightbox.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={lightbox.name} className="max-h-full max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
