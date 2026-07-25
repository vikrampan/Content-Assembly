"use client";

import { useEffect, useState } from "react";

const KEY = "mendly_client_tour_v1";

interface Step { icon: string; title: string; body: string }

function steps(brand: string): Step[] {
  return [
    { icon: "👋", title: `Welcome to ${brand}`, body: "This is your brand portal — approvals, your content calendar, performance, and your brand book, all in one place. Here's the 30-second tour." },
    { icon: "✅", title: "Approve your posts", body: "When the team finishes a post, it lands in Approvals. Give it a thumbs-up or request a change in a click — the team sees it instantly." },
    { icon: "🗓️", title: "See your whole month", body: "The Calendar shows every planned post. You can leave a note on any of them if you'd like a tweak before it's made." },
    { icon: "📈", title: "Know what's working", body: "Analytics shows how your posts perform. Tap “Explain my results” and AI turns the numbers into plain English — and what to do next." },
    { icon: "🎨", title: "Your brand book, editable", body: "View and edit your colours, voice, and rules anytime. Any change applies everywhere your content is made — instantly." },
    { icon: "✦", title: "Ask the assistant anything", body: "See the ✦ button in the corner? That's your brand assistant. Ask “what's coming up?” or “how are my posts doing?” — it knows your account." },
  ];
}

export function ClientTour({ brandName }: { brandName: string }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const list = steps(brandName);

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* ignore */ }
  }, []);

  function close() {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  }

  if (!open) return null;
  const step = list[i];
  const last = i === list.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" style={{ background: "rgba(20,14,8,.55)", backdropFilter: "blur(3px)" }}>
      <div className="card w-full max-w-md overflow-hidden">
        <div className="h-1.5" style={{ background: "var(--accent)" }} />
        <div className="p-6">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl text-3xl" style={{ background: "var(--accent-soft)" }}>{step.icon}</div>
          <h2 className="text-xl font-bold" style={{ letterSpacing: "-.01em" }}>{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{step.body}</p>

          {/* Progress dots */}
          <div className="mt-5 flex items-center gap-1.5">
            {list.map((_, k) => (
              <span key={k} className="h-1.5 rounded-full transition-all" style={{ width: k === i ? 20 : 6, background: k === i ? "var(--accent)" : "var(--line-2)" }} />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={close} className="text-sm font-medium" style={{ color: "var(--faint)" }}>Skip</button>
            <div className="flex gap-2">
              {i > 0 ? (
                <button type="button" onClick={() => setI((n) => n - 1)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}>Back</button>
              ) : null}
              <button type="button" onClick={() => (last ? close() : setI((n) => n + 1))}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition hover:brightness-105" style={{ background: "var(--accent)" }}>
                {last ? "Get started" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
