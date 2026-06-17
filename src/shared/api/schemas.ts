import { z } from 'zod';
import { ALLOWED_MODELS } from './models';

function isAllowedModel(m: string): boolean {
  return (ALLOWED_MODELS as readonly string[]).includes(m);
}

export const GenerateRequestSchema = z.object({
  systemPrompt: z.string().max(8_000).optional(),
  userMessage:  z.string().min(1).max(16_000),
  jsonResponse: z.boolean().optional(),
  model:        z.string().refine(isAllowedModel, 'Unknown model').optional(),
});

export const ChatRequestSchema = z.object({
  systemPrompt: z.string().max(8_000).optional(),
  message:      z.string().min(1).max(16_000),
  history: z.array(z.object({
    role:    z.string(),
    content: z.string().max(16_000).optional(),
    text:    z.string().max(16_000).optional(),
  })).max(50).optional(),
  model: z.string().refine(isAllowedModel, 'Unknown model').optional(),
});

export const GenerateResponseSchema = z.object({
  text:     z.string(),
  provider: z.string().optional(),
  model:    z.string().optional(),
  cached:   z.boolean().optional(),
});

export const HealthResponseSchema = z.object({
  status:      z.literal('ok'),
  uptime:      z.number(),
  version:     z.string(),
  breakers:    z.record(z.string(), z.unknown()),
  concurrency: z.object({ active: z.number(), max: z.number() }),
});

export type GenerateRequest  = z.infer<typeof GenerateRequestSchema>;
export type ChatRequest      = z.infer<typeof ChatRequestSchema>;
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;
export type HealthResponse   = z.infer<typeof HealthResponseSchema>;
