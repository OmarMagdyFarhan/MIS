import { describe, it, expect } from 'vitest';
import {
  analyzeClusterIntegrity,
  splitClusterByAspect,
} from '../services/clusterIntegrityService';
import type { Cluster, EvidenceMessage } from '../types/pipeline';

const now = new Date().toISOString();

function makeCluster(id: string, msgIds: string[], cohesion?: number): Cluster {
  return {
    id, companyId: 'co1', corpusVersion: 1, label: 'Test',
    status: 'validated', messageIds: msgIds, source: 'mining',
    validationStatus: 'provisional', cohesionScore: cohesion,
    createdAt: now, updatedAt: now,
  };
}

function makeMsg(id: string, aspect: string): EvidenceMessage {
  return {
    id, rawText: `Evidence message ${id}`, source: 'paste', analyzed: true,
    analysis: {
      topic: `topic_${aspect}`, conversionFormulaAspect: aspect as any,
      messageType: 'Uncertainty', qualityScore: 0.7,
    },
    clusterId: 'cl1', createdAt: now, updatedAt: now,
  };
}

describe('analyzeClusterIntegrity', () => {
  it('marks pure cluster as isPure when all messages same aspect', () => {
    const msgs = ['m1', 'm2', 'm3'].map(id => makeMsg(id, 'Anxiety'));
    const cluster = makeCluster('cl1', msgs.map(m => m.id), 0.8);
    const report = analyzeClusterIntegrity(cluster, msgs);
    expect(report.isPure).toBe(true);
    expect(report.splitRecommended).toBe(false);
  });

  it('flags mixed cluster with 3 different aspects', () => {
    const msgs = [
      makeMsg('m1', 'Anxiety'), makeMsg('m2', 'Anxiety'),
      makeMsg('m3', 'Friction'), makeMsg('m4', 'Friction'),
      makeMsg('m5', 'Value'), makeMsg('m6', 'Value'),
    ];
    const cluster = makeCluster('cl1', msgs.map(m => m.id), 0.2);
    const report = analyzeClusterIntegrity(cluster, msgs);
    expect(report.isPure).toBe(false);
    expect(report.splitRecommended).toBe(true);
    expect(report.signalGroups).toHaveLength(3);
  });

  it('does not recommend split for small clusters', () => {
    const msgs = [makeMsg('m1', 'Anxiety'), makeMsg('m2', 'Friction')];
    const cluster = makeCluster('cl1', msgs.map(m => m.id), 0.1);
    const report = analyzeClusterIntegrity(cluster, msgs);
    expect(report.splitRecommended).toBe(false); // < 4 messages
  });

  it('returns cohesionScore from cluster', () => {
    const msgs = ['m1', 'm2', 'm3'].map(id => makeMsg(id, 'Trust'));
    const cluster = makeCluster('cl1', msgs.map(m => m.id), 0.75);
    const report = analyzeClusterIntegrity(cluster, msgs);
    expect(report.cohesionScore).toBe(0.75);
  });

  it('returns reason string for impure clusters', () => {
    const msgs = [
      makeMsg('m1', 'Anxiety'), makeMsg('m2', 'Anxiety'),
      makeMsg('m3', 'Motivation'), makeMsg('m4', 'Motivation'),
    ];
    const cluster = makeCluster('cl1', msgs.map(m => m.id), 0.1);
    const report = analyzeClusterIntegrity(cluster, msgs);
    expect(report.isPure).toBe(false);
    expect(report.reason).toBeTruthy();
  });
});

describe('splitClusterByAspect', () => {
  it('creates one cluster per signal group', () => {
    const msgs = [
      makeMsg('m1', 'Anxiety'), makeMsg('m2', 'Anxiety'),
      makeMsg('m3', 'Friction'), makeMsg('m4', 'Friction'),
    ];
    const cluster = makeCluster('cl1', msgs.map(m => m.id), 0.2);
    const report = analyzeClusterIntegrity(cluster, msgs);
    const splits = splitClusterByAspect(cluster, report, 2);
    expect(splits).toHaveLength(2);
    expect(splits[0].messageIds).toHaveLength(2);
    expect(splits[1].messageIds).toHaveLength(2);
  });

  it('all split clusters have provisional status', () => {
    const msgs = ['m1', 'm2', 'm3', 'm4'].map((id, i) =>
      makeMsg(id, i < 2 ? 'Anxiety' : 'Value')
    );
    const cluster = makeCluster('cl1', msgs.map(m => m.id), 0.1);
    const report = analyzeClusterIntegrity(cluster, msgs);
    const splits = splitClusterByAspect(cluster, report, 2);
    expect(splits.every(c => c.validationStatus === 'provisional')).toBe(true);
  });

  it('all split clusters have proposed status', () => {
    const msgs = ['m1', 'm2', 'm3', 'm4'].map((id, i) =>
      makeMsg(id, i < 2 ? 'Trust' : 'Urgency')
    );
    const cluster = makeCluster('cl1', msgs.map(m => m.id), 0.1);
    const report = analyzeClusterIntegrity(cluster, msgs);
    const splits = splitClusterByAspect(cluster, report, 2);
    expect(splits.every(c => c.status === 'proposed')).toBe(true);
  });

  it('split clusters have unique ids', () => {
    const msgs = ['m1', 'm2', 'm3', 'm4'].map((id, i) =>
      makeMsg(id, i < 2 ? 'Anxiety' : 'Friction')
    );
    const cluster = makeCluster('cl1', msgs.map(m => m.id), 0.1);
    const report = analyzeClusterIntegrity(cluster, msgs);
    const splits = splitClusterByAspect(cluster, report, 2);
    const ids = splits.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
