import { describe, it, expect } from "vitest";
import {
  MAX_JSON_PARSE_ATTEMPTS,
  shouldRetryJsonParse,
  isRetrySafeError,
} from "../../ai/retryPolicy";

describe("retryPolicy", () => {
  it("allows up to MAX_JSON_PARSE_ATTEMPTS", () => {
    expect(shouldRetryJsonParse(0, MAX_JSON_PARSE_ATTEMPTS)).toBe(true);
    expect(shouldRetryJsonParse(1, MAX_JSON_PARSE_ATTEMPTS)).toBe(true);
    expect(shouldRetryJsonParse(2, MAX_JSON_PARSE_ATTEMPTS)).toBe(false);
  });

  it("does not retry AbortError", () => {
    const err = new DOMException("aborted", "AbortError");
    expect(isRetrySafeError(err)).toBe(false);
  });
});
