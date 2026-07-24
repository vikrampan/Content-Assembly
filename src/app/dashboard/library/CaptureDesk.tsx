"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CaptureBrief, Workspace } from "@/lib/types";
import { AiStudio } from "./AiStudio";
import { ShotLists } from "./ShotLists";
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

export function CaptureDesk({ workspaces, assets, briefs }: { workspaces: Workspace[]; assets: AssetView[]; briefs: CaptureBrief[] }) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [tab, setTab] = useState<"library" | "generate" | "shots">("library");
  const [items, setItems] = useState(assets);
  const [search, setSearch] = useState("");
  const [kindF, setKindF] = useState("all");
  const [selF, setSelF] = useState("all");
  const [collF, setCollF] = useState("all");
  const [uploadColl, setUploadColl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<AssetView | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, start] = useTransition();

  const mine = useMemo(() => items.filter((a) => a.workspace_id === workspaceId), [items, workspaceId]);
  const collections = useMemo(() => Array.from(new Set(mine.map((a) => a.collection).filter(Boolean))) as string[], [mine]);

  const filtered = useMemo(() => mine.filter((a) => {
    if (kindF === "generated" && a.kind !== "generated") return false;
    if (kindF === "image" && !isImg(a)) return false;
    if (kindF === "video" && !isVid(a)) return false;
    if (kindF === "audio" && !isAud(a)) return false;
    if (selF === "pick" && a.select_status !== "pick") return false;
    if (selF === "reject" && a.select_status !== "reject") return false;
    if (selF === "rated" && a.rating === 0) return false;
    if (collF !== "all" && a.collection !== collF) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !(a.tags ?? []).some((t) => t.toLowerCase().includes(q)) && !(a.collection ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [mine, kindF, selF, collF, search]);

  async function patch(id: string, fields: Partial<AssetView> & Record<string, unknown>) {
    setItems((list) => list.map((a) => (a.id === id ? { ...a, ...fields } as AssetView : a)));
    await createClient().from("assets").update(fields).eq("id", id);
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
    const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${workspaceId}/${uid()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("assets").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { error: rowErr } = await supabase.from("assets").insert({
          workspace_id: workspaceId, storage_path: path, kind: "raw", label: file.name,
          collection: uploadColl.trim() || null,
        });
        if (rowErr) throw rowErr;
      }
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
          {/* filters + upload */}
          <div className="flex flex-wrap items-center gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, tag, collection…" className="rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, minWidth: 200 }} />
            <select value={kindF} onChange={(e) => setKindF(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm outline-none" style={inputStyle}>
              <option value="all">All types</option><option value="image">Images</option><option value="video">Video</option><option value="audio">Audio</option><option value="generated">AI generated</option>
            </select>
            <select value={selF} onChange={(e) => setSelF(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm outline-none" style={inputStyle}>
              <option value="all">All</option><option value="pick">Picks ✓</option><option value="reject">Rejects</option><option value="rated">Rated</option>
            </select>
            {collections.length > 0 ? (
              <select value={collF} onChange={(e) => setCollF(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm outline-none" style={inputStyle}>
                <option value="all">All collections</option>
                {collections.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <input value={uploadColl} onChange={(e) => setUploadColl(e.target.value)} placeholder="Collection…" className="rounded-lg px-2.5 py-2 text-sm outline-none" style={{ ...inputStyle, width: 130 }} />
              <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,video/*,audio/*" onChange={(e) => onFiles(e.target.files)} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || !workspaceId} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
                {busy ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>

          {error ? <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>{error}</div> : null}

          {filtered.length === 0 ? (
            <div className="rounded-2xl p-10 text-center text-sm" style={{ border: "1px dashed var(--line-2)", color: "var(--muted)" }}>
              {mine.length === 0 ? "No media for this brand yet — upload the shoot or generate with AI." : "Nothing matches these filters."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((a) => (
                <div key={a.id} className="group overflow-hidden rounded-xl transition hover:shadow-md" style={{ border: `1px solid ${a.select_status === "pick" ? "var(--good)" : a.select_status === "reject" ? "var(--danger)" : "var(--line)"}`, background: "var(--panel)" }}>
                  <div className="relative flex aspect-square cursor-pointer items-center justify-center" style={{ background: "var(--panel-2)" }} onClick={() => (a.gen_status === "ready" ? setLightbox(a) : null)}>
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
                    {a.kind === "generated" ? <span className="pill pending absolute left-1.5 top-1.5">AI</span> : null}
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

      {/* Lightbox */}
      {lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.8)" }} onClick={() => setLightbox(null)}>
          {lightbox.url && isVid(lightbox) ? (
            <video src={lightbox.url} controls autoPlay className="max-h-full max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          ) : lightbox.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.url} alt={lightbox.name} className="max-h-full max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
