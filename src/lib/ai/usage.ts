// AI cost + budget helpers. Prices per 1M tokens (USD).
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

export function estimateCost(model: string, inTok: number, outTok: number): number {
  const p = PRICES[model] ?? PRICES["claude-opus-4-8"];
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
}

/** First day of the current month, ISO — the metering window. */
export function monthStartISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
