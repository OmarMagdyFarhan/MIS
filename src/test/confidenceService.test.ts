import { describe, it, expect } from 'vitest';
import { computeClusterCohesion, computeCorpusConfidence, computeOfferAlignment, computeAspectConfidence, computeMessageQuality }
  from '../services/confidenceService';
import { PIPELINE_THRESHOLDS } from '../constants/pipelineThresholds';
import type { EvidenceMessage, Cluster } from '../types/pipeline';

const now = new Date().toISOString();

function makeMsg(id: string, topic: string, aspect = 'Anxiety' as const,
  clusterId?: string): EvidenceMessage {
  return {
    id, rawText: `Message ${id} with sufficient length for quality threshold`, source: 'paste',
    analyzed: true,
    analysis: { topic, conversionFormulaAspect: aspect, messageType: 'Uncertainty', qualityScore: 0.7 },
    clusterId: clusterId ?? null, createdAt: now, updatedAt: now,
  };
}

function makeCluster(id: string, msgIds: string[], cohesion?: number): Cluster {
  return {
    id, companyId: 'co1', corpusVersion: 1, label: id,
    status: 'validated', messageIds: msgIds, source: 'mining',
    validationStatus: 'validated', cohesionScore: cohesion,
    createdAt: now, updatedAt: now,
  };
}

describe('computeClusterCohesion', () => {
  it('returns 0 for empty cluster', () =>
    expect(computeClusterCohesion(makeCluster('c', []), [])).toBe(0));
  it('returns 0.45 for single-member cluster', () => {
    const msg = makeMsg('m1', 'onboarding');
    expect(computeClusterCohesion(makeCluster('c', ['m1']), [msg])).toBe(0.45);
  });
  it('returns higher score for same-topic messages', () => {
    const msgs = [makeMsg('m1','onboarding'), makeMsg('m2','onboarding'), makeMsg('m3','onboarding')];
    const score = computeClusterCohesion(makeCluster('c', ['m1','m2','m3']), msgs);
    expect(score).toBeGreaterThan(0.5);
  });
  it('returns lower score for diverse topics', () => {
    const msgs = [makeMsg('m1','pricing'), makeMsg('m2','support'), makeMsg('m3','shipping')];
    const homogeneous = [makeMsg('a1','pricing'), makeMsg('a2','pricing'), makeMsg('a3','pricing')];
    const diverse = computeClusterCohesion(makeCluster('c', ['m1','m2','m3']), msgs);
    const homog = computeClusterCohesion(makeCluster('c', ['a1','a2','a3']), homogeneous);
    expect(diverse).toBeLessThan(homog);
  });
});

describe('computeCorpusConfidence', () => {
  it('returns provisional status for low volume', () => {
    const msgs = [makeMsg('m1','topic')];
    const result = computeCorpusConfidence(msgs, [], 'evidence_first');
    expect(result.status).toBe('provisional');
  });
  it('overall is between 0 and 1', () => {
    const msgs = Array.from({length: 10}, (_,i) => makeMsg(`m${i}`, 'topic'));
    const result = computeCorpusConfidence(msgs, [], 'hybrid');
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(1);
  });
  it('bootstrap mode caps overall at BOOTSTRAP_CONFIDENCE_CAP', () => {
    const msgs = Array.from({length: 50}, (_,i) => makeMsg(`m${i}`, 'topic'));
    const clusters = [makeCluster('c1', msgs.slice(0,10).map(m=>m.id), 0.9)];
    const r = computeCorpusConfidence(msgs, clusters, 'bootstrap');
    expect(r.overall).toBeLessThanOrEqual(PIPELINE_THRESHOLDS.BOOTSTRAP_CONFIDENCE_CAP + 0.001);
  });
});

describe('computeOfferAlignment', () => {
  it('returns 0.35 when no messages', () => {
    const formula = { audience:'A', product:'P', transformation:'before after', reasonToActNow:'now', specificity:'S' };
    expect(computeOfferAlignment(formula, [])).toBe(0.35);
  });
  it('returns higher score when messages match formula keywords', () => {
    const formula = { audience:'A', product:'P', transformation:'transform growth', reasonToActNow:'limited offer', specificity:'S' };
    const msgs = [
      makeMsg('m1', 'growth', 'Anxiety', 'c1'),
      makeMsg('m2', 'transform', 'Anxiety', 'c1'),
    ];
    const score = computeOfferAlignment(formula, msgs, 'c1');
    expect(score).toBeGreaterThan(0.35);
  });
});

// ── Issue 5: computeAvatarReadinessScore relevance tests ─────────────────────

import { computeAvatarReadinessScore } from '../constants/pipelineThresholds';

