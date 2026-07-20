"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { composePrompt, renderMedia } from "./actions";

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;
const ASPECTS = ["1:1", "4:5", "9:16", "16:9"];

export function AiStudio({ workspaceId }: { workspaceId: string }) {
  const [kind, setKind] = useState<"image" | "video">("image");
  const [idea, setIdea] = useState("");
  const [aspect, setAspect] = useState("4:5");
  const [collection, setCollection] = useState("AI Generated");
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [phase, setPhase] = useState<"idle" | "composing" | "prompt" | "rendering">("idle");
  const [, start] = useTransition();
  const router = useRouter();

  function compose() {
    setMsg(null); setPhase("composing");
    start(async () => {
      const res = await composePrompt(workspaceId, idea, kind);
      if ("error" in res) { setMsg({ kind: "err", text: res.error }); setPhase("idle"); return; }
      setPrompt(res.prompt); setNegative(res.negative ?? ""); setPhase("prompt");
      if (res.provider === "stub") setMsg({ kind: "info", text: "AI prompt-writer needs ANTHROPIC_API_KEY — showing a basic prompt you can edit." });
    });
  }

  function render() {
    setMsg(null); setPhase("rendering");
    start(async () => {
      const res = await renderMedia({ workspaceId, prompt, negative, kind, aspect, collection });
      if ("error" in res) { setMsg({ kind: "err", text: res.error }); setPhase("prompt"); return; }
      if (res.pending) {
        setMsg({ kind: "ok", text: "Video is rendering — it'll appear in the Library as “Pending”. Open it there and hit Check status." });
      } else {
        setMsg({ kind: "ok", text: "Added to your Library ✓" });
      }
      setPhase("prompt");
      router.refresh();
    });
  }

  const busy = phase === "composing" || phase === "rendering";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["image", "video"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className="rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition"
            style={kind === k ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>
            {k === "image" ? "🖼 Image" : "🎬 Video"}
          </button>
        ))}
        <span className="text-xs" style={{ color: "var(--muted)" }}>Grounded in this brand&apos;s style, palette &amp; rules.</span>
      </div>

      <label className="block text-xs">
        <span className="mb-1 block" style={{ color: "var(--muted)" }}>Your idea</span>
        <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={2} placeholder={kind === "image" ? "e.g. hero shot of the wood-fire grill with steam" : "e.g. slow push-in on the grill, embers glowing"} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        {kind === "image" ? (
          <label className="block text-xs">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>Aspect</span>
            <div className="flex gap-1">
              {ASPECTS.map((a) => (
                <button key={a} type="button" onClick={() => setAspect(a)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium tabular-nums" style={aspect === a ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{a}</button>
              ))}
            </div>
          </label>
        ) : null}
        <label className="block flex-1 text-xs">
          <span className="mb-1 block" style={{ color: "var(--muted)" }}>Collection</span>
          <input value={collection} onChange={(e) => setCollection(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        </label>
        <button type="button" onClick={compose} disabled={busy || !idea.trim()} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--ink)" }}>
          {phase === "composing" ? "Composing…" : "✦ Compose on-brand prompt"}
        </button>
      </div>

      {phase === "prompt" || phase === "rendering" ? (
        <div className="space-y-3 rounded-xl p-3" style={{ background: "var(--accent-soft)", border: "1px solid var(--line)" }}>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold" style={{ color: "var(--accent-ink)" }}>Generation prompt (edit freely)</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
          </label>
          {kind === "image" ? (
            <label className="block text-xs">
              <span className="mb-1 block" style={{ color: "var(--muted)" }}>Avoid (negative)</span>
              <input value={negative} onChange={(e) => setNegative(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
            </label>
          ) : null}
          <button type="button" onClick={render} disabled={busy || !prompt.trim()} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {phase === "rendering" ? (kind === "image" ? "Rendering… (~15s)" : "Starting render…") : `Generate ${kind}`}
          </button>
        </div>
      ) : null}

      {msg ? (
        <div className="rounded-lg px-3 py-2 text-xs" style={
          msg.kind === "ok" ? { background: "var(--good-soft)", color: "var(--good)" }
          : msg.kind === "err" ? { background: "rgba(192,85,63,.12)", color: "var(--danger)" }
          : { background: "var(--panel-2)", color: "var(--muted)" }
        }>{msg.text}</div>
      ) : null}
    </div>
  );
}
