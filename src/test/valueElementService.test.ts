import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assignValueElement } from '../services/valueElementService';
import type { Avatar } from '../types';
import type { AvatarOfferRecord, EvidenceMessage } from '../types/pipeline';
import { TIER1_ELEMENTS } from '../types/valueElements';

const now = new Date().toISOString();

function makeAvatar(id = 'av1'): Avatar {
  return {
    id,
    name: 'Test Avatar',
    companyId: 'co1',
    clusterId: 'cl1',
    synthesis: { coreMotivation: 'save time', primaryBlocker: 'complexity' },
  } as unknown as Avatar;
}

function makeOfferRecord(): AvatarOfferRecord {
  return {
    id: 'or1',
    companyId: 'co1',
    avatarId: 'av1',
    clusterId: 'cl1',
    formula: {
      audience: 'busy professionals',
      product: 'productivity tool',
      transformation: 'from chaos to clarity',
      reasonToActNow: 'before deadlines',
      specificity: 'saves 3 hours per week',
    },
    validationStatus: 'provisional',
    confidence: { overall: 0.7, dimensions: { evidenceVolume: 0.7, clusterCohesion: 0.6, offerEvidenceAlignment: 0.5, crossSegmentAgreement: 0.5 }, status: 'provisional', reasons: [], computedAt: now, corpusVersion: 1 },
    derivedFrom: { corpusVersion: 1, runId: 'run1' },
    updatedAt: now,
  };
}

function makeMessages(count = 3): EvidenceMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    rawText: `Customer quote ${i}: I was frustrated with the complexity and finally solved it. Saves me hours.`,
    source: 'paste' as const,
    analyzed: true,
    analysis: { topic: 'productivity', conversionFormulaAspect: 'Motivation' as const, messageType: 'Desired Outcome' as const, qualityScore: 0.8 },
    createdAt: now,
    updatedAt: now,
  }));
}

describe('assignValueElement', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a valid PrimaryValueElement for a Tier-1 response', async () => {
    const tier1Element = TIER1_ELEMENTS[0];
    const mockResponse = {
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          element: tier1Element,
          tier: 1,
          usedFallback: false,
          rationale: 'The customer quotes show strong desire to save time.',
          confidence: 0.82,
        }),
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const result = await assignValueElement(makeAvatar(), makeOfferRecord(), makeMessages());
    expect(result.element).toBe(tier1Element);
    expect(result.tier).toBe(1);
    expect(result.usedFallback).toBe(false);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.status).toBe('proposed');
    expect(typeof result.rationale).toBe('string');
  });

  it('returns a valid PrimaryValueElement for a Tier-2 fallback response', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          element: 'heirloom',
          tier: 2,
          usedFallback: true,
          rationale: 'No Tier 1 element fits; heirloom matches legacy/lasting value signals.',
          confidence: 0.61,
        }),
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const result = await assignValueElement(makeAvatar(), makeOfferRecord(), makeMessages());
    expect(result.usedFallback).toBe(true);
    expect(result.tier).toBe(2);
    expect(result.status).toBe('proposed');
  });

  it('throws for a malformed response with unknown element', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          element: 'not_a_real_element_xyz',
          tier: 1,
          usedFallback: false,
          rationale: 'unknown',
          confidence: 0.5,
        }),
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await expect(
      assignValueElement(makeAvatar(), makeOfferRecord(), makeMessages())
    ).rejects.toThrow(/unknown value element/i);
  });

  it('throws when fetch returns a non-ok status', async () => {
    const mockResponse = { ok: false, status: 500 };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await expect(
      assignValueElement(makeAvatar(), makeOfferRecord(), makeMessages())
    ).rejects.toThrow(/500/);
  });

  it('works with empty clusterMessages array', async () => {
    const tier1Element = TIER1_ELEMENTS[0];
    const mockResponse = {
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          element: tier1Element,
          tier: 1,
          usedFallback: false,
          rationale: 'Minimal context available.',
          confidence: 0.55,
        }),
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const result = await assignValueElement(makeAvatar(), makeOfferRecord(), []);
    expect(result.element).toBe(tier1Element);
  });

  it('works with undefined offerRecord', async () => {
    const tier1Element = TIER1_ELEMENTS[1];
    const mockResponse = {
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          element: tier1Element,
          tier: 1,
          usedFallback: false,
          rationale: 'Based on avatar synthesis alone.',
          confidence: 0.60,
        }),
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const result = await assignValueElement(makeAvatar(), undefined, makeMessages());
    expect(result.element).toBe(tier1Element);
  });

  it('clamps confidence to [0, 1]', async () => {
    const tier1Element = TIER1_ELEMENTS[0];
    const mockResponse = {
      ok: true,
      json: async () => ({
        text: JSON.stringify({
          element: tier1Element,
          tier: 1,
          usedFallback: false,
          rationale: 'test',
          confidence: 999,
        }),
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const result = await assignValueElement(makeAvatar(), makeOfferRecord(), makeMessages());
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
