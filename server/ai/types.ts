/**
 * Shared types for the centralized AI execution layer.
 * @module server/ai/types
 */

import type { Request, Response } from "express";

/** Supported AI execution modes on the server. */
export type AIExecuteMode = "generate" | "stream" | "chat";

/** Provider identifiers used by circuit breaker and routing. */
export type AIProviderId = "gemini" | "openrouter";

/** Chat history turn as sent by the offer wizard client. */
export interface AIChatHistoryTurn {
  role: string;
  content?: string;
  text?: string;
}

/** Token usage metadata from providers when available. */
export interface AIUsageMetadata {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Observability metadata attached to every completed execution. */
export interface AIExecuteMeta {
  traceId: string;
  startedAt: number;
  latencyMs: number;
  provider: AIProviderId;
  model: string;
  retries: number;
  cached: boolean;
  fromDedup?: boolean;
  usage?: AIUsageMetadata;
  estimatedCostUsd?: number;
}

/**
 * Input payload for {@link executeAI}.
 * Fields vary by mode: generate/stream use userMessage; chat uses message + history.
 */
/** AI task type — determines temperature. classification/structure = 0.0, generation = 0.3 */
export type AITaskType = 'classification' | 'structure' | 'generation';

export interface AIExecuteInput {
  mode: AIExecuteMode;
  systemPrompt?: string;
  userMessage?: string;
  message?: string;
  history?: AIChatHistoryTurn[];
  jsonResponse?: boolean;
  model?: string;
  /** Controls temperature: classification/structure → 0.0, generation → 0.3 */
  taskType?: AITaskType;
}

/** Per-request context passed into the execution engine. */
export interface AIExecuteContext {
  req: Request;
  res?: Response;
  traceId: string;
  clientId: string;
  abortController?: AbortController;
}

/** Result returned by provider calls and the engine. */
export interface AIExecuteResult {
  text?: string;
  /** Response served from the in-memory cache. */
  cached?: boolean;
  /** Response merged from an in-flight duplicate request. */
  fromDedup?: boolean;
  streamCompleted?: boolean;
  streamAborted?: boolean;
  meta: AIExecuteMeta;
}

/** Internal provider call result before meta assembly. */
export interface ProviderCallResult {
  text?: string;
  streamCompleted?: boolean;
  streamAborted?: boolean;
  provider: AIProviderId;
  model: string;
  usage?: AIUsageMetadata;
  retries: number;
}
