/**
 * Dead-letter queue for exhausted AI provider calls.
 *
 * When all retries for a provider are exhausted, the failing trace is recorded
 * here so it can be inspected via /api/ai/dead-letters (if the route is
 * mounted) or emitted to a monitoring sink in production.
 *
 * The in-process buffer is intentionally capped at MAX_ENTRIES so the server
 * does not accumulate unbounded state under sustained pressure.
 *
 * @module server/ai/resilience/deadLetter
 */

import { aiLogError } from "../telemetry/logger.js";

export interface DeadLetterEntry {
  traceId: string;
  error: unknown;
  context: Record<string, unknown>;
  enqueuedAt: string;
}

const MAX_ENTRIES = 500;

const queue: DeadLetterEntry[] = [];

/**
 * Record a failed trace in the dead-letter buffer.
 * Safe to call with `null` / `undefined` errors — they will be serialised
 * as-is without throwing.
 */
export function pushDeadLetter(
  traceId: string,
  error: unknown,
  context: Record<string, unknown> = {}
): void {
  const entry: DeadLetterEntry = {
    traceId,
    error,
    context,
    enqueuedAt: new Date().toISOString(),
  };

  if (queue.length >= MAX_ENTRIES) {
    queue.shift(); // drop oldest
  }
  queue.push(entry);

  aiLogError({
    traceId,
    event: "dead_letter_enqueued",
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    ...context,
  });
}

/** Return a snapshot of the current dead-letter queue (newest last). */
export function getDeadLetters(): readonly DeadLetterEntry[] {
  return queue;
}

/** Drain the queue (primarily for testing). */
export function clearDeadLetters(): void {
  queue.length = 0;
}
