/**
 * Strategic Artifact Registry
 *
 * Documents every major artifact in the pipeline: its owner, inputs,
 * outputs, stale dependencies, and provenance requirements.
 * This is a living specification — update when adding new artifacts.
 */

export type ArtifactType =
  | 'corpus_message'
  | 'cluster'
  | 'avatar'
  | 'market_intelligence'
  | 'avatar_offer'
  | 'foundation_answer'
  | 'alignment_report';

export interface ArtifactDescriptor {
  type: ArtifactType;
  owner: string;          // store or service that owns this artifact
  inputs: ArtifactType[]; // what must exist upstream
  outputs: ArtifactType[]; // what this artifact feeds
  staleDependencies: ArtifactType[]; // changes to these make this artifact stale
  requiresProvenance: boolean;  // must have evidence IDs traceable to corpus_message
  derivedNotStored: boolean;    // true = should be computed, not persisted
}

export const ARTIFACT_REGISTRY: Record<ArtifactType, ArtifactDescriptor> = {
  corpus_message: {
    type: 'corpus_message',
    owner: 'corpusStore',
    inputs: [],
    outputs: ['cluster', 'avatar', 'market_intelligence'],
    staleDependencies: [],
    requiresProvenance: false,
    derivedNotStored: false,
  },
  cluster: {
    type: 'cluster',
    owner: 'corpusStore',
    inputs: ['corpus_message'],
    outputs: ['avatar', 'avatar_offer'],
    staleDependencies: ['corpus_message'],
    requiresProvenance: true,
    derivedNotStored: false,
  },
  avatar: {
    type: 'avatar',
    owner: 'offerStore (progress[companyId].avatars)',
    inputs: ['cluster', 'corpus_message'],
    outputs: ['avatar_offer', 'market_intelligence', 'foundation_answer'],
    staleDependencies: ['cluster', 'corpus_message'],
    requiresProvenance: true,
    derivedNotStored: false,
  },
  market_intelligence: {
    type: 'market_intelligence',
    owner: 'pipelineStore.marketIntelligence',
    inputs: ['avatar', 'corpus_message'],
    outputs: ['foundation_answer'],
    staleDependencies: ['avatar', 'corpus_message'],
    requiresProvenance: true,
    derivedNotStored: false,
  },
  avatar_offer: {
    type: 'avatar_offer',
    owner: 'pipelineStore.avatarOffers',
    inputs: ['avatar', 'cluster'],
    outputs: [],
    staleDependencies: ['avatar', 'cluster'],
    requiresProvenance: true,
    derivedNotStored: false,
  },  foundation_answer: {
    type: 'foundation_answer',
    owner: 'foundationStore',
    inputs: ['avatar', 'market_intelligence', 'corpus_message'],
    outputs: ['alignment_report'],
    staleDependencies: ['market_intelligence'],
    requiresProvenance: false,  // user-validated, not AI-generated
    derivedNotStored: false,
  },
  alignment_report: {
    type: 'alignment_report',
    owner: 'foundationStore',
    inputs: ['foundation_answer', 'avatar'],
    outputs: [],
    staleDependencies: ['foundation_answer', 'avatar'],
    requiresProvenance: false,
    derivedNotStored: true,   // computed on demand, not persisted
  },
};

/** Returns all artifact types that must exist before creating this one. */
export function getUpstreamChain(type: ArtifactType): ArtifactType[] {
  const visited = new Set<ArtifactType>();
  const chain: ArtifactType[] = [];
  function walk(t: ArtifactType) {
    if (visited.has(t)) return;
    visited.add(t);
    const descriptor = ARTIFACT_REGISTRY[t];
    for (const input of descriptor.inputs) {
      walk(input);
    }
    chain.push(t);
  }
  walk(type);
  return chain.filter(t => t !== type);
}

/** Returns all artifact types that become stale when this one changes. */
export function getDownstreamChain(type: ArtifactType): ArtifactType[] {
  const result: ArtifactType[] = [];
  for (const [key, descriptor] of Object.entries(ARTIFACT_REGISTRY)) {
    if (descriptor.staleDependencies.includes(type)) {
      result.push(key as ArtifactType);
    }
  }
  return result;
}
