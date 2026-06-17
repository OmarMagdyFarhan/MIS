import { describe, it, expect, vi } from 'vitest';
import { analyzeAvatarGaps } from '../services/gapAnalysisService';
import type { Avatar } from '../types';

vi.mock('../services/clusterIntegrityService', () => ({
  analyzeClusterIntegrity: vi.fn(() => ({ isPure: true })),
}));

const wellCitedAvatar: Partial<Avatar> = {
  id: 'av1', name: 'Sensitive Skin Owner', companyId: 'co1',
  description: '', definingCharacteristic: '', visualDescriptor: '',
  category: 'Goals and Challenges', canHaveSubAvatars: false,
  evidenceSnapshot: { confidenceScore: 0.85, messageCount: 15,
    clusterCohesion: 0.8, representativeQuotes: [], aspectDistribution: {}, corpusVersion: 1, recordedAt: '' },
  synthesis: {
    realPrimaryMotivation: { claim: 'Worried about skin', supportingMessageIds: ['m1','m2','m3'], confidence: 0.9 },
    realPrimaryBlocker:    { claim: 'No soft options',   supportingMessageIds: ['m4','m5','m6'], confidence: 0.85 },
    actualBuyingWindow:    { claim: 'After irritation',  supportingMessageIds: ['m7','m8','m9'], confidence: 0.8 },
    winningApproach:       { claim: 'Comfort guarantee', supportingMessageIds: ['m10','m11','m12'], confidence: 0.82 },
    uniqueInsight:         { claim: 'Safety > aesthetics', supportingMessageIds: ['m13','m14','m15'], confidence: 0.88 },
    messagesToUse: [], messagesToAvoid: [], conflictsResolved: [], confidenceScore: 0.85,
  } as any,
};

const weakAvatar: Partial<Avatar> = {
  id: 'av2', name: 'Weak Avatar', companyId: 'co1',
  description: '', definingCharacteristic: '', visualDescriptor: '',
  category: 'Goals and Challenges', canHaveSubAvatars: false,
  synthesis: {
    realPrimaryMotivation: 'Plain string — no citations',
    realPrimaryBlocker: { claim: 'Only one message', supportingMessageIds: ['m1'], confidence: 0.4 },
    actualBuyingWindow: undefined, winningApproach: undefined, uniqueInsight: undefined,
    messagesToUse: [], messagesToAvoid: [], conflictsResolved: [], confidenceScore: 0.3,
  } as any,
};

describe('analyzeAvatarGaps', () => {
  it('returns isReadyForCampaign=true for well-cited avatar', () => {
    const report = analyzeAvatarGaps(wellCitedAvatar as Avatar, undefined, []);
    expect(report.isReadyForCampaign).toBe(true);
    expect(report.gaps).toHaveLength(0);
  });

  it('returns gaps for weak avatar', () => {
    const report = analyzeAvatarGaps(weakAvatar as Avatar, undefined, []);
    expect(report.isReadyForCampaign).toBe(false);
    expect(report.gaps.length).toBeGreaterThan(0);
  });

  it('includes missing fields as gaps', () => {
    const report = analyzeAvatarGaps(weakAvatar as Avatar, undefined, []);
    const paths = report.gaps.map(g => g.fieldPath);
    expect(paths).toContain('synthesis.actualBuyingWindow');
  });

  it('totalMissingMessages is sum of needed messages', () => {
    const report = analyzeAvatarGaps(weakAvatar as Avatar, undefined, []);
    expect(report.totalMissingMessages).toBeGreaterThan(0);
  });
});
