import { describe, it, expect } from "vitest";
import {
  AITimeoutError,
  AIJSONParseError,
  normalizeClientAIError,
  errorFromHttpResponse,
} from "../../ai/errors";

describe("client AI errors", () => {
  it("maps 429 to AIRateLimitError", () => {
    const err = errorFromHttpResponse(429, "Too many requests", "abc123");
    expect(err.code).toBe("RATE_LIMIT");
    expect(err.traceId).toBe("abc123");
  });

  it("normalizes timeout message", () => {
    const err = normalizeClientAIError(
      new Error("Neural core synthesis deadline exceeded (95s)."),
      "t1"
    );
    expect(err).toBeInstanceOf(AITimeoutError);
  });

  it("normalizes JSON schema failure", () => {
    const err = normalizeClientAIError(
      new Error("Neural core failed to produce valid strategic schema."),
      "t2"
    );
    expect(err).toBeInstanceOf(AIJSONParseError);
  });
});
