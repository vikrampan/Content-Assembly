// ===========================================================================
// The unified pipeline. A card's `stage` is the single source of truth for
// WHERE it is — it drives the admin board columns, each desk's inbox, the QA
// gate, and client visibility. One model, no conflicts.
// ===========================================================================

export interface Stage {
  key: string;
  label: string;
  /** The desk that holds a card at this stage (null = admin or client). */
  holder: "admin" | "content" | "production" | "qa" | "client" | "social" | null;
}

export const STAGES: Stage[] = [
  { key: "planning", label: "Planning", holder: "admin" },
  { key: "content", label: "Content", holder: "content" },
  { key: "production", label: "Production", holder: "production" },
  { key: "qa", label: "QA", holder: "qa" },
  { key: "client_review", label: "Client review", holder: "client" },
  { key: "scheduling", label: "Scheduling", holder: "social" },
  { key: "published", label: "Published", holder: null },
];

export const STAGE_KEYS = STAGES.map((s) => s.key);
export const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
);

// Which departments work each stage's inbox.
const DEPT_STAGE: Record<string, string> = {
  content: "content",
  design: "production",
  video: "production",
  image: "production",
  audio: "production",
  qa: "qa",
  social: "scheduling",
};

/** The stage whose inbox this department sees (null = no post-pipeline inbox). */
export function deskStage(dept: string | null | undefined): string | null {
  return dept ? DEPT_STAGE[dept] ?? null : null;
}

export function nextStage(stage: string): string | null {
  const i = STAGE_KEYS.indexOf(stage);
  return i >= 0 && i < STAGE_KEYS.length - 1 ? STAGE_KEYS[i + 1] : null;
}
export function prevStage(stage: string): string | null {
  const i = STAGE_KEYS.indexOf(stage);
  return i > 0 ? STAGE_KEYS[i - 1] : null;
}
export function isValidStage(stage: string): boolean {
  return STAGE_KEYS.includes(stage);
}
