"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { AiPersona, Workspace } from "@/lib/types";
import { OBJECTIVE_LABELS, OBJECTIVES, type Medium, type Objective } from "@/lib/mendly/strategy";
import { runStrategyDesk, type StrategyResult } from "./actions";

const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5";

export function StrategyDesk({
  workspaces,
  personas,
}: {
  workspaces: Workspace[];
  personas: AiPersona[];
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [objective, setObjective] = useState<Objective>("launch");
  const [medium, setMedium] = useState<Medium>("post");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Personas that shape copy — the content & strategy brains for this brand.
  const brainDepts = ["content", "strategy"];
  const availablePersonas = useMemo(
    () =>
      personas.filter(
        (p) => p.workspace_id === workspaceId && brainDepts.includes(p.department),
      ),
    [personas, workspaceId],
  );

  // Live preview of the deterministic decision, before the AI even runs.
  const row = OBJECTIVES[objective];
  const previewFormat = medium === "reel" ? row.reel : row.post;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await runStrategyDesk({
        workspaceId,
        objective,
        medium,
        brief,
        title,
        personaId: personaId || null,
      });
      if ("error" in res) setError(res.error);
      else setResult(res);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5"
      >
        <h2 className="text-sm font-semibold">Your brief comes in</h2>
        <p className="mb-4 mt-0.5 text-xs opacity-60">
          You define the message. The desk engineers the medium — never by taste.
        </p>

        <div className="space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block opacity-70">Brand workspace</span>
            <select
              className={inputCls}
              value={workspaceId}
              onChange={(e) => {
                setWorkspaceId(e.target.value);
                setPersonaId(""); // personas are per-brand
              }}
              required
            >
              {workspaces.length === 0 ? (
                <option value="">No workspaces available</option>
              ) : (
                workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block opacity-70">AI persona (the brain)</span>
            <select className={inputCls} value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
              <option value="">Brand voice only (no persona)</option>
              {availablePersonas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.is_default ? " · default" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block opacity-70">Objective (your goal)</span>
            <select className={inputCls} value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
              {(Object.keys(OBJECTIVE_LABELS) as Objective[]).map((o) => (
                <option key={o} value={o}>
                  {OBJECTIVE_LABELS[o]}
                </option>
              ))}
            </select>
          </label>

          <div className="block text-xs">
            <span className="mb-1 block opacity-70">Medium</span>
            <div className="flex gap-2">
              {(["post", "reel"] as Medium[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMedium(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${
                    medium === m
                      ? "border-amber-500 bg-amber-500/10 font-medium"
                      : "border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs">
            <span className="mb-1 block opacity-70">Title (optional)</span>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monsoon warm-brew launch" />
          </label>

          <label className="block text-xs">
            <span className="mb-1 block opacity-70">The message / brief</span>
            <textarea
              className={inputCls}
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="A new seasonal warm brew for the monsoon — cozy, limited to the rainy weeks."
              required
            />
          </label>

          <div className="rounded-lg border border-dashed border-black/15 px-3 py-2 text-xs dark:border-white/15">
            <span className="opacity-55">Format decision (live): </span>
            <span className="font-medium">{previewFormat}</span>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending || !workspaceId || !brief.trim()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? "Engineering…" : "Run the strategy desk"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="text-sm font-semibold">The desk's output</h2>
        {!result ? (
          <p className="mt-6 text-center text-xs opacity-50">
            Run a brief to see the format decision and the on-brand three-tier copy draft.
          </p>
        ) : (
          <div className="mt-3 space-y-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide opacity-55">Format decision</div>
              <div className="mt-1 font-medium">{result.formatType}</div>
              <div className="mt-1 text-xs opacity-70">{result.rationale}</div>
            </div>
            <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
              <div className="text-xs uppercase tracking-wide opacity-55">
                Three-tier copy
                <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">
                  {result.provider === "claude" ? "Claude" : "stub"}
                </span>
              </div>
              <p className="mt-2"><span className="opacity-55">Hook — </span>{result.hook}</p>
              <p className="mt-1.5"><span className="opacity-55">Value bridge — </span>{result.valueBridge}</p>
              <p className="mt-1.5"><span className="opacity-55">CTA — </span>{result.cta}</p>
            </div>
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              Draft <strong>{result.title}</strong> created and moved into the pipeline (Research · L1).{" "}
              <Link href="/dashboard" className="underline">View on the board →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
