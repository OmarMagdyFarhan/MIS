import { describe, it, expect } from 'vitest';
import {
  ARTIFACT_REGISTRY,
  getUpstreamChain,
  getDownstreamChain,
  type ArtifactType,
} from '../lib/artifactRegistry';

describe('ARTIFACT_REGISTRY', () => {
  it('all artifact types are registered', () => {
    const expected: ArtifactType[] = [
      'corpus_message', 'cluster', 'avatar', 'market_intelligence',
      'avatar_offer', 'foundation_answer', 'alignment_report',
    ];
    for (const type of expected) {
      expect(ARTIFACT_REGISTRY[type]).toBeDefined();
    }
  });

  it('corpus_message has no inputs (it is the root)', () => {
    expect(ARTIFACT_REGISTRY.corpus_message.inputs).toHaveLength(0);
  });

  it('alignment_report is marked derivedNotStored', () => {
    expect(ARTIFACT_REGISTRY.alignment_report.derivedNotStored).toBe(true);
  });

  it('every artifact has a non-empty owner string', () => {
    for (const descriptor of Object.values(ARTIFACT_REGISTRY)) {
      expect(descriptor.owner).toBeTruthy();
    }
  });

  it('foundation_answer does not require provenance (user-validated)', () => {
    expect(ARTIFACT_REGISTRY.foundation_answer.requiresProvenance).toBe(false);
  });

  it('cluster requires provenance (evidence-derived)', () => {
    expect(ARTIFACT_REGISTRY.cluster.requiresProvenance).toBe(true);
  });
});

describe('getUpstreamChain', () => {  it('corpus_message has empty upstream chain', () => {
    expect(getUpstreamChain('corpus_message')).toHaveLength(0);
  });

  it('does not include the type itself in its own upstream', () => {
    const chain = getUpstreamChain('avatar');
    expect(chain).not.toContain('avatar');
  });
});

describe('getDownstreamChain', () => {
  it('corpus_message changes make clusters stale', () => {
    const downstream = getDownstreamChain('corpus_message');
    expect(downstream).toContain('cluster');
  });

  it('avatar changes make avatar_offer stale', () => {
    const downstream = getDownstreamChain('avatar');
    expect(downstream).toContain('avatar_offer');
  });  it('alignment_report has no downstream (it is a terminal artifact)', () => {
    const downstream = getDownstreamChain('alignment_report');
    expect(downstream).toHaveLength(0);
  });
});
