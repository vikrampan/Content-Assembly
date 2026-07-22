"use client";

import { useState } from "react";

/** A small ⓘ toggle next to a field label — click to reveal a plain-language hint. */
export function InfoDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative ml-1 inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        aria-label="What's this field for?"
        className="inline-grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold leading-none transition"
        style={{ border: "1px solid var(--line-2)", color: open ? "var(--accent)" : "var(--faint)" }}
      >
        i
      </button>
      {open ? (
        <span
          className="absolute left-0 top-6 z-30 block w-56 rounded-lg px-3 py-2 text-[11px] font-normal normal-case leading-snug shadow-lg"
          style={{ background: "var(--ink)", color: "var(--panel)" }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
