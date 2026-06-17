import { describe, it, expect } from 'vitest';
import { AI_ERROR_CODES, ALLOWED_MODELS,
         GenerateRequestSchema, ChatRequestSchema } from '../shared/api';

describe('AI_ERROR_CODES', () => {
  it('contains RATE_LIMIT',    () => expect(AI_ERROR_CODES).toContain('RATE_LIMIT'));
  it('contains SATURATION',    () => expect(AI_ERROR_CODES).toContain('SATURATION'));
  it('contains CIRCUIT_OPEN',  () => expect(AI_ERROR_CODES).toContain('CIRCUIT_OPEN'));
});

describe('GenerateRequestSchema', () => {
  it('rejects empty userMessage',
    () => expect(GenerateRequestSchema.safeParse({ userMessage: '' }).success).toBe(false));
  it('rejects over-length userMessage',
    () => expect(GenerateRequestSchema.safeParse({ userMessage: 'x'.repeat(16_001) }).success).toBe(false));
  it('accepts valid request',
    () => expect(GenerateRequestSchema.safeParse({ userMessage: 'hello' }).success).toBe(true));
  it('rejects unknown model',
    () => expect(GenerateRequestSchema.safeParse({ userMessage: 'hi', model: 'not-a-model' }).success).toBe(false));
  it('accepts known model',
    () => expect(GenerateRequestSchema.safeParse({ userMessage: 'hi', model: ALLOWED_MODELS[0] }).success).toBe(true));
});

describe('ChatRequestSchema', () => {
  it('rejects history over 50 items', () =>
    expect(ChatRequestSchema.safeParse({
      message: 'hi',
      history: Array.from({ length: 51 }, (_, i) => ({ role: 'user', content: `m${i}` })),
    }).success).toBe(false));
  it('accepts history of exactly 50', () =>
    expect(ChatRequestSchema.safeParse({
      message: 'hi',
      history: Array.from({ length: 50 }, (_, i) => ({ role: 'user', content: `m${i}` })),
    }).success).toBe(true));
});
