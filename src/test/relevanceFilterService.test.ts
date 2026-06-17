import { describe, it, expect, vi, beforeEach } from 'vitest';
import { filterRelevantMessages, scoreMessageQuality } from '../features/corpus/services/relevanceFilterService';

vi.mock('../services/aiService', () => ({
  generateAIContent: vi.fn(),
}));

import { generateAIContent } from '../services/aiService';

const mockCompany = { id: 'co1', name: 'DogBreeder Pro', industry: 'Pet Services' } as any;
const mockOffer = { product: 'Dog training courses', generatedOffer: 'Train your dog in 30 days' } as any;

describe('filterRelevantMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks on-topic messages as relevant', async () => {
    (generateAIContent as any).mockResolvedValue(
      '[{"index":0,"isRelevant":true,"reason":"About dogs"}]'
    );
    const results = await filterRelevantMessages(["My dog won't stop barking"], mockCompany, mockOffer);
    expect(results[0].isRelevant).toBe(true);
  });

  it('marks off-topic messages as irrelevant', async () => {
    (generateAIContent as any).mockResolvedValue(
      '[{"index":0,"isRelevant":false,"reason":"About cake, not dogs"}]'
    );
    const results = await filterRelevantMessages(["I don't like cake"], mockCompany, mockOffer);
    expect(results[0].isRelevant).toBe(false);
  });

  it('fails open on AI parse error — returns isRelevant: true', async () => {
    (generateAIContent as any).mockRejectedValue(new Error('AI failure'));
    const results = await filterRelevantMessages(['some text'], mockCompany, mockOffer);
    expect(results[0].isRelevant).toBe(true);
  });

  it('returns empty array for empty input', async () => {
    const results = await filterRelevantMessages([], mockCompany, mockOffer);
    expect(results).toHaveLength(0);
  });

  it('result count always equals input count even on partial AI response', async () => {
    (generateAIContent as any).mockResolvedValue('[{"index":0,"isRelevant":true,"reason":"ok"}]');
    const results = await filterRelevantMessages(['msg1', 'msg2', 'msg3'], mockCompany, mockOffer);
    expect(results).toHaveLength(3);
  });
});

describe('scoreMessageQuality', () => {
  it('passes normal customer quotes', () => {
    expect(scoreMessageQuality('My dog barks at strangers and I need help').pass).toBe(true);
  });
  it('rejects very short text', () => {
    expect(scoreMessageQuality('ok').pass).toBe(false);
  });
  it('rejects emoji-only spam', () => {
    expect(scoreMessageQuality('🐕🐕🐕🐕🐕🐕').pass).toBe(false);
  });
  it('rejects repeated character spam', () => {
    expect(scoreMessageQuality('aaaaaaaaaaaaa').pass).toBe(false);
  });
  it('rejects number-only text', () => {
    expect(scoreMessageQuality('1234567890123').pass).toBe(false);
  });
  it('accepts Arabic text (non-Latin but alphabetic)', () => {
    expect(scoreMessageQuality('الكلب يعوي كثيراً في الليل وأحتاج مساعدة').pass).toBe(true);
  });
});
