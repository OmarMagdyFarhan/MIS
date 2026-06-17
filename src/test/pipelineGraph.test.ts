import { describe, it, expect } from 'vitest';
import { markStale, intentAffectsLayers, pipelinePhaseToLegacyFlags,
         isStageUnlockedForPipeline, EMPTY_STALE } from '../lib/pipelineGraph';

describe('markStale', () => {
  it('does not mutate input', () => {
    const prev = { ...EMPTY_STALE };
    markStale(prev, 'clusters');
    expect(prev.clusters).toBe(false);
  });
});

describe('intentAffectsLayers', () => {
  it('analyze_corpus affects messages', () =>
    expect(intentAffectsLayers('analyze_corpus')).toContain('messages'));
  it('propose_clusters affects clusters', () =>
    expect(intentAffectsLayers('propose_clusters')).toContain('clusters'));
});

describe('pipelinePhaseToLegacyFlags', () => {
  it('company_complete: all false except stage1Complete', () => {
    const f = pipelinePhaseToLegacyFlags('company_complete');
    expect(f.stage1Complete).toBe(true);
    expect(f.stage2Complete).toBe(false);
    expect(f.stage3Complete).toBe(false);
  });
});
