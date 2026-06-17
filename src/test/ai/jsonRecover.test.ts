import { describe, it, expect } from "vitest";
import { safeParseJson, stripJsonFences, appendJsonRetryPrompt } from "../../ai/jsonRecover";

describe("jsonRecover", () => {
  it("strips markdown fences", () => {
    expect(stripJsonFences("```json\n{\"a\":1}\n```")).toBe('{"a":1}');
  });

  it("parses fenced JSON", () => {
    expect(safeParseJson("```json\n{\"rating\":8}\n```")).toEqual({ rating: 8 });
  });

  it("extracts object from surrounding text", () => {
    expect(safeParseJson("Here is data: {\"x\": true} thanks")).toEqual({ x: true });
  });

  it("appends retry prompt", () => {
    expect(appendJsonRetryPrompt("hello")).toContain("CRITICAL");
    expect(appendJsonRetryPrompt("hello")).toContain("hello");
  });
});
