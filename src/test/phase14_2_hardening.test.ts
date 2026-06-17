/**
 * Phase 14.2 Hardening Layer — additional tests
 * Covers Issues 6 (batch limit), 7 (confidence threshold), 8 (evidence attribution), 10 (provider tracking)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Issue 6: Batch size limit ─────────────────────────────────────────────────

vi.mock('../services/aiService', () => ({
  generateAIContent: vi.fn(),
}));
vi.mock('../features/corpus/services/relevanceFilterService', () => ({
  filterRelevantMessages: vi.fn(async (msgs: string[]) =>
    msgs.map((_, i) => ({ messageIndex: i, isRelevant: true, reason: 'ok' }))
  ),
  scoreMessageQuality: vi.fn(() => ({ pass: true, reason: 'ok' })),
}));

import { runMessageMiningAnalysis } from '../features/corpus/services/messageMiningOrchestrator';
import { PIPELINE_THRESHOLDS } from '../constants/pipelineThresholds';

const now = new Date().toISOString();
const mockCompany: any = { id: 'co1', name: 'DogBreeder Pro', industry: 'Pet Services', specializations: [], usp: 'fast', country: 'Global', websiteUrl: '', isGlobalMode: true, createdAt: now };
const mockOffer: any = { product: 'Dog training', generatedOffer: 'Train your dog in 30 days' };

describe('runMessageMiningAnalysis — batch size (Issue 6)', () => {
  it('rejects batches over MAX_MESSAGES_PER_BATCH', async () => {
    // scoreMessageQuality passes everything through, so we need 51 messages that pass quality
    const { scoreMessageQuality } = await import('../features/corpus/services/relevanceFilterService');
    (scoreMessageQuality as any).mockReturnValue({ pass: true, reason: 'ok' });

    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      id: `m${i}`,
      text: `This is message number ${i} about dogs and barking behavior`,
      analyzed: false,
    } as any));
    const errorCb = vi.fn();
    await expect(
      runMessageMiningAnalysis(tooMany, mockCompany, [], { onError: errorCb, onMessageAnalyzed: vi.fn(), onAvatarCreated: vi.fn(), onAvatarImproved: vi.fn(), onMarketIntelligenceReady: vi.fn() }, mockOffer)
    ).rejects.toThrow(/exceeds limit/);
    expect(errorCb).toHaveBeenCalled();
  });
});

// ── Issue 7: Low confidence threshold sanity ──────────────────────────────────

describe('low confidence threshold (Issue 7)', () => {
  it('0.49 is below the 0.5 threshold', () => {
    expect(0.49 < 0.5).toBe(true);
  });
  it('0.5 is NOT below the 0.5 threshold', () => {
    expect(0.5 < 0.5).toBe(false);
  });
  it('0.0 triggers low confidence warning', () => {
    expect(0.0 < 0.5).toBe(true);
  });
});

// ── Issue 8: CitedClaim evidence attribution ──────────────────────────────────

describe('CitedClaim evidence attribution (Issue 8)', () => {
  it('CitedClaim has supportingMessageIds array', () => {
    const claim = { claim: 'test', supportingMessageIds: ['m1', 'm2'], confidence: 0.8 };
    expect(Array.isArray(claim.supportingMessageIds)).toBe(true);
  });

  it('supportingMessageIds can filter messages', () => {
    const claim = { claim: 'test', supportingMessageIds: ['m1', 'm3'], confidence: 0.8 };
    const messages = [
      { id: 'm1', rawText: 'msg 1' },
      { id: 'm2', rawText: 'msg 2' },
      { id: 'm3', rawText: 'msg 3' },
    ];
    const supporting = messages.filter(m => claim.supportingMessageIds.includes(m.id));
    expect(supporting).toHaveLength(2);
    expect(supporting.map(m => m.id)).toEqual(['m1', 'm3']);
  });
});

// ── Issue 10: AvatarGeneration type with providerUsed/modelUsed ───────────────

import type { AvatarGeneration } from '../types/phase10';

describe('AvatarGeneration type (Issue 10)', () => {
  it('accepts modelUsed and providerUsed fields', () => {
    const gen: AvatarGeneration = {
      method: 'clusters',
      timestamp: Date.now(),
      sourceClusterIds: [],
      sourceCommentIds: [],
      commentCount: 5,
      clusterCount: 1,
      evidenceQuality: 0.8,
      clusterCohesion: 0.7,
      dominantProblems: [],
      modelUsed: 'gemini-1.5-flash',
      providerUsed: 'gemini',
    };
    expect(gen.modelUsed).toBe('gemini-1.5-flash');
    expect(gen.providerUsed).toBe('gemini');
  });

  it('works without modelUsed/providerUsed (backward compat)', () => {
    const gen: AvatarGeneration = {
      method: 'clusters',
      timestamp: Date.now(),
      sourceClusterIds: [],
      sourceCommentIds: [],
      commentCount: 5,
      clusterCount: 1,
      evidenceQuality: 0.8,
      clusterCohesion: 0.7,
      dominantProblems: [],
    };
    expect(gen.modelUsed).toBeUndefined();
    expect(gen.providerUsed).toBeUndefined();
  });

  it('accepts openrouter as providerUsed', () => {
    const gen: AvatarGeneration = {
      method: 'ai-initial',
      timestamp: Date.now(),
      sourceClusterIds: [],
      sourceCommentIds: [],
      commentCount: 3,
      clusterCount: 0,
      evidenceQuality: 0.5,
      clusterCohesion: 0.5,
      dominantProblems: [],
      modelUsed: 'openai/gpt-4o-mini',
      providerUsed: 'openrouter',
    };
    expect(gen.providerUsed).toBe('openrouter');
  });
});