describe('computeAvatarReadinessScore (Issue 5)', () => {
  it('with low relevance returns lower score than high relevance', () => {
    const high = computeAvatarReadinessScore(10, 0.8, 3, 3, 1.0);
    const low  = computeAvatarReadinessScore(10, 0.8, 3, 3, 0.2);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('with relevance below 0.6 adds a gap message about relevance', () => {
    const result = computeAvatarReadinessScore(10, 0.8, 3, 3, 0.2);
    expect(result.gaps.some(g => g.toLowerCase().includes('relevant'))).toBe(true);
  });

  it('backward compat — missing relevance defaults to 1.0 (no penalty)', () => {
    const withDefault  = computeAvatarReadinessScore(10, 0.8, 3, 3);
    const withExplicit = computeAvatarReadinessScore(10, 0.8, 3, 3, 1.0);
    expect(withDefault.score).toBe(withExplicit.score);
  });

  it('relevance=0 gives minimum relevance contribution', () => {
    const result = computeAvatarReadinessScore(10, 0.8, 3, 3, 0);
    expect(result.breakdown.relevancePoints).toBe(0);
  });

  it('relevance=1.0 gives maximum relevance contribution of 20', () => {
    const result = computeAvatarReadinessScore(10, 0.8, 3, 3, 1.0);
    expect(result.breakdown.relevancePoints).toBe(20);
  });
});


// ── Task 4: computeAspectConfidence tests ─────────────────────────────────────

describe('computeAspectConfidence', () => {
  it('returns 0 for empty allMessages', () => {
    expect(computeAspectConfidence('motivation', [], [])).toBe(0);
  });

  it('returns floor value for 0 matching messages (non-empty corpus)', () => {
    const all = ['msg1', 'msg2', 'msg3', 'msg4'];
    // floor for motivation is 0.30
    const result = computeAspectConfidence('motivation', all, []);
    expect(result).toBe(0.30);
  });

  it('returns at least the floor for each aspect type', () => {
    const all = ['msg1', 'msg2', 'msg3'];
    expect(computeAspectConfidence('motivation', all, [])).toBeGreaterThanOrEqual(0.30);
    expect(computeAspectConfidence('value', all, [])).toBeGreaterThanOrEqual(0.28);
    expect(computeAspectConfidence('anxiety', all, [])).toBeGreaterThanOrEqual(0.25);
    expect(computeAspectConfidence('trigger', all, [])).toBeGreaterThanOrEqual(0.20);
  });

  it('is clamped below each aspect ceiling', () => {
    const all = ['m1', 'm2'];
    // Full coverage should hit ceiling
    expect(computeAspectConfidence('motivation', all, all)).toBeLessThanOrEqual(0.92);
    expect(computeAspectConfidence('anxiety', all, all)).toBeLessThanOrEqual(0.88);
    expect(computeAspectConfidence('trigger', all, all)).toBeLessThanOrEqual(0.85);
  });

  it('anxiety scores higher than motivation for same raw coverage ratio (different multipliers)', () => {
    const all = Array.from({ length: 10 }, (_, i) => 'msg' + i);
    const matching = all.slice(0, 2); // 20% coverage
    const anxiety = computeAspectConfidence('anxiety', all, matching);
    const motivation = computeAspectConfidence('motivation', all, matching);
    // anxiety multiplier 3.5 > motivation multiplier 3.0
    expect(anxiety).toBeGreaterThanOrEqual(motivation);
  });

  it('higher coverage ratio produces higher confidence', () => {
    const all = Array.from({ length: 20 }, (_, i) => 'msg' + i);
    const low = computeAspectConfidence('motivation', all, all.slice(0, 2));
    const high = computeAspectConfidence('motivation', all, all.slice(0, 15));
    expect(high).toBeGreaterThan(low);
  });
});

// ── Task 4: computeMessageQuality tests ─────────────────────────────────────

describe('computeMessageQuality', () => {
  it('returns 0 for empty text with no analysis', () => {
    const result = computeMessageQuality('', {});
    expect(result).toBe(0);
  });

  it('returns value between 0 and 1 for any input', () => {
    const inputs = [
      { text: '', analysis: {} },
      { text: 'short', analysis: {} },
      { text: 'A much longer customer review with many words describing real problems', analysis: { conversionSignalTags: ['pain'], topic: 'productivity issues' } },
    ];
    inputs.forEach(({ text, analysis }) => {
      const r = computeMessageQuality(text, analysis);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    });
  });

  it('gives higher score for longer text (up to 200 chars)', () => {
    const short = computeMessageQuality('short text', {});
    const long = computeMessageQuality('A ' + 'word '.repeat(40), {});
    expect(long).toBeGreaterThan(short);
  });

  it('awards bonus for text > 200 chars', () => {
    const base = computeMessageQuality('word '.repeat(40), {});
    const bonus = computeMessageQuality('word '.repeat(40), { topic: 'this is a long specific topic phrase' });
    expect(bonus).toBeGreaterThanOrEqual(base);
  });

  it('awards bonus for conversion signal tags', () => {
    const noTags = computeMessageQuality('some text of decent length to pass length check properly here', {});
    const withTags = computeMessageQuality('some text of decent length to pass length check properly here', { conversionSignalTags: ['tag1', 'tag2'] });
    expect(withTags).toBeGreaterThan(noTags);
  });

  it('specificity bonus applies when topic has more than 3 words', () => {
    const shortTopic = computeMessageQuality('medium length text to test topic bonus here', { topic: 'a b c' });
    const longTopic = computeMessageQuality('medium length text to test topic bonus here', { topic: 'a longer specific topic phrase' });
    expect(longTopic).toBeGreaterThanOrEqual(shortTopic);
  });
});