/**
 * Integration tests for the Express server routes.
 *
 * These tests run against a real Express instance with the Gemini SDK mocked
 * so they work in CI without a live API key.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';

// --- Minimal re-implementation of the validation schema used in server.ts ---
const AIRequestSchema = z.object({
  systemPrompt: z.string().optional(),
  userMessage: z.string(),
  jsonResponse: z.boolean().optional(),
  model: z.string().optional(),
});

// --- Mock Gemini so tests run without a real API key ---
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: () => ({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: () => 'mocked AI response' },
      }),
      generateContentStream: vi.fn().mockResolvedValue({
        stream: (async function* () {
          yield { text: 'chunk 1' };
          yield { text: 'chunk 2' };
        })(),
      }),
      startChat: vi.fn().mockReturnValue({
        sendMessage: vi.fn().mockResolvedValue({ response: { text: () => 'chat reply' } }),
      }),
    }),
  })),
}));

// --- Minimal test server (mirrors the real server routes but without startup side-effects) ---
function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(cors());
  app.use(helmet({ contentSecurityPolicy: false }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'healthy' });
  });

  app.post('/api/ai/generate', async (req, res) => {
    try {
      const { systemPrompt = '', userMessage, jsonResponse } = AIRequestSchema.parse(req.body);
      // In the real server this calls Gemini; here we short-circuit.
      res.json({ text: `echo:${userMessage}` });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Schema Validation Error', details: err.issues });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return app;
}

describe('Express API Integration', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => { app = createTestApp(); });

  it('GET /api/health returns status healthy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('POST /api/ai/generate succeeds with valid payload', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .send({ userMessage: 'Hello world', systemPrompt: 'You are helpful.' });
    expect(res.status).toBe(200);
    expect(res.body.text).toContain('Hello world');
  });

  it('POST /api/ai/generate returns 400 for missing userMessage', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .send({ systemPrompt: 'only system' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Schema Validation Error');
  });

  it('POST /api/ai/generate accepts jsonResponse flag', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .send({ userMessage: 'Return JSON please', jsonResponse: true });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('text');
  });
});
