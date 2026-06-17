/**
 * Per-client and global concurrency tracking for generate requests.
 * @module server/ai/resilience/concurrency
 */

/** Maximum in-flight generate operations globally. */
export const MAX_GLOBAL_CONCURRENCY = 50;

/** Maximum in-flight generate operations per client session. */
export const MAX_PER_CLIENT_CONCURRENCY = 5;

const clientConcurrency = new Map<string, number>();

/**
 * Returns current concurrency for a client (before increment).
 */
export function getClientConcurrency(clientId: string): number {
  return clientConcurrency.get(clientId) || 0;
}

/**
 * Adjusts tracked concurrency for a client by delta (+1 acquire, -1 release).
 */
export function updateConcurrency(clientId: string, delta: number): number {
  const current = clientConcurrency.get(clientId) || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) clientConcurrency.delete(clientId);
  else clientConcurrency.set(clientId, next);
  return next;
}
