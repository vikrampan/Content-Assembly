"use client";

import { useMemo, useState, useTransition } from "react";
import { DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/mendly/departments";
import type { AiPersona, Workspace } from "@/lib/types";
import { deletePersona, savePersona } from "./actions";

const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5";

const blank = (workspaceId: string, department = "content") => ({
  id: undefined as string | undefined,
  workspaceId,
  department,
  name: "",
  personality: "",
  guidance: "",
  isDefault: false,
});

export function PersonaManager({
  workspaces,
  personas,
}: {
  workspaces: Workspace[];
  personas: AiPersona[];
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [form, setForm] = useState(() => blank(workspaces[0]?.id ?? ""));
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const mine = useMemo(
    () => personas.filter((p) => p.workspace_id === workspaceId),
    [personas, workspaceId],
  );

  function edit(p: AiPersona) {
    setFeedback(null);
    setForm({
      id: p.id,
      workspaceId: p.workspace_id,
      department: p.department,
      name: p.name,
      personality: p.personality,
      guidance: p.guidance ?? "",
      isDefault: p.is_default,
    });
  }
  function reset() {
    setForm(blank(workspaceId, form.department));
    setFeedback(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await savePersona({ ...form, workspaceId });
      if ("error" in res) setFeedback({ kind: "err", text: res.error });
      else {
        setFeedback({ kind: "ok", text: "Persona saved — the AI will use it on the next run." });
        setForm(blank(workspaceId, form.department));
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      await deletePersona(id);
      if (form.id === id) reset();
    });
  }

  return (
    <div className="space-y-5">
      <label className="block text-xs">
        <span className="mb-1 block opacity-70">Brand</span>
        <select
          className={`${inputCls} max-w-xs`}
          value={workspaceId}
          onChange={(e) => {
            setWorkspaceId(e.target.value);
            setForm(blank(e.target.value, form.department));
          }}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* existing */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Personas for this brand</h2>
          {mine.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 p-6 text-center text-xs opacity-55 dark:border-white/15">
              No personas yet. Create one on the right.
            </div>
          ) : (
            mine.map((p) => (
              <div key={p.id} className="rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    {DEPARTMENT_LABELS[p.department] ?? p.department}
                  </span>
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.is_default ? (
                    <span className="rounded-full border border-emerald-400/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">default</span>
                  ) : null}
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => edit(p)} className="rounded-md border border-black/15 px-2 py-0.5 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">Edit</button>
                    <button onClick={() => remove(p.id)} className="rounded-md border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40">Delete</button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 text-xs opacity-70">{p.personality}</p>
              </div>
            ))
          )}
        </div>

        {/* editor */}
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
          <h2 className="text-sm font-semibold">{form.id ? "Edit persona" : "New persona"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block opacity-70">Department</span>
              <select className={inputCls} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block opacity-70">Name</span>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bold Growth Strategist" />
            </label>
          </div>
          <label className="block text-xs">
            <span className="mb-1 block opacity-70">Personality — how the AI should think &amp; write</span>
            <textarea className={inputCls} rows={5} value={form.personality} onChange={(e) => setForm({ ...form, personality: e.target.value })}
              placeholder="You are a bold, data-driven performance marketer. You favour punchy hooks and urgency, but never overpromise…" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block opacity-70">Extra direction (optional)</span>
            <textarea className={inputCls} rows={2} value={form.guidance} onChange={(e) => setForm({ ...form, guidance: e.target.value })}
              placeholder="Always end on a clear CTA. Avoid questions in the hook." />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Make this the default for {DEPARTMENT_LABELS[form.department] ?? form.department}
          </label>

          {feedback ? (
            <div className={`rounded-lg px-3 py-2 text-xs ${feedback.kind === "ok" ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300" : "border border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"}`}>{feedback.text}</div>
          ) : null}

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50">
              {pending ? "Saving…" : form.id ? "Save changes" : "Create persona"}
            </button>
            {form.id ? (
              <button type="button" onClick={reset} className="rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">New instead</button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
