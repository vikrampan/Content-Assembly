import type { ContentStatus } from "@/lib/types";

// The Mendly departments — each is a desk in the pipeline with its own portal,
// AI persona(s), and (where it maps to production) a live queue of work.
export interface Department {
  key: string;
  label: string;
  blurb: string;
  stage: string;
  /** content_items statuses this desk actively works on (its queue). */
  statuses: ContentStatus[];
  /** An existing tool this desk uses instead of a content queue. */
  toolHref?: string;
  toolLabel?: string;
}

export const DEPARTMENTS: Department[] = [
  { key: "brand", label: "Brand Designer", blurb: "Locks the brand book — the identity every desk obeys.", stage: "Stage 01",
    statuses: [], toolHref: "/dashboard/brands", toolLabel: "Open Brand Books" },
  { key: "capture", label: "Capture", blurb: "Directs the on-site shoot from the brand's photography style.", stage: "Stage 02",
    statuses: [], toolHref: "/dashboard/library", toolLabel: "Open Media Library" },
  { key: "strategy", label: "Strategy", blurb: "Plans the month, then locks content & format for each post.", stage: "Stage 04 · Hub",
    statuses: ["ideation", "research"], toolHref: "/dashboard/strategy", toolLabel: "Open Strategy Desk" },
  { key: "content", label: "Content", blurb: "Decides the angle and writes the copy — the live AI desk.", stage: "Stage 05",
    statuses: ["copywriting"], toolHref: "/dashboard/strategy", toolLabel: "Open Strategy Desk" },
  { key: "design", label: "Design", blurb: "Builds posts & carousels on the brand grid.", stage: "Stage 05",
    statuses: ["visuals", "assembly"] },
  { key: "video", label: "Video / Editing", blurb: "Cuts reels engineered for retention.", stage: "Stage 05",
    statuses: ["visuals", "assembly"] },
  { key: "image", label: "Image Generation", blurb: "On-brand generated visuals (AI desk — coming).", stage: "Stage 05",
    statuses: [] },
  { key: "audio", label: "Audio", blurb: "ASMR isolation & sound design (coming).", stage: "Stage 03",
    statuses: [] },
  { key: "qa", label: "QA", blurb: "The brand firewall — nothing ships until it passes.", stage: "Stage 06",
    statuses: ["admin_review"] },
  { key: "social", label: "Social", blurb: "Publishing timing, stories, and the 60-minute reply sprint.", stage: "Stage 08",
    statuses: ["approved", "scheduled", "published"] },
];

export const DEPARTMENT_LABELS: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.key, d.label]),
);

export function getDepartment(key: string | null | undefined): Department | undefined {
  return DEPARTMENTS.find((d) => d.key === key);
}
