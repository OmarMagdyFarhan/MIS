import type { ArtifactLayer, PipelineIntent, StaleFlags } from '../types/pipeline';

const DOWNSTREAM: Record<ArtifactLayer, ArtifactLayer[]> = {
  corpus: ['messages', 'clusters', 'avatars', 'avatar_offers', 'market_intel', 'rendered_copy'],
  messages: ['clusters', 'avatars', 'avatar_offers', 'market_intel', 'rendered_copy'],
  clusters: ['avatars', 'avatar_offers', 'market_intel', 'rendered_copy'],
  avatars: ['avatar_offers', 'market_intel', 'rendered_copy'],
  avatar_offers: ['market_intel', 'rendered_copy'],
  market_intel: ['rendered_copy'],
  rendered_copy: [],
};

export const EMPTY_STALE: StaleFlags = {
  messages: false,
  clusters: false,
  avatars: false,
  avatarOffers: false,
  marketIntel: false,  renderedCopy: false,
};

export function markStale(prev: StaleFlags, layer: ArtifactLayer): StaleFlags {
  const next = { ...prev };
  const queue = [layer];
  const visited = new Set<ArtifactLayer>();

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const key = layerToStaleKey(current);
    if (key) next[key] = true;
    for (const child of DOWNSTREAM[current]) {
      queue.push(child);
    }
  }
  return next;
}

function layerToStaleKey(layer: ArtifactLayer): keyof StaleFlags | null {
  const map: Record<ArtifactLayer, keyof StaleFlags | null> = {
    corpus: null,
    messages: 'messages',
    clusters: 'clusters',
    avatars: 'avatars',
    avatar_offers: 'avatarOffers',
    market_intel: 'marketIntel',    rendered_copy: 'renderedCopy',
  };
  return map[layer];
}

export function intentAffectsLayers(intent: PipelineIntent): ArtifactLayer[] {
  switch (intent) {
    case 'analyze_corpus':
    case 'incremental_message_add':
      return ['messages'];
    case 'propose_clusters':
    case 'propose_clusters_delta':
      return ['clusters'];
    case 'materialize_avatars':
      return ['avatars'];
    case 'synthesize_avatar_offers':
      return ['avatar_offers'];
    case 'synthesize_market_intel':
      return ['market_intel'];
    case 'render_copy':
      return ['rendered_copy'];
    case 'full_downstream_from_clusters':
      return ['avatars', 'avatar_offers', 'market_intel', 'rendered_copy'];
    case 'legacy_mining_run':
      return ['messages', 'clusters', 'avatars', 'avatar_offers', 'market_intel'];
    default:
      return [];
  }
}

/** Map pipeline phase → legacy progress flags for backward-compatible UI */
export function pipelinePhaseToLegacyFlags(phase: import('../types/pipeline').PipelinePhase): {
  stage1Complete: boolean;
  stage2Complete: boolean;
  stage3Complete: boolean;
} {
  const order: import('../types/pipeline').PipelinePhase[] = [
    'company_complete',
    'corpus_active',
    'corpus_analyzed',
    'clusters_proposed',
    'clusters_validated',
    'segments_materialized',
    'avatar_offers_ready',
    'pipeline_complete',
    'copy_rendered',
  ];
  const idx = order.indexOf(phase);
  return {
    stage1Complete: idx >= 0,
    stage2Complete: idx >= order.indexOf('corpus_analyzed'),
    stage3Complete: idx >= order.indexOf('segments_materialized'),
  };
}

/** PhaseNav unlock: stage2 = evidence, stage3 = segments, stage4 = offers path */
export function isStageUnlockedForPipeline(
  stageId: string,
  phase: import('../types/pipeline').PipelinePhase
): boolean {
  const order: import('../types/pipeline').PipelinePhase[] = [
    'company_complete',
    'corpus_active',
    'corpus_analyzed',
    'clusters_proposed',
    'clusters_validated',
    'segments_materialized',
    'avatar_offers_ready',
    'pipeline_complete',
    'copy_rendered',
  ];
  const idx = order.indexOf(phase);
  if (stageId === 'stage1') return true;
  if (stageId === 'stage2') return idx >= order.indexOf('company_complete');
  if (stageId === 'stage3') return idx >= order.indexOf('clusters_validated');
  if (stageId === 'stage4') return idx >= order.indexOf('avatar_offers_ready');
  if (stageId === 'stage5') return false;
  return false;
}
