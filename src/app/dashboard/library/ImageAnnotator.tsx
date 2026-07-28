"use client";

// Pin-a-note-on-a-photo. Click the image to drop a numbered marker at that exact
// spot and attach a note ("change this here"). Markers + notes persist per asset,
// so whoever edits the photo sees exactly what to change and where.

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Pin { id: string; x: number; y: number; note: string; resolved: boolean }

export function ImageAnnotator({ assetId, workspaceId, url, name, onClose }: {
  assetId: string; workspaceId: string; url: string; name: string; onClose: () => void;
}) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [adding, setAdding] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let on = true;
    createClient().from("asset_annotations").select("id, x, y, note, resolved").eq("asset_id", assetId).order("created_at")
      .then(({ data }) => { if (on) setPins(((data as Pin[]) ?? [])); });
    return () => { on = false; };
  }, [assetId]);

  async function addPin(e: React.MouseEvent) {
    if (!adding || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setAdding(false);
    const { data } = await createClient().from("asset_annotations")
      .insert({ asset_id: assetId, workspace_id: workspaceId, x, y, note: "", resolved: false })
      .select("id, x, y, note, resolved").single();
    if (data) { setPins((p) => [...p, data as Pin]); setActive((data as Pin).id); }
  }
  async function saveNote(id: string, note: string) {
    setPins((p) => p.map((x) => (x.id === id ? { ...x, note } : x)));
    await createClient().from("asset_annotations").update({ note }).eq("id", id);
  }
  async function toggleResolved(id: string) {
    const cur = pins.find((p) => p.id === id); if (!cur) return;
    setPins((p) => p.map((x) => (x.id === id ? { ...x, resolved: !x.resolved } : x)));
    await createClient().from("asset_annotations").update({ resolved: !cur.resolved }).eq("id", id);
  }
  async function remove(id: string) {
    setPins((p) => p.filter((x) => x.id !== id));
    if (active === id) setActive(null);
    await createClient().from("asset_annotations").delete().eq("id", id);
  }

  const open = pins.filter((p) => !p.resolved).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row" style={{ background: "rgba(0,0,0,.85)" }}>
      {/* Image + pins */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={url} alt={name} onClick={addPin}
            className="max-h-[80vh] max-w-full rounded-lg" style={{ cursor: adding ? "crosshair" : "default" }} />
          {pins.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setActive(p.id)}
              className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] font-bold text-white shadow-md transition hover:scale-110"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, background: p.resolved ? "var(--good)" : "var(--accent)", border: active === p.id ? "2px solid #fff" : "2px solid rgba(255,255,255,.6)" }}>
              {p.resolved ? "✓" : i + 1}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAdding((a) => !a)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-105"
          style={{ background: adding ? "var(--danger)" : "var(--accent)" }}>
          {adding ? "Click the photo to place the note" : "📍 Add a note"}
        </button>
      </div>

      {/* Notes panel */}
      <div className="flex max-h-[45vh] flex-col overflow-hidden md:h-full md:max-h-none md:w-80" style={{ background: "var(--panel)" }}>
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--line)" }}>
          <div>
            <div className="text-sm font-semibold">Notes on this photo</div>
            <div className="text-[11px]" style={{ color: "var(--faint)" }}>{open} open · {pins.length} total</div>
          </div>
          <button type="button" onClick={onClose} className="text-lg" style={{ color: "var(--faint)" }}>×</button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {pins.length === 0 ? (
            <p className="p-4 text-center text-sm" style={{ color: "var(--muted)" }}>Tap <b>📍 Add a note</b>, then click the exact spot on the photo you want changed.</p>
          ) : pins.map((p, i) => (
            <div key={p.id} className="rounded-xl p-3" style={{ background: active === p.id ? "var(--accent-soft)" : "var(--panel-2)", border: `1px solid ${active === p.id ? "var(--accent)" : "var(--line)"}` }}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: p.resolved ? "var(--good)" : "var(--accent)" }}>{p.resolved ? "✓" : i + 1}</span>
                <button type="button" onClick={() => toggleResolved(p.id)} className="text-[11px] font-semibold" style={{ color: p.resolved ? "var(--good)" : "var(--muted)" }}>{p.resolved ? "Resolved" : "Mark done"}</button>
                <button type="button" onClick={() => remove(p.id)} className="ml-auto text-[11px]" style={{ color: "var(--faint)" }}>Delete</button>
              </div>
              <textarea defaultValue={p.note} onFocus={() => setActive(p.id)} onBlur={(e) => saveNote(p.id, e.target.value)} rows={2} placeholder="What should change here?"
                className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
