// Pure client-facing stage helpers (no server imports — safe in client components).
export const CLIENT_STEPS = ["Planned", "In production", "Quality check", "Ready for you", "Scheduled", "Live"];
const STAGE_STEP: Record<string, number> = { planning: 0, content: 1, production: 1, qa: 2, client_review: 3, scheduling: 4, published: 5 };
export const stageStep = (s: string) => STAGE_STEP[s] ?? 0;
export const stageLabel = (s: string) => CLIENT_STEPS[stageStep(s)];
