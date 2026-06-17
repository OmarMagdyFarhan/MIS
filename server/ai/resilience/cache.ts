/**
 * In-memory response cache and in-flight request deduplication.
 * @module server/ai/resilience/cache
 */

import crypto from "crypto";

/** Cache entry TTL (1 hour). */
export const CACHE_TTL = 1000 * 60 * 60;

/** Maximum number of cache entries before forced eviction of oldest entries. */
export const MAX_CACHE_ENTRIES = 500;

interface CachedItem {
  response: string;
  timestamp: number;
}

const aiCache = new Map<string, CachedItem>();

/** In-flight generate promises keyed by cache key. */
export const pendingRequests = new Map<string, Promise<string>>();

/**
 * Builds a deterministic cache key from prompt inputs.
 */
export function getCacheKey(systemPrompt: string, userMessage: string, model: string): string {
  const data = `${systemPrompt || ""}|${userMessage}|${model}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Returns a cached response if still valid.
 */
export function getCached(cacheKey: string): string | null {
  const cached = aiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.response;
  }
  return null;
}

/**
 * Stores a successful generate response.
 */
export function setCached(cacheKey: string, text: string): void {
  if (text) {
    aiCache.set(cacheKey, { response: text, timestamp: Date.now() });
  }
}

/**
 * Returns an existing in-flight promise for deduplication, if any.
 */
export function getPending(cacheKey: string): Promise<string> | undefined {
  return pendingRequests.get(cacheKey);
}

/**
 * Registers an in-flight generate promise.
 */
export function setPending(cacheKey: string, promise: Promise<string>): void {
  pendingRequests.set(cacheKey, promise);
}

/**
 * Removes an in-flight generate promise after completion.
 */
export function deletePending(cacheKey: string): void {
  pendingRequests.delete(cacheKey);
}

/**
 * Removes expired entries and enforces MAX_CACHE_ENTRIES cap.
 * Called on a scheduled interval from server.ts.
 */
export function pruneCache(): void {
  const now = Date.now();
  for (const [k, v] of aiCache) {
    if (now - v.timestamp > CACHE_TTL) aiCache.delete(k);
  }
  // If still over cap after TTL prune, evict oldest entries
  if (aiCache.size > MAX_CACHE_ENTRIES) {
    const sorted = [...aiCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (const [k] of sorted.slice(0, aiCache.size - MAX_CACHE_ENTRIES)) {
      aiCache.delete(k);
    }
  }
}
