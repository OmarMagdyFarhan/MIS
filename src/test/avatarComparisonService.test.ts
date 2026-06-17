import { describe, it, expect } from 'vitest';
import { compareAvatars } from '../services/avatarComparisonService';
import type { Avatar } from '../types';

function makeAvatar(id: string, motivation: string, blocker: string): Partial<Avatar> {
  return {
    id, companyId: 'co1', name: id, description: '', definingCharacteristic: '',
    visualDescriptor: '', category: 'Goals and Challenges', canHaveSubAvatars: false,
    clusterId: `cl_${id}`,
    synthesis: {
      realPrimaryMotivation: { claim: motivation, supportingMessageIds: ['m1','m2','m3'], confidence: 0.8 },
      realPrimaryBlocker:    { claim: blocker,    supportingMessageIds: ['m4','m5','m6'], confidence: 0.75 },
      actualBuyingWindow: { claim: 'When pain peaks', supportingMessageIds: ['m7'], confidence: 0.6 },
      winningApproach:    { claim: 'Comfort first',   supportingMessageIds: ['m8'], confidence: 0.7 },
      uniqueInsight:      { claim: 'Safety matters',  supportingMessageIds: ['m9'], confidence: 0.65 },
      messagesToUse: [], messagesToAvoid: [], conflictsResolved: [], confidenceScore: 0.75,
    } as any,
  };
}

describe('compareAvatars', () => {
  it('returns 5 claim comparisons', () => {
    const a = makeAvatar('a1', 'Worried about skin', 'No soft options');
    const b = makeAvatar('b1', 'Needs better fit', 'Straps too loose');
    const report = compareAvatars(a as Avatar, b as Avatar, undefined, undefined, []);
    expect(report.claimComparisons).toHaveLength(5);
  });

  it('marks identical claims correctly', () => {
    const a = makeAvatar('a1', 'same claim', 'same blocker');
    const b = makeAvatar('b1', 'same claim', 'same blocker');
    const report = compareAvatars(a as Avatar, b as Avatar, undefined, undefined, []);
    const motComp = report.claimComparisons.find(c => c.fieldPath === 'synthesis.realPrimaryMotivation');
    expect(motComp?.divergenceType).toBe('identical');
  });

  it('returns a recommendedAction', () => {
    const a = makeAvatar('a1', 'Worried about skin', 'No soft options');
    const b = makeAvatar('b1', 'Needs better fit', 'Straps too loose');
    const report = compareAvatars(a as Avatar, b as Avatar, undefined, undefined, []);
    expect(['keep_both', 'consider_merge', 'review_split']).toContain(report.recommendedAction);
  });
});
