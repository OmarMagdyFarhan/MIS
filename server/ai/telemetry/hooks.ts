/**
 * Pluggable telemetry hooks for the server AI execution layer.
 * @module server/ai/telemetry/hooks
 */

import type { AIError } from "../errors.js";
import type { AIExecuteMeta, AIExecuteMode, AIProviderId } from "../types.js";

/** Context passed when a request starts. */
export interface AIRequestStartContext {
  traceId: string;
  mode: AIExecuteMode;
  clientId: string;
  model?: string;
  startedAt: number;
}

/** Context passed on successful completion. */
export interface AIRequestSuccessContext extends AIRequestStartContext {
  meta: AIExecuteMeta;
}

/** Context passed on retry. */
export interface AIRequestRetryContext extends AIRequestStartContext {
  attempt: number;
  reason: string;
  provider?: AIProviderId;
}

/** Context passed on error. */
export interface AIRequestErrorContext extends AIRequestStartContext {
  error: AIError;
  latencyMs: number;
}

/** Context passed when a circuit opens. */
export interface AICircuitOpenContext {
  traceId?: string;
  provider: AIProviderId;
  failures: number;
}

export type AIHookListener<T> = (ctx: T) => void;

const onStartListeners: AIHookListener<AIRequestStartContext>[] = [];
const onSuccessListeners: AIHookListener<AIRequestSuccessContext>[] = [];
const onRetryListeners: AIHookListener<AIRequestRetryContext>[] = [];
const onErrorListeners: AIHookListener<AIRequestErrorContext>[] = [];
const onCircuitOpenListeners: AIHookListener<AICircuitOpenContext>[] = [];

/** Registers a request-start hook; returns unsubscribe. */
export function onRequestStart(listener: AIHookListener<AIRequestStartContext>): () => void {
  onStartListeners.push(listener);
  return () => {
    const i = onStartListeners.indexOf(listener);
    if (i >= 0) onStartListeners.splice(i, 1);
  };
}

/** Registers a success hook; returns unsubscribe. */
export function onRequestSuccess(listener: AIHookListener<AIRequestSuccessContext>): () => void {
  onSuccessListeners.push(listener);
  return () => {
    const i = onSuccessListeners.indexOf(listener);
    if (i >= 0) onSuccessListeners.splice(i, 1);
  };
}

/** Registers a retry hook; returns unsubscribe. */
export function onRequestRetry(listener: AIHookListener<AIRequestRetryContext>): () => void {
  onRetryListeners.push(listener);
  return () => {
    const i = onRetryListeners.indexOf(listener);
    if (i >= 0) onRetryListeners.splice(i, 1);
  };
}

/** Registers an error hook; returns unsubscribe. */
export function onRequestError(listener: AIHookListener<AIRequestErrorContext>): () => void {
  onErrorListeners.push(listener);
  return () => {
    const i = onErrorListeners.indexOf(listener);
    if (i >= 0) onErrorListeners.splice(i, 1);
  };
}

/** Registers a circuit-open hook; returns unsubscribe. */
export function onCircuitOpen(listener: AIHookListener<AICircuitOpenContext>): () => void {
  onCircuitOpenListeners.push(listener);
  return () => {
    const i = onCircuitOpenListeners.indexOf(listener);
    if (i >= 0) onCircuitOpenListeners.splice(i, 1);
  };
}

function safeEmit<T>(listeners: AIHookListener<T>[], ctx: T): void {
  for (const listener of listeners) {
    try {
      listener(ctx);
    } catch {
      /* hooks must not break execution */
    }
  }
}

/** Emits request-start to all hooks. */
export function emitRequestStart(ctx: AIRequestStartContext): void {
  safeEmit(onStartListeners, ctx);
}

/** Emits request-success to all hooks. */
export function emitRequestSuccess(ctx: AIRequestSuccessContext): void {
  safeEmit(onSuccessListeners, ctx);
}

/** Emits request-retry to all hooks. */
export function emitRequestRetry(ctx: AIRequestRetryContext): void {
  safeEmit(onRetryListeners, ctx);
}

/** Emits request-error to all hooks. */
export function emitRequestError(ctx: AIRequestErrorContext): void {
  safeEmit(onErrorListeners, ctx);
}

/** Emits circuit-open to all hooks. */
export function emitCircuitOpen(ctx: AICircuitOpenContext): void {
  safeEmit(onCircuitOpenListeners, ctx);
}

/** Clears all hooks (test helper). */
export function resetAIHooks(): void {
  onStartListeners.length = 0;
  onSuccessListeners.length = 0;
  onRetryListeners.length = 0;
  onErrorListeners.length = 0;
  onCircuitOpenListeners.length = 0;
}
