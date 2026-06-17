import { describe, it, expect } from 'vitest';
import { buildAspectBreakdown } from '../services/avatarService';
import type { EvidenceMessage } from '../types/pipeline';

const now = new Date().toISOString();
function makeMsg(id: string, aspect: string, subAspect?: string): EvidenceMessage {
  return {
    id, rawText: `Message ${id}`, source: 'paste', analyzed: true,
    analysis: {
      topic: 'test', conversionFormulaAspect: aspect as any,
      messageType: 'Uncertainty', qualityScore: 0.7,
      subAspect: subAspect as any,
    },
    clusterId: null, createdAt: now, updatedAt: now,
  };
}

describe('buildAspectBreakdown', () => {
  it('groups messages by aspect and counts correctly', () => {
    const msgs = [
      makeMsg('m1', 'Anxiety', 'Perceived Risk'),
      makeMsg('m2', 'Anxiety', 'Objection'),
      makeMsg('m3', 'Motivation', 'Desired Outcome'),
    ];
    const result = buildAspectBreakdown(msgs);
    expect(result).toContain('Anxiety: 2');
    expect(result).toContain('Motivation: 1');
  });

  it('returns no-messages message for empty input', () => {
    expect(buildAspectBreakdown([])).toContain('No analyzed messages');
  });

  it('includes sub-aspect breakdown', () => {
    const msgs = [
      makeMsg('m1', 'Anxiety', 'Perceived Risk'),
      makeMsg('m2', 'Anxiety', 'Perceived Risk'),
    ];
    const result = buildAspectBreakdown(msgs);
    expect(result).toContain('Perceived Risk (2)');
  });
});
