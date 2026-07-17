"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STAGES, STAGE_LABEL, deskStage, nextStage } from "@/lib/mendly/stages";
import { advanceStage, returnStage, routeStage } from "./actions";

const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5";

export function AssignPanel({
  contentId,
  stage,
  note,
  fn,
}: {
  contentId: string;
  stage: string;
  note: string | null;
  fn: string;
}) {
  const [target, setTarget] = useState(stage);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const isAdmin = fn === "admin";
  const holdsIt = deskStage(fn) === stage;
  const forward = nextStage(stage);

  function run(fnc: Promise<{ ok: true; message?: string } | { error: string }>) {
    setMsg(null);
    start(async () => {
      const res = await fnc;
      if ("error" in res) setMsg(res.error);
      else { setText(""); router.refresh(); }
    });
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Pipeline</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          {STAGE_LABEL[stage] ?? stage}
        </span>
      </div>

      {note ? (
        <div className="mb-3 rounded-lg border-l-2 border-amber-500 bg-amber-500/5 px-3 py-2 text-xs">
          <span className="font-semibold opacity-70">Note: </span>{note}
        </div>
      ) : null}

      {isAdmin ? (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide opacity-55">Route this card to</div>
          <div className="flex flex-wrap gap-2">
            <select className={`${inputCls} max-w-[200px]`} value={target} onChange={(e) => setTarget(e.target.value)}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button onClick={() => run(routeStage(contentId, target, text))} disabled={pending || target === stage} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-40">Route</button>
          </div>
          <textarea className={inputCls} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Brief / note (optional)…" />
        </div>
      ) : holdsIt ? (
        <div className="space-y-2">
          <textarea className={inputCls} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Note (optional)…" />
          <div className="flex flex-wrap gap-2">
            {stage !== "qa" && forward ? (
              <button onClick={() => run(advanceStage(contentId, text))} disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">
                Done → send to {STAGE_LABEL[forward]}
              </button>
            ) : null}
            <button onClick={() => run(returnStage(contentId, text))} disabled={pending} className="rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
              Send back
            </button>
          </div>
          {stage === "qa" ? <p className="text-xs opacity-55">Use the QA firewall below to pass this to the client.</p> : null}
        </div>
      ) : (
        <p className="text-xs opacity-55">This card is on the {STAGE_LABEL[stage]} stage. Only that desk or the admin can move it.</p>
      )}

      {msg ? <div className="mt-2 text-xs text-red-600">{msg}</div> : null}
    </section>
  );
}
