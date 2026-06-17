/**
 * Exponential backoff with jitter for retriable provider errors.
 * @module server/ai/resilience/backoff
 */

/** Maximum retry attempts per model in the Gemini provider loop. */
export const MAX_RETRIES = 3;

/**
 * Waits with exponential backoff and random jitter.
 * @param attempt - 1-based attempt number
 */
export async function backoff(attempt: number): Promise<void> {
  const base = Math.pow(2, attempt) * 1000;
  const jitter = Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, base + jitter));
}
