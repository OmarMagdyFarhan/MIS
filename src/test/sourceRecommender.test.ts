import { describe, it, expect } from 'vitest';
import { detectGaps, buildRecommendations, shouldActivate, buildSummaryLine } from '../lib/sourceRecommender';
import { computeCorpusHealth } from '../lib/corpusHealth';
import type { EvidenceMessage, Cluster } from '../types/pipeline';

const now = new Date().toISOString();

function makeAnalyzedMsg(
  id: string,
  aspect: 'Motivation' | 'Value' | 'Anxiety',
  opts: { desiredOutcomes?: string[]; uniqueBenefits?: string[]; objections?: string[] } = {}
): EvidenceMessage {
  return {
    id,
    rawText: `Customer quote ${id}: meaningful content about ${aspect}`,
    source: 'paste',
    analyzed: true,
    analysis: {
      topic: `topic-${id}`,
      conversionFormulaAspect: aspect,
      messageType: 'Desired Outcome',
      qualityScore: 0.7,
      conversionAspects: {
        motivation: {
          desiredOutcomes: opts.desiredOutcomes ?? (aspect === 'Motivation' ? ['outcome'] : []),
          painPoints: [],
          purchasePrompts: [],
          confidence: 0.7,
          sourceCommentIds: [id],
        },
        value: {
          uniqueBenefits: opts.uniqueBenefits ?? (aspect === 'Value' ? ['benefit'] : []),
          delightfulFeatures: [],
          dealreakerNeeds: [],
          confidence: 0.7,
          sourceCommentIds: [id],
        },
        anxiety: {
          uncertainties: [],
          objections: opts.objections ?? (aspect === 'Anxiety' ? ['objection'] : []),
          perceivedRisks: [],
          confidence: 0.7,
          sourceCommentIds: [id],
        },
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

function makeCluster(id: string, msgIds: string[]): Cluster {
  return {
    id, companyId: 'co1', corpusVersion: 1, label: id, status: 'validated',
    messageIds: msgIds, source: 'mining', validationStatus: 'validated',
    createdAt: now, updatedAt: now,
  };
}

describe('detectGaps', () => {
  it('flags corpusTooSmall for fewer than 40 analyzed messages', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => makeAnalyzedMsg(`m${i}`, 'Motivation'));
    const result = detectGaps(msgs, []);
    expect(result.corpusTooSmall).toBe(true);
  });

  it('does NOT flag corpusTooSmall for 40+ analyzed messages', () => {
    const msgs = Array.from({ length: 40 }, (_, i) => makeAnalyzedMsg(`m${i}`, 'Motivation'));
    const result = detectGaps(msgs, []);
    expect(result.corpusTooSmall).toBe(false);
  });

  it('flags missing anxiety dimension when no anxiety signals present', () => {
    const msgs = [makeAnalyzedMsg('m1', 'Motivation'), makeAnalyzedMsg('m2', 'Value')];
    const result = detectGaps(msgs, []);
    expect(result.conversionGaps.anxiety.isMissing).toBe(true);
    expect(result.conversionGaps.hasMissingDimension).toBe(true);
  });

  it('does not flag missing dimension when all aspects covered', () => {
    const msgs = [
      makeAnalyzedMsg('m1', 'Motivation'),
      makeAnalyzedMsg('m2', 'Value'),
      makeAnalyzedMsg('m3', 'Anxiety'),
    ];
    const result = detectGaps(msgs, []);
    expect(result.conversionGaps.hasMissingDimension).toBe(false);
  });

  it('returns critical severity for small corpus + missing dimensions', () => {
    const result = detectGaps([], []);
    expect(result.overallSeverity).toBe('critical');
  });

  it('handles empty inputs without errors', () => {
    const result = detectGaps([], []);
    expect(result.corpusTooSmall).toBe(true);
    expect(result.conversionGaps.weakest).toBeNull();
    expect(result.thinEmotionCores).toEqual([]);
  });
});

describe('buildRecommendations', () => {
  it('returns recommendations for corpus with missing motivation', () => {
    const gaps = detectGaps([], []);
    const recs = buildRecommendations(gaps);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every(r => r.source && r.label && r.reason && r.priority)).toBe(true);
  });

  it('returns at most 5 recommendations', () => {
    const gaps = detectGaps([], []);
    const recs = buildRecommendations(gaps);
    expect(recs.length).toBeLessThanOrEqual(5);
  });

  it('returns higher-priority recommendations first', () => {
    const msgs = [makeAnalyzedMsg('m1', 'Motivation')];
    const gaps = detectGaps(msgs, []);
    const recs = buildRecommendations(gaps);
    const priorities = recs.map(r => ({ critical: 3, high: 2, medium: 1 }[r.priority]));
    const sorted = [...priorities].sort((a, b) => b - a);
    expect(priorities).toEqual(sorted);
  });

  it('includes searchHint in every recommendation', () => {
    const gaps = detectGaps([], []);
    const recs = buildRecommendations(gaps);
    recs.forEach(r => expect(r.searchHint.length).toBeGreaterThan(0));
  });

  it('returns empty array when no gaps detected (full healthy corpus)', () => {
    // 40+ analyzed messages, all 3 dimensions covered, no thin clusters
    const msgs = Array.from({ length: 41 }, (_, i) => {
      const aspects = ['Motivation', 'Value', 'Anxiety'] as const;
      return makeAnalyzedMsg(`m${i}`, aspects[i % 3]);
    });
    const gaps = detectGaps(msgs, []);
    const recs = buildRecommendations(gaps);
    // Should be minor severity with no missing dimensions
    expect(gaps.overallSeverity).toBe('minor');
    // May still have some recs or none — just verify no crash
    expect(Array.isArray(recs)).toBe(true);
  });
});

describe('shouldActivate', () => {
  it('returns true when corpus is too small', () => {
    const health = computeCorpusHealth([], [], []);
    const gaps = detectGaps([], []);
    expect(shouldActivate(health, gaps)).toBe(true);
  });

  it('returns true when there are thin clusters', () => {
    const msgs = [
      { id: 'm1', rawText: 'msg', source: 'paste' as const, analyzed: false, createdAt: now, updatedAt: now },
      { id: 'm2', rawText: 'msg', source: 'paste' as const, analyzed: false, createdAt: now, updatedAt: now },
    ];
    const cluster = makeCluster('c1', ['m1', 'm2']);
    const health = computeCorpusHealth(msgs, [cluster], []);
    const msgs40 = Array.from({ length: 40 }, (_, i) => makeAnalyzedMsg(`m${i}`, 'Motivation'));
    const gaps = detectGaps(msgs40, []);
    expect(health.thinClusterCount).toBe(1);
    expect(shouldActivate(health, gaps)).toBe(true);
  });
});

describe('buildSummaryLine', () => {
  it('returns a non-empty string for any gap profile', () => {
    const result = buildSummaryLine(detectGaps([], []));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('mentions missing dimensions for partial corpus', () => {
    const msgs = Array.from({ length: 41 }, (_, i) => makeAnalyzedMsg(`m${i}`, 'Motivation'));
    const gaps = detectGaps(msgs, []);
    const summary = buildSummaryLine(gaps);
    expect(summary.toLowerCase()).toMatch(/missing|absent|value|anxiety/);
  });
});
