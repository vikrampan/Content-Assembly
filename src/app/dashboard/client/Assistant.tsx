"use client";

// The one client AI — a single, context-aware ✦ assistant that both ANSWERS
// (concierge Q&A, week digest, insights) and ACTS (proposes brand-book changes
// you apply in-chat). Every page routes into this; nothing else runs AI.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { aiConcierge, aiHomeDigest, aiInsightsSummary, aiBrandBookDraft, type BrandChange } from "../aiClient";
import { applyBrandPatch } from "../brands/actions";
import { useOnline } from "@/components/ui/Network";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/States";
import type { BudgetStatus } from "@/lib/ai/clientAssist";

type Mode = "qa" | "digest" | "insights" | "brand";
interface Item extends BrandChange { on: boolean }
type MsgBody =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "proposal"; note: string; items: Item[]; applied: boolean };
type Msg = MsgBody & { id: number };

interface Chip { label: string; mode: Mode; prompt?: string }

function contextFor(path: string): { free: Mode; hint: string; chips: Chip[] } {
  if (path.includes("/brand-book")) return {
    free: "brand", hint: "Tell me what to fill or change in your brand book.",
    chips: [
      { label: "Fill in what's empty", mode: "brand", prompt: "Fill in anything that's empty" },
      { label: "Improve my voice", mode: "brand", prompt: "Improve my brand voice" },
      { label: "Write my mission & tagline", mode: "brand", prompt: "Write my mission and a tagline" },
    ],
  };
  if (path.includes("/insights")) return {
    free: "qa", hint: "Ask about your performance.",
    chips: [
      { label: "Explain my results", mode: "insights" },
      { label: "What should we do more of?", mode: "qa", prompt: "Based on my analytics, what should we do more of next month?" },
    ],
  };
  if (path.includes("/approvals") || path.includes("/plan")) return {
    free: "qa", hint: "Ask about what's coming up.",
    chips: [
      { label: "What's coming up?", mode: "qa", prompt: "What's coming up this week?" },
      { label: "How are my posts doing?", mode: "qa", prompt: "How are my posts doing?" },
    ],
  };
  // Home + everything else
  return {
    free: "qa", hint: "Ask me anything about your brand or posts.",
    chips: [
      { label: "Summarize my week", mode: "digest" },
      { label: "What needs me?", mode: "qa", prompt: "What needs my attention right now?" },
      { label: "What's coming up?", mode: "qa", prompt: "What's coming up this week?" },
    ],
  };
}

