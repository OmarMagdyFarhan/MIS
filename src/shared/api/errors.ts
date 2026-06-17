export const AI_ERROR_CODES = [
  'PROVIDER', 'RATE_LIMIT', 'JSON_PARSE', 'ABORT', 'TIMEOUT',
  'VALIDATION', 'STREAM', 'CIRCUIT_OPEN', 'BACKPRESSURE', 'SATURATION',
] as const;

export type AIErrorCode = (typeof AI_ERROR_CODES)[number];
