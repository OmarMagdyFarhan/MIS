/**
 * AI model allowlist — shared between server validation and client.
 * No imports from server/ or browser APIs here.
 */
export const ALLOWED_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash-preview-05-20',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];
export const DEFAULT_GENERATE_MODEL: AllowedModel = 'gemini-2.5-flash-preview-05-20';