export function Assistant({ workspaceId, brandName }: { workspaceId: string; brandName: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [pending, start] = useTransition();
  const [, startApply] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const online = useOnline();
  const toast = useToast();
  const router = useRouter();
  const ctx = contextFor(usePathname() ?? "");

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, pending]);

  const add = useCallback((m: MsgBody) => setMsgs((cur) => [...cur, { ...m, id: ++seq.current }]), []);

  const send = useCallback((text: string, mode: Mode) => {
    const q = text.trim();
    if (!q || pending) return;
    add({ role: "user", text: q });
    setInput("");
    if (!online) { add({ role: "assistant", text: "📡 You're offline right now — reconnect and I'll pick right back up." }); return; }

    const history = msgs.filter((m): m is Extract<Msg, { role: "user" | "assistant" }> => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, text: m.text }));

    start(async () => {
      try {
        if (mode === "digest") {
          const r = await aiHomeDigest(); setBudget(r.budget ?? null); add({ role: "assistant", text: r.text ?? r.error ?? "…" });
        } else if (mode === "insights") {
          const r = await aiInsightsSummary(); setBudget(r.budget ?? null); add({ role: "assistant", text: r.text ?? r.error ?? "…" });
        } else if (mode === "brand") {
          const r = await aiBrandBookDraft(q); setBudget(r.budget ?? null);
          if (r.changes?.length) add({ role: "proposal", note: r.note ?? "Here's what I'd suggest:", items: r.changes.map((c) => ({ ...c, on: true })), applied: false });
          else add({ role: "assistant", text: r.error ?? r.text ?? "I couldn't find anything to change." });
        } else {
          const r = await aiConcierge(q, history); setBudget(r.budget ?? null); add({ role: "assistant", text: r.text ?? r.error ?? "…" });
        }
      } catch {
        add({ role: "assistant", text: "Something went wrong reaching me. Please try again in a moment." });
      }
    });
  }, [pending, online, msgs, add]);

  // Let any page open the assistant + optionally fire a prompt.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<{ prompt?: string; mode?: Mode }>).detail;
      setOpen(true);
      if (d?.prompt) setTimeout(() => sendRef.current(d.prompt!, d.mode ?? "qa"), 60);
    };
    window.addEventListener("assistant:open", handler);
    return () => window.removeEventListener("assistant:open", handler);
  }, []);

  function toggleItem(msgId: number, i: number) {
    setMsgs((cur) => cur.map((m) => (m.id === msgId && m.role === "proposal" ? { ...m, items: m.items.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) } : m)));
  }
  function applyProposal(msgId: number) {
    const m = msgs.find((x) => x.id === msgId);
    if (!m || m.role !== "proposal") return;
    const chosen = m.items.filter((x) => x.on);
    if (chosen.length === 0) return;
    startApply(async () => {
      const res = await applyBrandPatch(workspaceId, chosen.map((c) => ({ path: c.path, value: c.value })));
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(`Applied ${chosen.length} change${chosen.length > 1 ? "s" : ""} ✓`);
      setMsgs((cur) => cur.map((x) => (x.id === msgId && x.role === "proposal" ? { ...x, applied: true } : x)));
      add({ role: "assistant", text: "Done — updated everywhere your content is made. ✓" });
      router.refresh();
    });
  }

  const budgetPct = budget && budget.limit ? Math.min(100, Math.round((budget.used / budget.limit) * 100)) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Ask AI" data-tour="assistant"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105"
        style={{ background: "var(--accent)", boxShadow: "0 8px 30px rgba(45,32,20,.35)" }}>
        <span className="text-xl">{open ? "✕" : "✦"}</span>
      </button>

      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[600px] sm:max-h-[82vh] sm:w-[400px]" style={{ maxHeight: "88vh" }}>
          <div className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-none sm:rounded-2xl">
            {/* Header */}
            <div className="border-b p-4" style={{ borderColor: "var(--line)", background: "linear-gradient(120deg, var(--accent-soft), transparent)" }}>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: "var(--accent)" }}>✦</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{brandName} assistant</div>
                  <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>{ctx.hint}</div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="text-lg sm:hidden" style={{ color: "var(--faint)" }}>✕</button>
              </div>
              {budgetPct !== null ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--panel)" }}>
                    <div className="h-full rounded-full" style={{ width: `${budgetPct}%`, background: budgetPct > 85 ? "var(--danger)" : "var(--accent)" }} />
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--faint)" }}>{budgetPct}% of monthly AI used</span>
                </div>
              ) : null}
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: "var(--muted)" }}>Hi 👋 I&apos;m your brand assistant — I can answer questions and make changes for you. Try:</p>
                  <div className="flex flex-wrap gap-2">
                    {ctx.chips.map((c) => (
                      <button key={c.label} type="button" onClick={() => send(c.prompt ?? c.label, c.mode)}
                        className="rounded-full px-3 py-1.5 text-xs font-medium transition hover:brightness-95" style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>{c.label}</button>
                    ))}
                  </div>
                </div>
              ) : null}

              {msgs.map((m) => {
                if (m.role === "proposal") {
                  const chosen = m.items.filter((x) => x.on).length;
                  return (
                    <div key={m.id} className="rounded-2xl p-3" style={{ background: "var(--panel-2)", borderBottomLeftRadius: 4 }}>
                      <div className="mb-2 text-sm">{m.note}</div>
                      <div className="space-y-1.5">
                        {m.items.map((it, i) => (
                          <label key={i} className="flex cursor-pointer gap-2 rounded-lg p-2" style={{ background: it.on ? "var(--accent-soft)" : "var(--panel)", border: `1px solid ${it.on ? "var(--accent)" : "var(--line)"}`, opacity: m.applied ? 0.7 : 1 }}>
                            <input type="checkbox" checked={it.on} disabled={m.applied} onChange={() => toggleItem(m.id, i)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--accent-ink)" }}>{it.label}</div>
                              <div className="whitespace-pre-wrap text-xs">{it.value}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                      {m.applied ? (
                        <div className="mt-2 text-xs font-semibold" style={{ color: "var(--good)" }}>Applied ✓</div>
                      ) : (
                        <button type="button" onClick={() => applyProposal(m.id)} disabled={chosen === 0}
                          className="mt-2.5 w-full rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--good)" }}>
                          Apply {chosen} change{chosen === 1 ? "" : "s"}
                        </button>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
                      style={m.role === "user" ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 } : { background: "var(--panel-2)", color: "var(--ink)", borderBottomLeftRadius: 4 }}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
              {pending ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-3.5 py-2.5" style={{ background: "var(--panel-2)" }}>
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--faint)" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--faint)", animationDelay: "120ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--faint)", animationDelay: "240ms" }} />
                    </span>
                  </div>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            <form onSubmit={(e) => { e.preventDefault(); send(input, ctx.free); }} className="flex items-center gap-2 border-t p-3" style={{ borderColor: "var(--line)" }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={ctx.free === "brand" ? "Tell me what to fill or change…" : "Ask about your brand…"}
                className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }} />
              <button type="submit" disabled={pending || !input.trim()} className="shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50" style={{ background: "var(--accent)" }}>
                {pending ? <Spinner size={14} color="#fff" /> : "Send"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
