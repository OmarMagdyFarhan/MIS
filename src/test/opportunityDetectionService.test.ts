import { describe, it, expect } from 'vitest';
import { detectOpportunities } from '../services/opportunityDetectionService';
import type { Cluster, EvidenceMessage } from '../types/pipeline';
import type { Avatar } from '../types';

const now = new Date().toISOString();

function makeCluster(id: string, msgIds: string[], cohesion = 0.7): Cluster {
  return {
    id, companyId: 'co1', corpusVersion: 1, label: `Cluster ${id}`,
    status: 'validated', messageIds: msgIds, source: 'mining',
    validationStatus: 'validated', cohesionScore: cohesion,
    createdAt: now, updatedAt: now,
  };
}

function makeMsg(id: string, clusterId: string): EvidenceMessage {
  return {
    id, rawText: `Message ${id}`, source: 'paste', analyzed: true,
    analysis: { topic: 'test', conversionFormulaAspect: 'Anxiety', messageType: 'Uncertainty', qualityScore: 0.7 },
    clusterId, createdAt: now, updatedAt: now,
  };
}

const msgIds = Array.from({ length: 7 }, (_, i) => `m${i}`);
const msgs = msgIds.map(id => makeMsg(id, 'cl1'));
const cluster = makeCluster('cl1', msgIds, 0.7);

describe('detectOpportunities', () => {
  it('detects cluster with no avatar as opportunity', () => {
    const ops = detectOpportunities([cluster], [], msgs);
    expect(ops).toHaveLength(1);
    expect(ops[0].cluster.id).toBe('cl1');
  });

  it('ignores cluster that already has an avatar', () => {
    const avatar = { id: 'av1', clusterId: 'cl1', validationStatus: 'validated',
      acquisitionSource: 'mining' } as Partial<Avatar> as Avatar;
    const ops = detectOpportunities([cluster], [avatar], msgs);
    expect(ops).toHaveLength(0);
  });

  it('ignores low-message clusters', () => {
    const smallCluster = makeCluster('cl2', ['a', 'b'], 0.8);
    const smallMsgs = ['a', 'b'].map(id => makeMsg(id, 'cl2'));
    const ops = detectOpportunities([smallCluster], [], smallMsgs);
    expect(ops).toHaveLength(0);
  });

  it('sorts by opportunity score descending', () => {
    const msgIds2 = Array.from({ length: 10 }, (_, i) => `x${i}`);
    const msgs2 = msgIds2.map(id => makeMsg(id, 'cl2'));
    const cluster2 = makeCluster('cl2', msgIds2, 0.9);
    const ops = detectOpportunities([cluster, cluster2], [], [...msgs, ...msgs2]);
    expect(ops[0].opportunityScore).toBeGreaterThanOrEqual(ops[1].opportunityScore);
  });
});
