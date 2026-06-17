import { describe, it, expect } from 'vitest';
import { getNextBestAction } from '../services/nextBestActionService';
import type { Avatar } from '../types';

describe('nextBestActionService', () => {
  it('suggests adding evidence when corpus is small', () => {
    const action = getNextBestAction({
      avatars: [],
      messageCount: 2,
      analyzedMessageCount: 0,
      validatedClusterCount: 0,
      proposedClusterCount: 0,
    });
    expect(action.id).toBe('add-evidence');
    expect(action.targetTab).toBe('evidence');
  });

  it('suggests analyzing the corpus once enough evidence exists', () => {
    const action = getNextBestAction({
      pipelineState: { phase: 'company_complete' } as any,
      avatars: [],
      messageCount: 8,
      analyzedMessageCount: 0,
      validatedClusterCount: 0,
      proposedClusterCount: 0,
    });
    expect(action.id).toBe('analyze-corpus');
  });

  it('suggests reviewing segments when clusters are proposed but unvalidated', () => {
    const action = getNextBestAction({
      pipelineState: { phase: 'clusters_proposed' } as any,
      avatars: [],
      messageCount: 8,
      analyzedMessageCount: 8,
      validatedClusterCount: 0,
      proposedClusterCount: 3,
    });
    expect(action.id).toBe('review-segments');
    expect(action.targetTab).toBe('segments');
  });

  it('suggests generating avatars once segments are validated', () => {
    const action = getNextBestAction({
      pipelineState: { phase: 'clusters_validated' } as any,
      avatars: [],
      messageCount: 8,
      analyzedMessageCount: 8,
      validatedClusterCount: 2,
      proposedClusterCount: 0,
    });
    expect(action.id).toBe('generate-avatars');
  });

  it('suggests deep-diving the highest-confidence avatar', () => {
    const avatars: Avatar[] = [
      { id: 'a1', name: 'Alpha', score: 0.5 } as Avatar,
      { id: 'a2', name: 'Beta', score: 0.9 } as Avatar,
    ];
    const action = getNextBestAction({
      pipelineState: { phase: 'segments_materialized' } as any,
      avatars,
      messageCount: 8,
      analyzedMessageCount: 8,
      validatedClusterCount: 2,
      proposedClusterCount: 0,
    });
    expect(action.id).toBe('deep-dive-avatar');
    expect(action.title).toContain('Beta');
  });

  it('reports all caught up when there is nothing else to do', () => {
    const avatars: Avatar[] = [
      { id: 'a1', name: 'Alpha', score: 0.9, demographics: {} as any } as Avatar,
    ];
    const action = getNextBestAction({
      pipelineState: { phase: 'pipeline_complete' } as any,
      avatars,
      messageCount: 8,
      analyzedMessageCount: 8,
      validatedClusterCount: 2,
      proposedClusterCount: 0,
    });
    expect(['view-strategy', 'all-caught-up']).toContain(action.id);
  });
});
