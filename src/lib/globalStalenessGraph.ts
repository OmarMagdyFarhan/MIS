/**
 * Global Staleness Propagation Graph
 *
 * A single function that computes which artifact layers become stale
 * when a given layer changes. Uses the ArtifactRegistry as the source
 * of truth — no hardcoded adjacency lists.
 *
 * This replaces per-store staleness logic with one authoritative graph.
 */

import { getDownstreamChain, type ArtifactType } from './artifactRegistry';
import { usePipelineStore } from '../stores/pipelineStore';
import type { ArtifactLayer } from '../types/pipeline';

const ARTIFACT_TO_LAYER: Partial<Record<ArtifactType, ArtifactLayer>> = {
  cluster:             'clusters',
  avatar:              'avatars',
  market_intelligence: 'market_intel',
  avatar_offer:        'avatar_offers',};

/**
 * Propagate staleness from a changed artifact to all downstream artifacts.
 * Calls pipelineStore.markLayerStale for each affected layer.
 */
export function propagateStaleness(companyId: string, changedArtifact: ArtifactType): void {
  const downstream = getDownstreamChain(changedArtifact);
  for (const artifact of downstream) {
    const layer = ARTIFACT_TO_LAYER[artifact];
    if (layer) {
      usePipelineStore.getState().markLayerStale(companyId, layer);
    }
  }
}

/**
 * Returns a human-readable staleness impact report.
 * Used in the Developer Mode panel.
 */
export function getStalenessImpact(changedArtifact: ArtifactType): string[] {
  return getDownstreamChain(changedArtifact).map(a => {
    const layer = ARTIFACT_TO_LAYER[a];
    return layer ? `${a} (layer: ${layer})` : a;
  });
}
