"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QaGroup } from "@/lib/types";
import { saveQaChecklist, sendBackFromQa, submitForClientReview } from "./actions";

const REJECT_REASONS = [
  "Off-brand voice",
  "Wrong colours / logo",
  "Typo / grammar",
  "Unsupported claim",
  "Low-res / crop",
  "Missing CTA",
  "Wrong format",
  "Factual error",
];

export function QaFirewall({
  contentId,
  stage,
  initial,
  initialNotes,
  checklist,
  brandFirewall,
}: {
  contentId: string;
  stage: string;
  initial: Record<string, boolean> | null;
  initialNotes: Record<string, string> | null;
  checklist: QaGroup[];
  brandFirewall: boolean;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(initial ?? {});
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes ?? {});
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [rejectNote, setRejectNote] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const total = useMemo(() => checklist.reduce((n, g) => n + g.checks.length, 0), [checklist]);
  const passed = useMemo(
    () => checklist.flatMap((g) => g.checks).filter((c) => checks[c.key] === true).length,
    [checks, checklist],
  );
  const allPass = passed === total && total > 0;
  const onQaStage = stage === "qa";
  const canSubmit = allPass && onQaStage;
  const alreadyShipped = !onQaStage;

  const toggle = (key: string) => setChecks((c) => ({ ...c, [key]: !c[key] }));
  const toggleReason = (r: string) => setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveQaChecklist(contentId, checks, notes);
      setFeedback("error" in res ? { kind: "err", text: res.error } : { kind: "ok", text: "Progress saved." });
    });
  }

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      await saveQaChecklist(contentId, checks, notes);
      const res = await submitForClientReview(contentId, checks);
      if ("error" in res) setFeedback({ kind: "err", text: res.error });
      else { setFeedback({ kind: "ok", text: res.message ?? "Submitted." }); router.refresh(); }
    });
  }

  function reject() {
    setFeedback(null);
    startTransition(async () => {
      const res = await sendBackFromQa(contentId, reasons, rejectNote);
      if ("error" in res) setFeedback({ kind: "err", text: res.error });
      else { setFeedback({ kind: "ok", text: res.message ?? "Sent back." }); router.refresh(); }
    });
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">QA Brand Firewall</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Check the post against the brand book below. Nothing ships until every check passes.
          </p>
        </div>
        <span className={`pill ${allPass ? "approved" : "pending"}`}>{passed}/{total} passed</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {checklist.map((group) => (
          <div key={group.group}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{group.group}</div>
            <div className="space-y-1">
              {group.checks.map((c) => (
                <div key={c.key} className="rounded-lg px-2 py-1.5 transition" style={{ background: notes[c.key] ? "var(--panel-2)" : "transparent" }}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checks[c.key] === true}
                      onChange={() => toggle(c.key)}
                      disabled={alreadyShipped}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--good)]"
                    />
                    <span className="flex-1 text-xs">
                      <span className="font-medium">{c.label}</span>
                      <span className="block" style={{ color: "var(--muted)" }}>{c.detail}</span>
                    </span>
                    {!alreadyShipped ? (
                      <button
                        type="button"
                        onClick={() => setOpenNote((k) => (k === c.key ? null : c.key))}
                        className="shrink-0 text-[11px]"
                        style={{ color: notes[c.key] ? "var(--accent-ink)" : "var(--faint)" }}
                        title="Add evidence / note"
                      >
                        {notes[c.key] ? "✎" : "＋note"}
                      </button>
                    ) : null}
                  </div>
                  {(openNote === c.key || (alreadyShipped && notes[c.key])) ? (
                    <input
                      value={notes[c.key] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [c.key]: e.target.value }))}
                      disabled={alreadyShipped}
                      placeholder="Evidence / note for this check…"
                      className="mt-1.5 w-full rounded-md px-2 py-1 text-[11px] outline-none"
                      style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {feedback ? (
        <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={feedback.kind === "ok"
          ? { background: "var(--good-soft)", color: "var(--good)" }
          : { background: "rgba(192,85,63,.12)", color: "var(--danger)" }}>
          {feedback.text}
        </div>
      ) : null}

      {alreadyShipped ? (
        <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
          The QA firewall runs when a card is on the QA stage. This card is currently on the &ldquo;{stage.replace(/_/g, " ")}&rdquo; stage.
        </p>
      ) : rejecting ? (
        <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(192,85,63,.07)", border: "1px solid var(--line-2)" }}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--danger)" }}>Send back to Production — why?</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => toggleReason(r)} className="rounded-full px-2.5 py-1 text-xs font-medium transition"
                style={reasons.includes(r) ? { background: "var(--danger)", color: "#fff" } : { background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>
                {r}
              </button>
            ))}
          </div>
          <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={2} placeholder="Add specifics for the desk…" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={reject} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--danger)" }}>Send back</button>
            <button type="button" onClick={() => setRejecting(false)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={pending} className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Save progress</button>
          <button type="button" onClick={submit} disabled={pending || !canSubmit} title={canSubmit ? undefined : "All 16 checks must pass first"} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-40" style={{ background: "var(--good)" }}>Pass → client review</button>
          <button type="button" onClick={() => setRejecting(true)} disabled={pending} className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50" style={{ border: "1px solid var(--line-2)", color: "var(--danger)" }}>Fail / send back</button>
          {!allPass ? <span className="text-xs" style={{ color: "var(--muted)" }}>{total - passed} left</span> : null}
        </div>
      )}
    </section>
  );
}
