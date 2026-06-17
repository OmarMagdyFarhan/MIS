import { describe, it, expect } from "vitest";
import { createTraceId, withTraceHeader } from "../../ai/trace";

describe("trace", () => {
  it("creates a non-empty trace id", () => {
    const id = createTraceId();
    expect(id.length).toBeGreaterThan(0);
  });

  it("adds X-Neural-Trace header", () => {
    const headers = withTraceHeader({ "Content-Type": "application/json" }, "abcd1234");
    expect((headers as Record<string, string>)["X-Neural-Trace"]).toBe("abcd1234");
  });
});
