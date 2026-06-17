/**
 * Retry policy for JSON parse failures on generate requests.
 * @module src/ai/retryPolicy
 */

/** Maximum attempts for JSON parse recovery (matches legacy client). */
export const MAX_JSON_PARSE_ATTEMPTS = 2;

/**
 * Returns whether another JSON parse retry should run.
 */
export function shouldRetryJsonParse(attempt: number, maxAttempts = MAX_JSON_PARSE_ATTEMPTS): boolean {
  return attempt < maxAttempts;
}

/**
 * Exponential backoff delay before a JSON retry (ms).
 * @param attempt - 1-based attempt after failure
 */
export function jsonRetryBackoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 4000);
}

/**
 * Waits for backoff unless the signal is already aborted.
 */
export async function waitForJsonRetry(attempt: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted", "AbortError");
  }
  const delay = jsonRetryBackoffMs(attempt);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delay);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("The operation was aborted", "AbortError"));
      };
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new DOMException("The operation was aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/**
 * Returns true if the error is safe to retry (JSON path only).
 */
export function isRetrySafeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return false;
  if (typeof error === "object" && error !== null && (error as { name?: string }).name === "AbortError") {
    return false;
  }
  return true;
}
