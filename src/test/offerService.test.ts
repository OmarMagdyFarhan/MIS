import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consolidateOffer, computeOfferScore } from '../services/offerService';
import type { Avatar } from '../types';

vi.mock('../services/aiService', () => ({
  generateAIContent: vi.fn(),
}));

const mockCompany = {
  id: 'c1', name: 'Acme', industry: 'SaaS', specializations: [], usp: 'fast',
  country: 'Global', websiteUrl: '', isGlobalMode: true, createdAt: '',
};

const mockOffer = {
  companyId: 'c1', product: 'Widget Pro', relevance: 'saves time',
  reason: 'limited seats', audience: 'dev teams',
  transformation: 'from chaos to clarity', generatedOffer: 'Original copy',
  generatedAt: '2025-01-01T00:00:00.000Z',
};

// All required Avatar fields must be present
const mockAvatar: Partial<Avatar> = {
  id: 'av1', name: 'Builder Bob', companyId: 'c1',
  description: 'A busy developer', definingCharacteristic: 'Ships fast',
  visualDescriptor: 'Laptop-carrying professional', category: 'Goals and Challenges',
  canHaveSubAvatars: false,
  targetedOffer: { hook: 'Save 3h/day', punchline: 'serious', cta: 'Try',
                   objectionHandler: 'no risk', differentiator: 'fastest' } as any,
};

describe('consolidateOffer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('happy path: calls generateAIContent and merges result', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as any).mockResolvedValue({
      product: 'New Widget Pro', transformation: 'from confusion to confidence',
      audience: 'growing dev teams', generatedOffer: 'Improved copy',
      score: { total: 85, clarity: 80, relevance: 90, urgency: 75,
               clarityReasoning: '', relevanceReasoning: '', urgencyReasoning: '', reasoning: '' },
    });
    const result = await consolidateOffer(mockCompany, mockOffer, [mockAvatar as Avatar]);
    expect(result.generatedOffer).toBe('Improved copy');
    expect(result.score?.total).toBe(85);
  });

  it('throws when AI throws', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as any).mockRejectedValue(new Error('quota'));
    await expect(consolidateOffer(mockCompany, mockOffer, [mockAvatar as Avatar]))
      .rejects.toThrow('quota');
  });
});

describe('computeOfferScore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('happy path: merges score into offer', async () => {
    const { generateAIContent } = await import('../services/aiService');
    // computeOfferScore returns parsed.score — AI must return { score: {...} }
    (generateAIContent as any).mockResolvedValue({
      score: { total: 75, clarity: 70, relevance: 80, urgency: 75,
               clarityReasoning: 'clear', relevanceReasoning: 'relevant',
               urgencyReasoning: 'urgent', reasoning: 'good', explanation: '', improvementTip: '' },
    });
    const result = await computeOfferScore(mockCompany, mockOffer);
    expect(result.score?.total).toBe(75);
    expect(result.score?.clarity).toBe(70);
  });

  it('returns offer unchanged when AI throws', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as any).mockRejectedValue(new Error('quota exceeded'));
    const result = await computeOfferScore(mockCompany, mockOffer);
    expect(result).toBeDefined();
    expect(result.companyId).toBe('c1');
    expect(result.score).toBeUndefined();
  });
});
