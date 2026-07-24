import { describe, it, expect } from "vitest";
import { decideFormat, OBJECTIVES, OBJECTIVE_LABELS } from "./strategy";

describe("format decision engine", () => {
  it("is deterministic: same inputs → same format (never by taste)", () => {
    const a = decideFormat("launch", "post");
    const b = decideFormat("launch", "post");
    expect(a.formatType).toBe(b.formatType);
    expect(a.dbFormat).toBe(b.dbFormat);
  });

  it("a reel medium yields a reel db format", () => {
    expect(decideFormat("educate", "reel").dbFormat).toBe("reel");
  });

  it("a post medium never yields a reel", () => {
    for (const o of Object.keys(OBJECTIVES) as (keyof typeof OBJECTIVES)[]) {
      expect(decideFormat(o, "post").dbFormat).not.toBe("reel");
    }
  });

  it("carries a human-readable rationale", () => {
    expect(decideFormat("urgency", "post").rationale.length).toBeGreaterThan(10);
  });

  it("every objective has a label", () => {
    for (const o of Object.keys(OBJECTIVES) as (keyof typeof OBJECTIVES)[]) {
      expect(OBJECTIVE_LABELS[o]).toBeTruthy();
    }
  });
});
