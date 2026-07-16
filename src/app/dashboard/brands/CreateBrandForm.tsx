"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrand } from "./actions";

const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5";

function randomPassword() {
  const part = () => Math.random().toString(36).slice(2, 6);
  return `Br-${part()}-${part()}${Math.floor(Math.random() * 90 + 10)}`;
}

export function CreateBrandForm() {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState(randomPassword());
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ brand: string; email: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    startTransition(async () => {
      const res = await createBrand({ name, ownerName, ownerEmail, ownerPassword });
      if ("error" in res) {
        setError(res.error);
      } else {
        setCreated({ brand: name, email: ownerEmail, password: ownerPassword });
        setName(""); setOwnerName(""); setOwnerEmail(""); setOwnerPassword(randomPassword());
        router.refresh();
      }
    });
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
      <h2 className="text-sm font-semibold">Onboard a brand</h2>
      <p className="mb-3 mt-0.5 text-xs opacity-60">
        Creates the brand + the client owner&apos;s login. The Brand Designer fills in the brand book after.
      </p>
      <form onSubmit={submit} className="space-y-2.5">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" required />
        <input className={inputCls} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Client owner name" />
        <input className={inputCls} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="Client owner email" required />
        <div className="flex gap-2">
          <input className={inputCls} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Temp password" minLength={8} />
          <button type="button" onClick={() => setOwnerPassword(randomPassword())} className="shrink-0 rounded-lg border border-black/15 px-2 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">↻</button>
        </div>
        <button type="submit" disabled={pending || !name.trim() || !ownerEmail.trim()} className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50">
          {pending ? "Creating…" : "Create brand + client login"}
        </button>
      </form>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div>
      ) : null}
      {created ? (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="font-medium">✓ {created.brand} created — client login:</div>
          <div className="mt-1 font-mono">{created.email}</div>
          <div className="font-mono">{created.password}</div>
          <div className="mt-1 opacity-80">Share these with the client. The Brand Designer can now build the brand book.</div>
        </div>
      ) : null}
    </div>
  );
}
