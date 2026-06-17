import { describe, it, expect } from 'vitest';
import { searchEvidence, groupSearchResultsByAspect } from '../services/evidenceSearchService';
import type { EvidenceMessage } from '../types/pipeline';

const now = new Date().toISOString();

function makeMsg(id: string, text: string, aspect: string, quality = 0.7): EvidenceMessage {
  return {
    id, rawText: text, source: 'paste', analyzed: true,
    analysis: {
      topic: 'test', conversionFormulaAspect: aspect as any,
      messageType: 'Uncertainty', qualityScore: quality,
    },
    clusterId: null, createdAt: now, updatedAt: now,
  };
}

const messages = [
  makeMsg('m1', 'I am worried about the price going up next month', 'Anxiety', 0.85),
  makeMsg('m2', 'The harness fits really well on my dog', 'Value', 0.9),
  makeMsg('m3', 'Shipping takes too long every time', 'Friction', 0.7),
  makeMsg('m4', 'Price is a concern but quality justifies it', 'Anxiety', 0.75),
];

describe('searchEvidence', () => {
  it('returns empty for empty query', () => {
    expect(searchEvidence(messages, [], {})).toHaveLength(0);
  });

  it('finds messages by text', () => {
    const results = searchEvidence(messages, [], { text: 'price' });
    expect(results).toHaveLength(2);
    expect(results.every(r => r.message.rawText.toLowerCase().includes('price'))).toBe(true);
  });

  it('filters by aspect', () => {
    const results = searchEvidence(messages, [], { aspect: 'Anxiety' });
    expect(results).toHaveLength(2);
  });

  it('combines text and aspect filter', () => {
    const results = searchEvidence(messages, [], { text: 'price', aspect: 'Anxiety' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every(r => r.message.analysis?.conversionFormulaAspect === 'Anxiety')).toBe(true);
  });

  it('filters by minimum quality score', () => {
    const results = searchEvidence(messages, [], { text: 'price', minQualityScore: 0.8 });
    expect(results.every(r => (r.message.analysis?.qualityScore ?? 0) >= 0.8)).toBe(true);
  });

  it('sorts by relevance score descending', () => {
    const results = searchEvidence(messages, [], { text: 'price' });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].relevanceScore).toBeGreaterThanOrEqual(results[i].relevanceScore);
    }
  });
});

describe('groupSearchResultsByAspect', () => {
  it('groups correctly', () => {
    const results = searchEvidence(messages, [], { text: 'price' });
    const groups = groupSearchResultsByAspect(results);
    expect(groups.has('Anxiety')).toBe(true);
    expect(groups.get('Anxiety')!.length).toBe(2);
  });
});
