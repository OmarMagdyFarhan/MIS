/**
 * Development debug mode for verbose client AI logs.
 * @module src/ai/debug
 */

/**
 * True when verbose AI debug logging is enabled.
 * Set `VITE_AI_DEBUG=true` in `.env` for the browser bundle, or `AI_DEBUG=true` on the server.
 */
export function isAIDebugEnabled(): boolean {
  if (typeof import.meta !== "undefined") {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
    if (env?.VITE_AI_DEBUG === "true") return true;
  }
  if (typeof process !== "undefined" && process.env?.AI_DEBUG === "true") {
    return true;
  }
  return false;
}

/**
 * Debug-only structured log (no-op when debug is off).
 */
export function aiDebugLog(payload: Record<string, unknown>): void {
  if (!isAIDebugEnabled()) return;
  console.log(JSON.stringify({ level: "debug", ...payload }));
}
