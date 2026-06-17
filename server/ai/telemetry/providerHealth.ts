/**
 * In-memory provider health tracking (no dashboard).
 * @module server/ai/telemetry/providerHealth
 */

import type { AIProviderId } from "../types.js";
import { CIRCUIT_BREAKER } from "../resilience/circuitBreaker.js";

const ROLLING_WINDOW = 20;

interface ProviderHealthState {
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  rollingLatenciesMs: number[];
}

const state: Record<AIProviderId, ProviderHealthState> = {
  gemini: {
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    rollingLatenciesMs: [],
  },
  openrouter: {
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    rollingLatenciesMs: [],
  },
};

/** Public health snapshot for a provider. */
export interface ProviderHealthSnapshot {
  provider: AIProviderId;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  averageLatencyMs: number | null;
  circuitOpen: boolean;
  circuitFailures: number;
}

/**
 * Records a successful provider call.
 */
export function recordProviderSuccess(provider: AIProviderId, latencyMs: number): void {
  const s = state[provider];
  s.consecutiveFailures = 0;
  s.lastSuccessAt = Date.now();
  s.rollingLatenciesMs.push(latencyMs);
  if (s.rollingLatenciesMs.length > ROLLING_WINDOW) {
    s.rollingLatenciesMs.shift();
  }
}

/**
 * Records a failed provider call.
 */
export function recordProviderFailure(provider: AIProviderId): void {
  const s = state[provider];
  s.consecutiveFailures += 1;
  s.lastFailureAt = Date.now();
}

/**
 * Returns health snapshots for all providers.
 */
export function getProviderHealth(): ProviderHealthSnapshot[] {
  return (Object.keys(state) as AIProviderId[]).map((provider) => {
    const s = state[provider];
    const breaker = CIRCUIT_BREAKER[provider];
    const avg =
      s.rollingLatenciesMs.length > 0
        ? Math.round(
            s.rollingLatenciesMs.reduce((a, b) => a + b, 0) / s.rollingLatenciesMs.length
          )
        : null;
    return {
      provider,
      consecutiveFailures: s.consecutiveFailures,
      lastSuccessAt: s.lastSuccessAt,
      lastFailureAt: s.lastFailureAt,
      averageLatencyMs: avg,
      circuitOpen: breaker.isOpen,
      circuitFailures: breaker.failures,
    };
  });
}

/** Resets health state (test helper). */
export function resetProviderHealth(): void {
  for (const provider of Object.keys(state) as AIProviderId[]) {
    state[provider] = {
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      rollingLatenciesMs: [],
    };
  }
}
