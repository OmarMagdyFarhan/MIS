import { describe, it, expect } from 'vitest';
import {
  computeAvatarLifecycle,
  buildEvidenceSnapshot,
  computeConfidenceDelta,
} from '../services/avatarEvolutionService';
import type { Cluster, EvidenceMessage } from '../types/pipeline';
import type { Avatar } from '../types';

const now = new Date().toISOString();

function makeCluster(overrides: Partial<Cluster> = {}): Cluster {
  return {
    id: 'cl1',
    companyId: 'co1',
    corpusVersion: 1,
    label: 'Test',
    status: 'validated',
    messageIds: [],
    source: 'mining',
    validationStatus: 'provisional',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMsg(id: string): EvidenceMessage {
  return {
    id,
    rawText: `Real customer message ${id} about product quality`,
    source: 'paste',
    analyzed: true,
    analysis: {
      topic: 'quality',
      conversionFormulaAspect: 'Anxiety',
      messageType: 'Uncertainty',
      qualityScore: 0.7,
    },
    clusterId: 'cl1',
    createdAt: now,
    updatedAt: now,
  };
}

describe('computeAvatarLifecycle', () => {
  it('returns emerging for fewer than 3 messages', () => {
    const cluster = makeCluster({ messageIds: ['m1', 'm2'] });
    expect(computeAvatarLifecycle({} as Avatar, cluster, [], 1)).toBe('emerging');
  });

  it('returns emerging for 3–9 messages without decline signals', () => {
    const ids = Array.from({ length: 5 }, (_, i) => `m${i}`);
    const cluster = makeCluster({ messageIds: ids });
    expect(computeAvatarLifecycle({} as Avatar, cluster, [], 1)).toBe('emerging');
  });

  it('returns active for 10+ messages with validated cluster', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `m${i}`);
    const cluster = makeCluster({ messageIds: ids, validationStatus: 'validated' });
    expect(computeAvatarLifecycle({} as Avatar, cluster, [], 1)).toBe('active');
  });

  it('returns declining when trendDirection is declining', () => {
    const ids = Array.from({ length: 15 }, (_, i) => `m${i}`);
    const cluster = makeCluster({ messageIds: ids, trendDirection: 'declining' });
    expect(computeAvatarLifecycle({} as Avatar, cluster, [], 1)).toBe('declining');
  });

  it('returns obsolete when count has not changed in last 3 versions', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `m${i}`);
    const cluster = makeCluster({
      messageIds: ids,
      messageCountHistory: [
        { corpusVersion: 1, count: 12, recordedAt: now },
        { corpusVersion: 2, count: 12, recordedAt: now },
        { corpusVersion: 3, count: 12, recordedAt: now },
      ],
    });
    expect(computeAvatarLifecycle({} as Avatar, cluster, [], 3)).toBe('obsolete');
  });
});

describe('buildEvidenceSnapshot', () => {
  it('includes representative quotes', () => {
    const msgs = Array.from({ length: 5 }, (_, i) => makeMsg(`m${i}`));
    const cluster = makeCluster({ messageIds: msgs.map(m => m.id) });
    const snap = buildEvidenceSnapshot(cluster, msgs, 1);
    expect(snap.representativeQuotes.length).toBeGreaterThan(0);
    expect(snap.messageCount).toBe(5);
  });

  it('confidence score is between 0 and 1', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => makeMsg(`m${i}`));
    const cluster = makeCluster({ messageIds: msgs.map(m => m.id) });
    const snap = buildEvidenceSnapshot(cluster, msgs, 1);
    expect(snap.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(snap.confidenceScore).toBeLessThanOrEqual(1);
  });

  it('aspect distribution counts correctly', () => {
    const msgs = Array.from({ length: 4 }, (_, i) => makeMsg(`m${i}`));
    const cluster = makeCluster({ messageIds: msgs.map(m => m.id) });
    const snap = buildEvidenceSnapshot(cluster, msgs, 1);
    expect(snap.aspectDistribution['Anxiety']).toBe(4);
  });

  it('returns empty representativeQuotes when all messages are too short', () => {
    const shortMsgs: EvidenceMessage[] = [
      { id: 's1', rawText: 'ok', source: 'paste', analyzed: true, analysis: { topic: 't', conversionFormulaAspect: 'Friction', messageType: 'Uncertainty', qualityScore: 0.5 }, clusterId: 'cl1', createdAt: now, updatedAt: now },
    ];
    const cluster = makeCluster({ messageIds: ['s1'] });
    const snap = buildEvidenceSnapshot(cluster, shortMsgs, 1);
    expect(snap.representativeQuotes).toHaveLength(0);
  });

  it('records the corpusVersion', () => {
    const msgs = Array.from({ length: 3 }, (_, i) => makeMsg(`m${i}`));
    const cluster = makeCluster({ messageIds: msgs.map(m => m.id) });
    const snap = buildEvidenceSnapshot(cluster, msgs, 7);
    expect(snap.corpusVersion).toBe(7);
  });
});

describe('computeConfidenceDelta', () => {
  it('returns stable when no previous snapshot', () => {
    const snap = buildEvidenceSnapshot(makeCluster({ messageIds: ['m1'] }), [makeMsg('m1')], 1);
    const result = computeConfidenceDelta(snap, undefined);
    expect(result.direction).toBe('stable');
    expect(result.delta).toBe(0);
  });

  it('returns up when confidence increased significantly', () => {
    const low = { confidenceScore: 0.3, messageCount: 5 } as any;
    const high = { confidenceScore: 0.7, messageCount: 15 } as any;
    const result = computeConfidenceDelta(high, low);
    expect(result.direction).toBe('up');
    expect(result.delta).toBeGreaterThan(0);
  });

  it('returns down when confidence decreased significantly', () => {
    const high = { confidenceScore: 0.8, messageCount: 20 } as any;
    const low = { confidenceScore: 0.3, messageCount: 5 } as any;
    const result = computeConfidenceDelta(low, high);
    expect(result.direction).toBe('down');
    expect(result.delta).toBeLessThan(0);
  });

  it('returns stable when delta is below threshold', () => {
    const a = { confidenceScore: 0.500, messageCount: 10 } as any;
    const b = { confidenceScore: 0.502, messageCount: 10 } as any;
    const result = computeConfidenceDelta(b, a);
    expect(result.direction).toBe('stable');
  });

  it('reason mentions message count when messages were added', () => {
    const prev = { confidenceScore: 0.4, messageCount: 5 } as any;
    const curr = { confidenceScore: 0.75, messageCount: 20 } as any;
    const result = computeConfidenceDelta(curr, prev);
    expect(result.reason).toMatch(/\+15/);
  });
});
