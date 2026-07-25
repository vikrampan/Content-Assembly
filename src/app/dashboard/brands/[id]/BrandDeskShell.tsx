"use client";

import { useState } from "react";
import type { BrandBookVersion, Workspace } from "@/lib/types";
import { BrandLockBar } from "./BrandLockBar";
import { BrandPreview } from "./BrandPreview";
import { BrandKit, type BrandAssetView } from "./BrandKit";
import { BrandBookForm } from "./BrandBookForm";
import { BrandBookSections } from "./BrandBookSections";
import { BrandImport } from "./BrandImport";
import { BrandHistory } from "./BrandHistory";
import { ClientTeamCard, type ClientMember } from "./ClientTeamCard";

type Tab = "overview" | "import" | "visual" | "dna" | "story" | "team" | "history";

export function BrandDeskShell({
  brand, kit, versions, clientMembers, isAdmin, score, fontFaces, logoUrl,
}: {
  brand: Workspace;
  kit: BrandAssetView[];
  versions: BrandBookVersion[];
  clientMembers: ClientMember[];
  isAdmin: boolean;
  score: { filled: number; total: number };
  fontFaces: string[];
  logoUrl: string | null;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  const ALL: { k: Tab; label: string; show: boolean }[] = [
    { k: "overview", label: "Overview", show: true },
    { k: "import", label: "✦ AI Import", show: true },
    { k: "visual", label: "Visual Kit", show: true },
    { k: "dna", label: "Brand DNA", show: true },
    { k: "story", label: "Story & Voice", show: true },
    { k: "team", label: "Client Team", show: isAdmin },
    { k: "history", label: `History${versions.length ? ` (${versions.length})` : ""}`, show: versions.length > 0 },
  ];
  const TABS = ALL.filter((t) => t.show);

  return (
    <div className="space-y-5">
      {/* Lock bar always visible — the completeness + gate */}
      <BrandLockBar workspaceId={brand.id} status={brand.brand_status} lockedAt={brand.locked_at} filled={score.filled} total={score.total} />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)} className="rounded-lg px-3.5 py-2 text-sm font-medium transition"
            style={tab === t.k ? { background: "var(--accent)", color: "#fff" } : { background: "var(--panel-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      {tab === "overview" ? <BrandPreview brand={brand} logoUrl={logoUrl} fontFaces={fontFaces} /> : null}
      {tab === "import" ? <BrandImport workspaceId={brand.id} /> : null}
      {tab === "visual" ? <BrandKit brand={brand} assets={kit} /> : null}
      {tab === "dna" ? <BrandBookForm brand={brand} /> : null}
      {tab === "story" ? <BrandBookSections workspaceId={brand.id} initial={brand.brand_book ?? {}} /> : null}
      {tab === "team" && isAdmin ? <ClientTeamCard workspaceId={brand.id} members={clientMembers} /> : null}
      {tab === "history" ? <BrandHistory versions={versions} /> : null}
    </div>
  );
}
