/**
 * Legacy API surface — maps original aiService functions to {@link aiClient}.
 * @module src/ai/legacy
 */

import { z } from "zod";
import { aiClient } from "./client";
import type { AITaskType } from "./types";

/** Shared fields for {@link generateAIContent} (discriminated by `jsonResponse`). */
export interface AIContentParamsBase {
  systemPrompt?: string;
  userMessage: string;
  model?: string;
  tools?: unknown[];
  cachedContent?: string;
  signal?: AbortSignal;
  /**
   * Task type for temperature control.
   * classification/structure → 0.0 (deterministic)
   * generation → 0.3 (for long-form copy only)
   * Omit to default to "structure" (deterministic).
   */
  taskType?: AITaskType;
}

/** @see {@link generateAIContent} in aiService */
export type AIContentParams =
  | (AIContentParamsBase & { jsonResponse?: false | undefined; schema?: never })
  | (AIContentParamsBase & { jsonResponse: true; schema?: z.ZodType<unknown> });

/** @see {@link generateAIChat} in aiService */
export interface AIChatParams {
  systemPrompt?: string;
  message: string;
  history?: Array<{ role: "user" | "model"; content: string }>;
  signal?: AbortSignal;
}

/** Shared fields for {@link generateAIContentStream}. */
export interface AIStreamParamsBase {
  systemPrompt?: string;
  userMessage: string;
  onChunk: (text: string) => void;
  model?: string;
  tools?: unknown[];
  cachedContent?: string;
  signal?: AbortSignal;
}

/** @see {@link generateAIContentStream} in aiService */
export type AIStreamParams =
  | (AIStreamParamsBase & { jsonResponse?: false | undefined })
  | (AIStreamParamsBase & { jsonResponse: true });

/** @see {@link generateWithSelfCorrection} in aiService */
export interface AISelfCorrectionParams {
  systemPrompt: string;
  userMessage: string;
  jsonResponse?: boolean;
  criteria: string;
  signal?: AbortSignal;
}

/** Parsed JSON object from model responses (legacy generate path). */
export type AIJsonObject = Record<string, unknown>;

/**
 * Non-streaming content generation (legacy entry point).
 */
export async function generateAIContent(
  params: AIContentParamsBase & { jsonResponse?: false | undefined; schema?: never }
): Promise<string>;
export async function generateAIContent<T extends AIJsonObject = AIJsonObject>(
  params: AIContentParamsBase & { jsonResponse: true; schema?: z.ZodType<T> }
): Promise<T>;
export async function generateAIContent(
  params: AIContentParams
): Promise<string | AIJsonObject> {
  if (params.jsonResponse) {
    return aiClient.execute<AIJsonObject>({
      mode: "generate",
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      json: true,
      schema: params.schema,
      model: params.model,
      signal: params.signal,
      taskType: params.taskType ?? "structure",
    });
  }
  return aiClient.execute<string>({
    mode: "generate",
    systemPrompt: params.systemPrompt,
    userMessage: params.userMessage,
    json: false,
    model: params.model,
    signal: params.signal,
    taskType: params.taskType ?? "structure",
  });
}

/**
 * Multi-turn chat (legacy entry point).
 */
export async function generateAIChat(params: AIChatParams): Promise<string> {
  return aiClient.execute<string>({
    mode: "chat",
    systemPrompt: params.systemPrompt,
    userMessage: params.message,
    history: params.history,
    signal: params.signal,
  });
}

/**
 * Streaming content generation (legacy entry point).
 */
export async function generateAIContentStream(
  params: AIStreamParamsBase & { jsonResponse?: false | undefined }
): Promise<string>;
export async function generateAIContentStream<T extends AIJsonObject = AIJsonObject>(
  params: AIStreamParamsBase & { jsonResponse: true }
): Promise<T>;
export async function generateAIContentStream(
  params: AIStreamParams
): Promise<string | AIJsonObject> {
  if (params.jsonResponse) {
    return aiClient.execute<AIJsonObject>({
      mode: "stream",
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      onChunk: params.onChunk,
      json: true,
      model: params.model,
      tools: params.tools,
      cachedContent: params.cachedContent,
      signal: params.signal,
    });
  }
  return aiClient.execute<string>({
    mode: "stream",
    systemPrompt: params.systemPrompt,
    userMessage: params.userMessage,
    onChunk: params.onChunk,
    json: false,
    model: params.model,
    tools: params.tools,
    cachedContent: params.cachedContent,
    signal: params.signal,
  });
}

/**
 * Bounded self-correction strategy (legacy entry point).
 */
export async function generateWithSelfCorrection(params: AISelfCorrectionParams): Promise<{
  output: unknown;
  verdict: string;
}> {
  let attempt = 0;
  const maxRefinements = 1;

  let currentOutput: string | AIJsonObject = params.jsonResponse
    ? await generateAIContent({
        systemPrompt: params.systemPrompt,
        userMessage: params.userMessage,
        jsonResponse: true,
        signal: params.signal,
      })
    : await generateAIContent({
        systemPrompt: params.systemPrompt,
        userMessage: params.userMessage,
        signal: params.signal,
      });

  while (attempt < maxRefinements) {
    const critique = await generateAIContent<{
      rating?: number;
      issues?: unknown[];
      verdict?: string;
    }>({
      systemPrompt: `Evaluate this output against: ${params.criteria}. Return only valid JSON: { "rating": 1-10, "issues": [], "verdict": "" }`,
      userMessage: `Output: ${JSON.stringify(currentOutput)}`,
      jsonResponse: true,
      signal: params.signal,
    });

    if (Number(critique?.rating || 0) >= 8) {
      return { output: currentOutput, verdict: critique.verdict ?? "" };
    }

    attempt++;
    currentOutput = await generateAIContent({
      systemPrompt: `Fix these issues: ${JSON.stringify(critique.issues)}. Original criteria: ${params.criteria}`,
      userMessage: `Draft: ${JSON.stringify(currentOutput)}`,
      jsonResponse: true,
      signal: params.signal,
    });
  }

  return { output: currentOutput, verdict: "Max depth reached." };
}
