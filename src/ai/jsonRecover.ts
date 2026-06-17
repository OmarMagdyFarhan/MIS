/**
 * JSON extraction, repair, and optional schema validation for model output.
 * @module src/ai/jsonRecover
 */

import type { z } from "zod";

/**
 * Removes markdown JSON code fences from model text.
 */
export function stripJsonFences(text: string): string {
  return text.replace(/```json\n?|\n?```/g, "").trim();
}

/**
 * Attempts to fix common JSON syntax issues (e.g. trailing commas).
 */
export function repairTrailingCommas(jsonText: string): string {
  return jsonText.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Extracts the outermost `{...}` substring for brace-based recovery.
 */
export function extractJsonObjectSubstring(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return null;
}

/**
 * Parses JSON text with fence stripping, brace extraction, and comma repair.
 */
export function safeParseJson(text: string): unknown {
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonPart = extractJsonObjectSubstring(cleaned);
    if (jsonPart) {
      try {
        return JSON.parse(jsonPart);
      } catch {
        const repaired = repairTrailingCommas(jsonPart);
        return JSON.parse(repaired);
      }
    }
    const repaired = repairTrailingCommas(cleaned);
    return JSON.parse(repaired);
  }
}

export interface ParseModelJsonOptions {
  text: string;
  schema?: z.ZodType<unknown>;
}

/**
 * Parses model JSON output and optionally validates with a Zod schema.
 */
export function parseModelJson<T = unknown>(options: ParseModelJsonOptions): T {
  const parsed = safeParseJson(options.text);
  if (options.schema) {
    return options.schema.parse(parsed) as T;
  }
  return parsed as T;
}

/** Appends the standard JSON repair instruction used on retry. */
export function appendJsonRetryPrompt(userMessage: string): string {
  return `${userMessage}\n\nCRITICAL: Your previous response was invalid JSON. Ensure strict compliance.`;
}

/** User-facing error when JSON recovery is exhausted. */
export const JSON_SCHEMA_FAILURE_MESSAGE =
  "Neural core failed to produce valid strategic schema.";
