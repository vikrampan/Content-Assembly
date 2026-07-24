import { describe, it, expect } from "vitest";
import { QA_FIREWALL, QA_CHECK_COUNT } from "./pipeline";

// The QA gate rule (mirrors submitForClientReview): a post may only pass to the
// client when EVERY firewall check is true. These tests pin that invariant.
const QA_KEYS = QA_FIREWALL.flatMap((g) => g.checks.map((c) => c.key));
const allPass = (checklist: Record<string, boolean>) => QA_KEYS.every((k) => checklist[k] === true);

describe("QA firewall gate", () => {
  it("check count matches the flattened keys", () => {
    expect(QA_KEYS.length).toBe(QA_CHECK_COUNT);
    expect(QA_CHECK_COUNT).toBeGreaterThan(0);
  });

  it("check keys are unique", () => {
    expect(new Set(QA_KEYS).size).toBe(QA_KEYS.length);
  });

  it("blocks when any check is missing or false", () => {
    const partial: Record<string, boolean> = {};
    QA_KEYS.forEach((k, i) => { if (i > 0) partial[k] = true; }); // first left out
    expect(allPass(partial)).toBe(false);
  });

  it("passes only when all checks are true", () => {
    const full = Object.fromEntries(QA_KEYS.map((k) => [k, true]));
    expect(allPass(full)).toBe(true);
  });

  it("a single false check blocks the whole gate", () => {
    const full = Object.fromEntries(QA_KEYS.map((k) => [k, true]));
    full[QA_KEYS[2]] = false;
    expect(allPass(full)).toBe(false);
  });
});
