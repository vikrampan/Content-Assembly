"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrand } from "./actions";

export function CreateBrandForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createBrand({ name });
      if ("error" in res) setError(res.error);
      else router.push(`/dashboard/brands/${res.id}`); // straight to the editor
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="text-xs">
        <span className="mb-1 block opacity-70">New brand</span>
        <input
          className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Brand name"
        />
      </label>
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create & edit book"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </form>
  );
}
