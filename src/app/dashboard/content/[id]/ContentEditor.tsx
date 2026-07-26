"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem, ContentVersion, ContentBody } from "@/lib/types";
import { draftContentBody, restoreVersion, saveContentBody } from "./actions";
import { FormatBody } from "./FormatBody";
import { ContentPreview } from "./ContentPreview";

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

const TONES = ["Warm & inviting", "Playful", "Premium & editorial", "Urgent", "Minimal", "Storyteller"];

const HEADING: Record<string, { title: string; sub: string }> = {
  post: { title: "Post copy", sub: "The caption that ships — humans own what ships." },
  carousel: { title: "Carousel", sub: "Slide by slide, then the caption." },
  reel: { title: "Reel script", sub: "Hook, beats, and caption — this is also your shot list for Production." },
  story: { title: "Story frames", sub: "Frame by frame, kept short." },
};

/** Seed a body from the stored content_body, or from the legacy columns. */
function seedBody(item: ContentItem): ContentBody {
  if (item.content_body) return item.content_body;
  switch (item.format) {
    case "carousel": return { slides: [], caption: item.hook ?? "", hashtags: [] };
    case "reel": return { hook_text: item.hook ?? "", beats: [], caption: item.educational_shift ?? "", hashtags: [] };
    case "story": return { frames: [] };
    default: return { hook: item.hook ?? "", body: item.educational_shift ?? "", cta: item.solution ?? "", caption: "", hashtags: [] };
  }
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ContentEditor({ item, versions, brand }: { item: ContentItem; versions: ContentVersion[]; brand: { name: string; accent: string } }) {
  const seed = useMemo(() => seedBody(item), [item]);
  const [title, setTitle] = useState(item.title ?? "");
  const [body, setBody] = useState<ContentBody>(seed);
  const [tone, setTone] = useState(item.tone ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const heading = HEADING[item.format] ?? HEADING.post;
  const dirty = title !== (item.title ?? "") || JSON.stringify(body) !== JSON.stringify(seed);

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveContentBody({ id: item.id, title, format: item.format, body });
      if ("error" in res) setFeedback({ kind: "err", text: res.error });
      else { setFeedback({ kind: "ok", text: "Saved." }); router.refresh(); }
    });
  }
  function draftForMe() {
    setFeedback(null);
    startTransition(async () => {
      const res = await draftContentBody(item.id, tone);
      if ("error" in res) setFeedback({ kind: "err", text: res.error });
      else { setBody(res.body); setFeedback({ kind: "ok", text: "Drafted from the brief — review and Save." }); }
    });
  }
  function restore(id: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await restoreVersion(id);
      if ("error" in res) setFeedback({ kind: "err", text: res.error });
      else { setFeedback({ kind: "ok", text: "Restored." }); router.refresh(); }
    });
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{heading.title}</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{heading.sub}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? <span className="text-[11px]" style={{ color: "var(--accent-ink)" }}>unsaved</span> : null}
          {versions.length > 0 ? (
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>
              History ({versions.length})
            </button>
          ) : null}
        </div>
      </div>

      {/* AI draft bar — never start from a blank post */}
      <div className="mb-4 rounded-xl p-3" style={{ background: "var(--accent-soft)", border: "1px solid var(--line)" }}>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--accent-ink)" }}>Draft on-brand from Strategy&apos;s brief</div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button key={t} type="button" onClick={() => setTone(t)} className="rounded-full px-2.5 py-1 text-xs font-medium transition"
              style={tone === t ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input className={inputCls} style={{ ...inputStyle, flex: 1, minWidth: 180 }} value={tone} onChange={(e) => setTone(e.target.value)} placeholder="…or type a custom angle" />
          <button type="button" onClick={draftForMe} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {pending ? "Drafting…" : "✦ Draft this post for me"}
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="mb-4 rounded-xl p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Version history</div>
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-start gap-2 rounded-lg p-2" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--faint)" }}>
                    <span>{timeAgo(v.created_at)}</span>
                    {v.note ? <span>· {v.note}</span> : null}
                    {v.tone ? <span className="pill pending">{v.tone}</span> : null}
                  </div>
                  <div className="mt-0.5 truncate text-xs">{v.hook ?? "—"}</div>
                </div>
                <button type="button" onClick={() => restore(v.id)} disabled={pending} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Restore</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Title + format-aware body + live preview */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <label className="mb-3 block text-xs">
            <span className="mb-1 block" style={{ color: "var(--muted)" }}>Title</span>
            <input className={inputCls} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <FormatBody format={item.format} body={body} onChange={setBody} />

          {feedback ? (
            <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={feedback.kind === "ok"
              ? { background: "var(--good-soft)", color: "var(--good)" }
              : { background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>
              {feedback.text}
            </div>
          ) : null}

          <button type="button" onClick={save} disabled={pending || !dirty} className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--ink)" }}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Live preview</div>
          <ContentPreview format={item.format} body={body} brand={brand} />
        </div>
      </div>
    </section>
  );
}
