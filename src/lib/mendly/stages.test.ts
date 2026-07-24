import { describe, it, expect } from "vitest";
import { STAGES, STAGE_KEYS, nextStage, prevStage, deskStage, isValidStage } from "./stages";

describe("pipeline stages", () => {
  it("has the expected ordered stages", () => {
    expect(STAGE_KEYS).toEqual(["planning", "content", "production", "qa", "client_review", "scheduling", "published"]);
  });

  it("advances to the next stage in order", () => {
    expect(nextStage("planning")).toBe("content");
    expect(nextStage("qa")).toBe("client_review");
    expect(nextStage("published")).toBeNull(); // terminal
  });

  it("steps back a stage", () => {
    expect(prevStage("content")).toBe("planning");
    expect(prevStage("planning")).toBeNull(); // first
  });

  it("validates stage keys", () => {
    expect(isValidStage("qa")).toBe(true);
    expect(isValidStage("nonsense")).toBe(false);
  });

  it("maps a desk/department to the stage it holds", () => {
    expect(deskStage("content")).toBe("content");
    expect(deskStage("design")).toBe("production");
    expect(deskStage("video")).toBe("production");
    expect(deskStage("qa")).toBe("qa");
    expect(deskStage("social")).toBe("scheduling");
    expect(deskStage(null)).toBeNull();
  });

  it("every stage has a holder or is terminal", () => {
    const terminal = STAGES[STAGES.length - 1];
    expect(terminal.key).toBe("published");
    expect(terminal.holder).toBeNull();
  });
});
