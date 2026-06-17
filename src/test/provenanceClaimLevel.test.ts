import { describe, it, expect } from 'vitest';
import { resolveClaimProvenance } from '../lib/provenanceResolver';
import type { Avatar } from '../types';
import type { Cluster, EvidenceMessage } from '../types/pipeline';

const now = new Date().toISOString();

const msgs: EvidenceMessage[] = [
  {
    id: 'msg_1', rawText: 'worried about skin', source: 'paste', analyzed: true,
    analysis: { topic: 'skin', conversionFormulaAspect: 'Anxiety', messageType: 'Uncertainty', qualityScore: 0.8 },
    clusterId: 'cl1', createdAt: now, updatedAt: now,
  },
  {
    id: 'msg_2', rawText: 'harness rubs under arms', source: 'paste', analyzed: true,
    analysis: { topic: 'skin', conversionFormulaAspect: 'Anxiety', messageType: 'Objection', qualityScore: 0.7 },
    clusterId: 'cl1', createdAt: now, updatedAt: now,
  },
  {
    id: 'msg_3', rawText: 'pressure on throat', source: 'paste', analyzed: true,
    analysis: { topic: 'safety', conversionFormulaAspect: 'Anxiety', messageType: 'Uncertainty', qualityScore: 0.9 },
    clusterId: 'cl1', createdAt: now, updatedAt: now,
  },
];

const cluster: Cluster = {
  id: 'cl1', companyId: 'co1', corpusVersion: 1, label: 'Skin Sensitivity',
  status: 'validated', messageIds: ['msg_1', 'msg_2', 'msg_3'], source: 'mining',
  validationStatus: 'validated', createdAt: now, updatedAt: now,
};

const avatar: Avatar = {
  id: 'av1', companyId: 'co1', name: 'Sensitive Owner', description: '',
  definingCharacteristic: '', visualDescriptor: '', category: 'Goals and Challenges',
  canHaveSubAvatars: false, clusterId: 'cl1',
  synthesis: {
    realPrimaryMotivation: {
      claim: 'Worried about skin irritation from harness',
      supportingMessageIds: ['msg_1', 'msg_2', 'msg_3'],
      confidence: 0.9,
    },
    realPrimaryBlocker: 'Cannot find a harness that fits properly',
    actualBuyingWindow: {
      claim: 'After visible skin irritation',
      supportingMessageIds: ['msg_1'],
      confidence: 0.55,
    },
    winningApproach: {
      claim: 'Lead with comfort guarantee',
      supportingMessageIds: [],
      confidence: 0.3,
    },
    uniqueInsight: {
      claim: 'Safety fear drives purchase more than aesthetics',
      supportingMessageIds: ['msg_3'],
      confidence: 0.6,
    },
    messagesToUse: [], messagesToAvoid: [], conflictsResolved: [], confidenceScore: 0.75,
  } as any,
};

describe('resolveClaimProvenance', () => {
  it('returns one item per synthesis claim field with text', () => {
    const items = resolveClaimProvenance(avatar, msgs, [cluster]);
    expect(items.length).toBeGreaterThanOrEqual(4);
  });

  it('high-confidence claim has quotes resolved from supportingMessageIds', () => {
    const items = resolveClaimProvenance(avatar, msgs, [cluster]);
    const motivation = items.find(i => i.fieldPath === 'synthesis.realPrimaryMotivation');
    expect(motivation).toBeDefined();
    expect(motivation?.quotes).toHaveLength(3);
    expect(motivation?.confidence).toBe(0.9);
    expect(motivation?.lowConfidence).toBe(false);
  });

  it('plain string field is marked lowConfidence', () => {
    const items = resolveClaimProvenance(avatar, msgs, [cluster]);
    const blocker = items.find(i => i.fieldPath === 'synthesis.realPrimaryBlocker');
    expect(blocker).toBeDefined();
    expect(blocker?.lowConfidence).toBe(true);
  });

  it('claim with empty supportingMessageIds falls back to cluster messages', () => {
    const items = resolveClaimProvenance(avatar, msgs, [cluster]);
    const approach = items.find(i => i.fieldPath === 'synthesis.winningApproach');
    expect(approach).toBeDefined();
    // Falls back to cluster messages when sourceIds is empty
    expect(approach?.quotes.length).toBeGreaterThan(0);
  });

  it('returns empty array when avatar has no synthesis', () => {
    const noSynthesisAvatar: Avatar = { ...avatar, synthesis: undefined };
    const items = resolveClaimProvenance(noSynthesisAvatar, msgs, [cluster]);
    expect(items).toEqual([]);
  });

  it('each returned item has required fields', () => {
    const items = resolveClaimProvenance(avatar, msgs, [cluster]);
    for (const item of items) {
      expect(item).toHaveProperty('fieldPath');
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('claim');
      expect(item).toHaveProperty('quotes');
    }
  });
});
