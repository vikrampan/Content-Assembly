"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QA_FIREWALL, QA_CHECK_COUNT } from "@/lib/mendly/pipeline";
import type { ContentStatus } from "@/lib/types";
import { saveQaChecklist, submitForClientReview } from "./actions";

const SUBMITTABLE: ContentStatus[] = ["assembly", "admin_review", "changes_requested"];

export function QaFirewall({
  contentId,
  status,
  initial,
}: {
  contentId: string;
  status: ContentStatus;
  initial: Record<string, boolean> | null;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(initial ?? {});
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const passed = useMemo(
    () => QA_FIREWALL.flatMap((g) => g.checks).filter((c) => checks[c.key] === true).length,
    [checks],
  );
  const allPass = passed === QA_CHECK_COUNT;
  const canSubmit = allPass && SUBMITTABLE.includes(status);
  const alreadyShipped = !SUBMITTABLE.includes(status);

  const toggle = (key: string) =>
    setChecks((c) => ({ ...c, [key]: !c[key] }));

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveQaChecklist(contentId, checks);
      setFeedback("error" in res ? { kind: "err", text: res.error } : { kind: "ok", text: "Progress saved." });
    });
  }

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const res = await submitForClientReview(contentId, checks);
      if ("error" in res) setFeedback({ kind: "err", text: res.error });
      else {
        setFeedback({ kind: "ok", text: res.message ?? "Submitted." });
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">QA Brand Firewall</h2>
          <p className="text-xs opacity-60">Nothing ships until every check passes.</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            allPass
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
          }`}
        >
          {passed}/{QA_CHECK_COUNT} passed
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {QA_FIREWALL.map((group) => (
          <div key={group.group}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-55">
              {group.group}
            </div>
            <div className="space-y-1">
              {group.checks.map((c) => (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                >
                  <input
                    type="checkbox"
                    checked={checks[c.key] === true}
                    onChange={() => toggle(c.key)}
                    disabled={alreadyShipped}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                  />
                  <span className="text-xs">
                    <span className="font-medium">{c.label}</span>
                    <span className="block opacity-55">{c.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
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

      {alreadyShipped ? (
        <p className="mt-3 text-xs opacity-55">
          This item has already passed the firewall (stage: {status.replace(/_/g, " ")}).
        </p>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm transition hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
          >
            Save progress
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !canSubmit}
            title={canSubmit ? undefined : "All 16 checks must pass first"}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            Submit for client review
          </button>
          {!allPass ? (
            <span className="text-xs opacity-55">{QA_CHECK_COUNT - passed} check(s) left</span>
          ) : null}
        </div>
      )}
    </section>
  );
}
