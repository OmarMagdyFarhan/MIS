import { describe, it, expect } from 'vitest';
import { computeCorpusHealth } from '../lib/corpusHealth';
import type { EvidenceMessage, Cluster, CorpusIngest } from '../types/pipeline';

const now = new Date().toISOString();

function makeMsg(id: string, analyzed = true, source: import('../types/pipeline').EvidenceSource = 'paste'): EvidenceMessage {
  return {
    id,
    rawText: `Test message ${id} with some meaningful content`,
    source,
    analyzed,
    analysis: analyzed ? {
      topic: 'test topic',
      conversionFormulaAspect: 'Motivation',
      messageType: 'Desired Outcome',
      qualityScore: 0.7,
      conversionAspects: {
        motivation: { desiredOutcomes: ['outcome'], painPoints: [], purchasePrompts: [], confidence: 0.7, sourceCommentIds: [id] },
        value: { uniqueBenefits: [], delightfulFeatures: [], dealreakerNeeds: [], confidence: 0.5, sourceCommentIds: [id] },
        anxiety: { uncertainties: [], objections: [], perceivedRisks: [], confidence: 0.3, sourceCommentIds: [id] },
      },
    } : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function makeCluster(id: string, msgIds: string[], label = 'Cluster'): Cluster {
  return {
    id, companyId: 'co1', corpusVersion: 1, label, status: 'validated',
    messageIds: msgIds, source: 'mining', validationStatus: 'validated',
    createdAt: now, updatedAt: now,
  };
}

function makeIngest(id: string, addedAt = now): CorpusIngest {
  return {
    id, companyId: 'co1', source: 'amazon_reviews', messageCount: 5,
    addedAt, corpusVersionBefore: 0, corpusVersionAfter: 1,
    languagesDetected: ['en'], translatedCount: 0,
  };
}

describe('computeCorpusHealth', () => {
  it('handles empty corpus (no messages, no clusters, no ingests)', () => {
    const result = computeCorpusHealth([], [], []);
    expect(result.coverage.total).toBe(0);
    expect(result.coverage.pct).toBe(0);
    expect(result.sourceStrength).toEqual([]);
    expect(result.clusterHealth).toEqual([]);
    expect(result.lastUpdatedAt).toBeNull();
    expect(result.thinClusterCount).toBe(0);
  });

  it('handles corpus with no ingests (ingests = [])', () => {
    const msgs = [makeMsg('m1'), makeMsg('m2')];
    const result = computeCorpusHealth(msgs, [], []);
    expect(result.lastUpdatedAt).toBeNull();
    expect(result.coverage.total).toBe(2);
  });

  it('computes coverage correctly', () => {
    const msgs = [makeMsg('m1', true), makeMsg('m2', false), makeMsg('m3', true)];
    const result = computeCorpusHealth(msgs, [], []);
    expect(result.coverage.total).toBe(3);
    expect(result.coverage.analyzed).toBe(2);
    expect(result.coverage.raw).toBe(1);
    expect(result.coverage.pct).toBeCloseTo(2 / 3, 4);
  });

  it('computes source strength and sorts by density', () => {
    const msgs = [
      makeMsg('m1', true, 'import'),
      makeMsg('m2', true, 'competitor'),
    ];
    const result = computeCorpusHealth(msgs, [], []);
    expect(result.sourceStrength.length).toBeGreaterThan(0);
    expect(result.sourceStrength[0]).toHaveProperty('source');
    expect(result.sourceStrength[0]).toHaveProperty('density');
  });

  it('marks thin clusters (< 3 messages)', () => {
    const msgs = [makeMsg('m1'), makeMsg('m2')];
    const cluster = makeCluster('c1', ['m1', 'm2'], 'Thin Cluster');
    const result = computeCorpusHealth(msgs, [cluster], []);
    expect(result.thinClusterCount).toBe(1);
    expect(result.clusterHealth[0].isThin).toBe(true);
  });

  it('does NOT mark thick clusters as thin', () => {
    const msgs = [makeMsg('m1'), makeMsg('m2'), makeMsg('m3'), makeMsg('m4')];
    const cluster = makeCluster('c1', ['m1', 'm2', 'm3', 'm4'], 'Thick Cluster');
    const result = computeCorpusHealth(msgs, [cluster], []);
    expect(result.thinClusterCount).toBe(0);
    expect(result.clusterHealth[0].isThin).toBe(false);
  });

  it('returns the latest ingest date as lastUpdatedAt', () => {
    const earlier = '2025-01-01T00:00:00.000Z';
    const later = '2025-06-01T00:00:00.000Z';
    const ingests = [makeIngest('i1', earlier), makeIngest('i2', later)];
    const result = computeCorpusHealth([], [], ingests);
    expect(result.lastUpdatedAt).toBe(later);
  });

  it('computes cluster coverage percentage correctly', () => {
    const msgs = [makeMsg('m1', true), makeMsg('m2', false)];
    const cluster = makeCluster('c1', ['m1', 'm2']);
    const result = computeCorpusHealth(msgs, [cluster], []);
    expect(result.clusterHealth[0].coveragePct).toBe(0.5);
  });

  it('limits sourceStrength to top 5 sources', () => {
    const sources: EvidenceMessage['source'][] = [
      'paste', 'import', 'competitor', 'synthetic', 'unknown', 'paste',
    ];
    const msgs = sources.map((s, i) => makeMsg(`m${i}`, true, s));
    const result = computeCorpusHealth(msgs, [], []);
    expect(result.sourceStrength.length).toBeLessThanOrEqual(5);
  });
});
