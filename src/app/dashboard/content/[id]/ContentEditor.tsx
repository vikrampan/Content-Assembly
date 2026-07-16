"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/lib/types";
import { updateContent } from "./actions";

const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5";

export function ContentEditor({ item }: { item: ContentItem }) {
  const [title, setTitle] = useState(item.title ?? "");
  const [hook, setHook] = useState(item.hook ?? "");
  const [bridge, setBridge] = useState(item.educational_shift ?? "");
  const [cta, setCta] = useState(item.solution ?? "");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty =
    title !== (item.title ?? "") ||
    hook !== (item.hook ?? "") ||
    bridge !== (item.educational_shift ?? "") ||
    cta !== (item.solution ?? "");

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateContent({ id: item.id, title, hook, educationalShift: bridge, solution: cta });
      if ("error" in res) setFeedback({ kind: "err", text: res.error });
      else {
        setFeedback({ kind: "ok", text: "Saved." });
        router.refresh(); // reflect the new title in the header
      }
    });
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Three-tier copy</h2>
          <p className="text-xs opacity-60">Refine the AI draft — humans own what ships.</p>
        </div>
        {dirty ? <span className="text-[11px] text-amber-600">unsaved changes</span> : null}
      </div>

      <div className="space-y-3">
        <label className="block text-xs">
          <span className="mb-1 block opacity-70">Title</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block opacity-70">Hook — one scroll-stopping line</span>
          <textarea className={inputCls} rows={2} value={hook} onChange={(e) => setHook(e.target.value)} />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block opacity-70">Value bridge — taste / sourcing / experience</span>
          <textarea className={inputCls} rows={3} value={bridge} onChange={(e) => setBridge(e.target.value)} />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block opacity-70">CTA — one clear directive</span>
          <textarea className={inputCls} rows={2} value={cta} onChange={(e) => setCta(e.target.value)} />
        </label>
      </div>

      {feedback ? (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            feedback.kind === "ok"
              ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={pending || !dirty}
        className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save copy"}
      </button>
    </section>
  );
}
