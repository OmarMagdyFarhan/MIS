/**
 * Structured logging for the server AI layer with optional debug verbosity.
 * @module server/ai/telemetry/logger
 */

import type { AIErrorCode } from "../errors.js";
import type { AIProviderId } from "../types.js";
import { logger } from "../../logger.js";

/** Structured log payload for AI infrastructure events. */
export interface AIStructuredLog {
  traceId: string;
  event: string;
  provider?: AIProviderId;
  model?: string;
  latencyMs?: number;
  retries?: number;
  cached?: boolean;
  errorType?: AIErrorCode | string;
  mode?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * True when `AI_DEBUG=true` (server-side verbose routing/retry logs).
 */
export function isAIDebugEnabled(): boolean {
  return process.env.AI_DEBUG === "true";
}

/**
 * Writes an info-level structured log (always in debug; otherwise for key lifecycle events).
 */
export function aiLogInfo(payload: AIStructuredLog): void {
  logger.info(payload);
}

/**
 * Writes a warning-level structured log.
 */
export function aiLogWarn(payload: AIStructuredLog): void {
  logger.warn(payload);
}

/**
 * Writes an error-level structured log.
 */
export function aiLogError(payload: AIStructuredLog): void {
  logger.error(payload);
}

/**
 * Writes a debug-level structured log (only when {@link isAIDebugEnabled}).
 */
export function aiLogDebug(payload: AIStructuredLog): void {
  if (!isAIDebugEnabled()) return;
  logger.debug({ ...payload, level: "debug" });
}
