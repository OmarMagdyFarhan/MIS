/**
 * AI execution layer entry — registers HTTP routes on the Express application.
 * @module server/ai
 */

export { executeAI } from "./engine.js";
export { registerAIRoutes } from "./routes.js";
export { normalizeAIError, AIError } from "./errors.js";
export { getProviderHealth } from "./telemetry/providerHealth.js";
export { estimateCost } from "./telemetry/costEstimator.js";
export {
  onRequestStart,
  onRequestSuccess,
  onRequestRetry,
  onRequestError,
  onCircuitOpen,
} from "./telemetry/hooks.js";
export type {
  AIExecuteInput,
  AIExecuteContext,
  AIExecuteResult,
  AIExecuteMeta,
  AIExecuteMode,
  AIUsageMetadata,
} from "./types.js";
