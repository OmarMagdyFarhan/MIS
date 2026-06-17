/**
 * Per-provider circuit breaker for Gemini and OpenRouter.
 * @module server/ai/resilience/circuitBreaker
 */

import type { AIProviderId } from "../types.js";
import { emitCircuitOpen } from "../telemetry/hooks.js";
import { aiLogDebug, aiLogWarn } from "../telemetry/logger.js";

/** Failures before the breaker opens. */
export const BREAKER_THRESHOLD = 15;

/** Cooldown before half-open recovery (ms). */
export const BREAKER_COOLDOWN = 60000;

interface BreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  totalSuccess: number;
}

/**
 * Global circuit breaker state (per server instance).
 * Exported for the health endpoint.
 */
export const CIRCUIT_BREAKER: Record<AIProviderId, BreakerState> = {
  gemini: { failures: 0, lastFailure: 0, isOpen: false, totalSuccess: 0 },
  openrouter: { failures: 0, lastFailure: 0, isOpen: false, totalSuccess: 0 },
};

/**
 * Returns whether requests may proceed for the given provider.
 */
export function checkBreaker(provider: AIProviderId): boolean {
  const state = CIRCUIT_BREAKER[provider];
  if (state.isOpen) {
    const timeSinceFailure = Date.now() - state.lastFailure;
    if (timeSinceFailure > BREAKER_COOLDOWN) {
      state.isOpen = false;
      state.failures = Math.floor(state.failures / 2);
      aiLogDebug({
        traceId: "circuit",
        event: "circuit_half_open",
        provider,
        message: `HALF-OPEN (testing recovery)`,
      });
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Records a provider failure and may open the circuit.
 */
export function recordFailure(provider: AIProviderId, _error: unknown, traceId: string): void {
  const state = CIRCUIT_BREAKER[provider];
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= BREAKER_THRESHOLD && !state.isOpen) {
    state.isOpen = true;
    aiLogWarn({
      traceId,
      event: "circuit_open",
      provider,
      retries: state.failures,
      errorType: "CIRCUIT_OPEN",
    });
    emitCircuitOpen({ traceId, provider, failures: state.failures });
  }
}

/**
 * Records a successful provider call and decays failure count.
 */
export function recordSuccess(provider: AIProviderId): void {
  const state = CIRCUIT_BREAKER[provider];
  state.totalSuccess++;
  if (state.failures > 0) state.failures--;
}
