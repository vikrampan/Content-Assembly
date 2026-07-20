"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem, ContentVariant, HookCandidate, VoiceFlags } from "@/lib/types";
import { DEVICES, FRAMEWORKS, HOOK_FORMULAS, HOOK_MAP, PLATFORMS, TRIGGERS } from "@/lib/mendly/copy";
import {
  applyHook, deleteVariant, engineerCopyAction, generateHooksAction,
  generateVariantAction, lintVoiceAction, saveVariant,
} from "./actions";

const inputStyle = { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" } as const;

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} className="rounded-full px-2.5 py-1 text-xs font-medium transition"
      style={active ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>
      {children}
    </button>
  );
}

function avg(s: HookCandidate["score"]) { return Math.round((s.stop + s.curiosity + s.clarity + s.fit) / 4); }

export function CopyStudio({ item, variants }: { item: ContentItem; variants: ContentVariant[] }) {
  const [tab, setTab] = useState<"hooks" | "engineer" | "voice" | "variants">("hooks");
  const [formula, setFormula] = useState("curiosity_gap");
  const [hooks, setHooks] = useState<HookCandidate[]>(item.hook_options ?? []);
  const [triggers, setTriggers] = useState<string[]>(item.triggers ?? []);
  const [framework, setFramework] = useState<string | null>(item.framework ?? null);
  const [devices, setDevices] = useState<string[]>(item.devices ?? []);
  const [tone, setTone] = useState("");
  const [flags, setFlags] = useState<VoiceFlags | null>(item.voice_flags ?? null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const toggle = (arr: string[], set: (v: string[]) => void, k: string) => set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const run = (p: Promise<{ ok: true; message?: string } | { error: string }>, after?: () => void) => {
    setMsg(null);
    start(async () => {
      const res = await p;
      if ("error" in res) setMsg({ kind: "err", text: res.error });
      else { if ("message" in res && res.message) setMsg({ kind: "ok", text: res.message }); after?.(); router.refresh(); }
    });
  };

  const TABS = [
    { k: "hooks" as const, label: "Hook engine" },
    { k: "engineer" as const, label: "Engineer copy" },
    { k: "voice" as const, label: "Voice check" },
    { k: "variants" as const, label: `Platforms (${variants.length})` },
  ];

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Copy Studio</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Engineer the scroll-stop — AI proposes, you decide.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)} className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
            style={tab === t.k ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{t.label}</button>
        ))}
      </div>

      {msg ? <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={msg.kind === "ok" ? { background: "var(--good-soft)", color: "var(--good)" } : { background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>{msg.text}</div> : null}

      {/* HOOK ENGINE */}
      {tab === "hooks" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {HOOK_FORMULAS.map((f) => <Chip key={f.key} active={formula === f.key} onClick={() => setFormula(f.key)} title={f.hint}>{f.label}</Chip>)}
          </div>
          <button type="button" onClick={() => run(generateHooksAction(item.id, formula))} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {pending ? "Writing hooks…" : `✦ Generate ${HOOK_MAP[formula]?.label ?? ""} hooks`}
          </button>
          {(item.hook_options ?? hooks).length > 0 ? (
            <div className="space-y-2">
              {(item.hook_options ?? hooks).map((h, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: avg(h.score) >= 80 ? "var(--good)" : avg(h.score) >= 60 ? "var(--accent)" : "var(--danger)" }}>{avg(h.score)}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{h.text}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]" style={{ color: "var(--faint)" }}>
                        <span>stop {h.score.stop}</span><span>curiosity {h.score.curiosity}</span><span>clarity {h.score.clarity}</span><span>fit {h.score.fit}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => run(applyHook(item.id, h.text))} disabled={pending} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ border: "1px solid var(--accent)", color: "var(--accent-ink)" }}>Use</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs" style={{ color: "var(--faint)" }}>Pick a formula and generate — each hook is scored on stop-power, curiosity, clarity, and brand-fit.</p>}
        </div>
      ) : null}

      {/* ENGINEER COPY */}
      {tab === "engineer" ? (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Psychological triggers</div>
            <div className="flex flex-wrap gap-1.5">{TRIGGERS.map((t) => <Chip key={t.key} active={triggers.includes(t.key)} onClick={() => toggle(triggers, setTriggers, t.key)} title={t.hint}>{t.label}</Chip>)}</div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Framework</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={framework === null} onClick={() => setFramework(null)}>None</Chip>
              {FRAMEWORKS.map((f) => <Chip key={f.key} active={framework === f.key} onClick={() => setFramework(f.key)} title={f.hint}>{f.label}</Chip>)}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>Engagement devices</div>
            <div className="flex flex-wrap gap-1.5">{DEVICES.map((d) => <Chip key={d.key} active={devices.includes(d.key)} onClick={() => toggle(devices, setDevices, d.key)} title={d.hint}>{d.label}</Chip>)}</div>
          </div>
          <label className="block text-xs"><span className="mb-1 block" style={{ color: "var(--muted)" }}>Extra tone / angle (optional)</span>
            <input value={tone} onChange={(e) => setTone(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></label>
          <button type="button" onClick={() => run(engineerCopyAction(item.id, { triggers, framework, devices, tone }))} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {pending ? "Engineering…" : "✦ Re-engineer the copy"}
          </button>
          <p className="text-xs" style={{ color: "var(--faint)" }}>Rewrites the three-tier copy above; the previous version is saved to History.</p>
        </div>
      ) : null}

      {/* VOICE CHECK */}
      {tab === "voice" ? (
        <div className="space-y-3">
          <button type="button" onClick={() => run(lintVoiceAction(item.id).then((r) => { if ("flags" in r) setFlags(r.flags); return r; }))} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {pending ? "Checking…" : "✦ Run brand-voice check"}
          </button>
          {(flags ?? item.voice_flags) ? (() => {
            const f = (flags ?? item.voice_flags)!;
            return (
              <div className="rounded-xl p-4" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-full text-lg font-bold text-white" style={{ background: f.score >= 80 ? "var(--good)" : f.score >= 60 ? "var(--accent)" : "var(--danger)" }}>{f.score}</span>
                  <div>
                    <div className="text-sm font-semibold">Voice score</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{f.issues.length === 0 ? "On-brand — no issues found." : `${f.issues.length} issue(s) to review.`}</div>
                  </div>
                </div>
                {f.issues.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {f.issues.map((iss, i) => (
                      <li key={i} className="text-xs"><span className="rounded px-1.5 py-0.5 font-semibold" style={{ background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>{iss.term}</span> <span style={{ color: "var(--muted)" }}>— {iss.why}</span></li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })() : <p className="text-xs" style={{ color: "var(--faint)" }}>Scores the copy against the brand&apos;s voice + never-use rules and flags anything off-brand.</p>}
        </div>
      ) : null}

      {/* PLATFORM VARIANTS */}
      {tab === "variants" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button key={p.key} type="button" onClick={() => run(generateVariantAction(item.id, p.key))} disabled={pending} title={p.hint} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>
                {variants.some((v) => v.platform === p.key) ? "↻ " : "＋ "}{p.label}
              </button>
            ))}
          </div>
          {variants.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--faint)" }}>Generate a native version for each platform — not a copy-paste.</p>
          ) : (
            <div className="space-y-2">
              {variants.map((v) => <VariantCard key={v.id} v={v} onSave={(body) => run(saveVariant(item.id, v.workspace_id, v.platform, body))} onDelete={() => run(deleteVariant(v.id, item.id))} pending={pending} />)}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function VariantCard({ v, onSave, onDelete, pending }: { v: ContentVariant; onSave: (body: string) => void; onDelete: () => void; pending: boolean }) {
  const [body, setBody] = useState(v.body);
  const dirty = body !== v.body;
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="pill scheduled capitalize">{v.platform}</span>
        <div className="ml-auto flex gap-2">
          {dirty ? <button type="button" onClick={() => onSave(body)} disabled={pending} className="text-xs font-semibold" style={{ color: "var(--good)" }}>Save</button> : null}
          <button type="button" onClick={() => navigator.clipboard?.writeText(body)} className="text-xs" style={{ color: "var(--muted)" }}>Copy</button>
          <button type="button" onClick={onDelete} disabled={pending} className="text-xs" style={{ color: "var(--faint)" }}>Delete</button>
        </div>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
    </div>
  );
}
