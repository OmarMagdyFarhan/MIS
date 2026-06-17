/**
 * Browser AI execution layer — public exports.
 * @module src/ai
 */

export { aiClient, getClientId, TIMEOUT_EXCEEDED_MESSAGE } from "./client";
export type { AIExecuteRequest, AIExecuteMode, ChatTurn } from "./types";
export {
  stripJsonFences,
  safeParseJson,
  parseModelJson,
} from "./jsonRecover";
export { createTimeoutLink, DEFAULT_AI_TIMEOUT_MS } from "./timeoutLink";
export { onAITelemetry, emitAITelemetry, resetAITelemetry } from "./telemetry";
export type { AITelemetryEvent, AITelemetryUsage } from "./telemetry";
export { isAIDebugEnabled, aiDebugLog } from "./debug";
export { createTraceId, readTraceFromResponse, withTraceHeader } from "./trace";
export {
  AIError,
  AIProviderError,
  AIRateLimitError,
  AIJSONParseError,
  AIAbortError,
  AITimeoutError,
  AIValidationError,
  AIStreamError,
  AICircuitOpenError,
  normalizeClientAIError,
  errorFromHttpResponse,
} from "./errors";
export type { AIErrorCode } from "./errors";
export {
  generateAIContent,
  generateAIChat,
  generateAIContentStream,
  generateWithSelfCorrection,
} from "./legacy";
export type {
  AIContentParams,
  AIChatParams,
  AIStreamParams,
  AISelfCorrectionParams,
} from "./legacy";
