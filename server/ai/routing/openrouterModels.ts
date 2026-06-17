/**
 * Maps internal MIS model ids to OpenRouter provider/model slugs.
 * @module server/ai/routing/openrouterModels
 */

const OPENROUTER_MODEL_MAP: Record<string, string> = {
  "gemini-2.0-flash": "google/gemini-2.0-flash-001",
  "gemini-2.0-flash-lite": "google/gemini-2.0-flash-lite-001",
  "gemini-2.5-flash-preview-05-20": "google/gemini-2.5-flash-preview-05-20",
  "gemini-1.5-flash": "google/gemini-flash-1.5",
  "gemini-1.5-pro": "google/gemini-pro-1.5",
};

/**
 * Returns the OpenRouter model slug for a MIS allowlisted model id.
 */
export function toOpenRouterModel(model: string): string {
  if (model.includes("/")) return model;
  return OPENROUTER_MODEL_MAP[model] ?? model;
}
