/**
 * Browser AI execution layer — shared request/response types.
 * @module src/ai/types
 */

import type { z } from "zod";

/** A single turn in multi-turn chat history. */
export interface ChatTurn {
  role: "user" | "model";
  content: string;
}

/** Execution mode routed by {@link AIClient.execute}. */
export type AIExecuteMode = "generate" | "stream" | "chat";

/**
 * Task type — controls AI temperature.
 * classification/structure → 0.0 (deterministic)
 * generation → 0.3 (creative copy only)
 */
export type AITaskType = "classification" | "structure" | "generation";

/**
 * Unified browser request contract for all AI modes.
 * For `chat`, `userMessage` carries the latest user turn.
 */
export interface AIExecuteRequest {
  mode: AIExecuteMode;
  systemPrompt?: string;
  userMessage: string;
  history?: ChatTurn[];
  json?: boolean;
  schema?: z.ZodType<unknown>;
  model?: string;
  signal?: AbortSignal;
  /** Stream-only: invoked with accumulated text on each chunk. */
  onChunk?: (text: string) => void;
  /** Passed through to the API body when supported (stream/generate). */
  tools?: unknown[];
  cachedContent?: string;
  /**
   * Task type for temperature control.
   * classification/structure → temperature 0.0
   * generation → temperature 0.3
   * Default: "structure"
   */
  taskType?: AITaskType;
}
