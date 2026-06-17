import type { Avatar, Company, Offer, Progress } from '../types';
import type { Cluster, CompanyPipelineState, PipelinePhase } from '../types/pipeline';
import {
  avatarToOfferRecord,
} from './offerAdapters';
import { createEmptyCorpus } from '../features/corpus/store';
import { useCorpusStore } from '../features/corpus/store';
import { usePipelineStore } from '../stores/pipelineStore';
import { pipelinePhaseToLegacyFlags } from './pipelineGraph';

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function inferPhaseFromLegacy(progress: Progress | undefined, hasCore: boolean): PipelinePhase {
  if (!progress?.stage1Complete) return 'company_complete';
  if (progress.avatars?.length) return 'segments_materialized';
  if (progress.stage1Complete) return 'corpus_active';
  return 'company_complete';
}

export function migrateCompanyIntelligence(
  company: Company,
  progress: Progress | undefined,
  legacyOffer: Offer | undefined
): {
  pipeline: CompanyPipelineState;
  syntheticClusters: Cluster[];
  patchedAvatars: Avatar[];
} {
  const companyId = company.id;
  const corpusStore = useCorpusStore.getState();
  const pipelineStore = usePipelineStore.getState();

  let corpus = corpusStore.corpora[companyId];
  if (!corpus) {
    corpus = createEmptyCorpus(companyId, progress?.acquisitionMode || 'hybrid');
    corpusStore.corpora[companyId] = corpus;
  }

  const syntheticClusters: Cluster[] = [];
  const avatars = progress?.avatars || [];
  const patchedAvatars: Avatar[] = avatars.map(a => {
    let clusterId = a.clusterId;
    if (!clusterId) {
      clusterId = uid('cl_legacy');
      syntheticClusters.push({
        id: clusterId,
        companyId,
        corpusVersion: corpus!.version,
        label: a.name,
        status: 'validated',
        messageIds: [],
        avatarId: a.id,
        source: a.acquisitionSource || 'ai',
        validationStatus: a.validationStatus || 'validated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return {
      ...a,
      clusterId,
      acquisitionSource: a.acquisitionSource || 'ai',
      validationStatus: a.validationStatus || 'validated',
    };
  });

  if (syntheticClusters.length) {
    const existingIds = new Set(corpus.clusters.map(c => c.id));
    corpus.clusters = [
      ...corpus.clusters,
      ...syntheticClusters.filter(c => !existingIds.has(c.id)),
    ];
    corpusStore.corpora[companyId] = corpus;
  }

  for (const avatar of patchedAvatars) {
    if (avatar.targetedOffer && avatar.clusterId) {
      const rec = avatarToOfferRecord(avatar, avatar.clusterId, corpus.version);
      if (rec) pipelineStore.avatarOffers[rec.id] = rec;
    }
  }

  const phase =
    progress?.pipelinePhase ||
    inferPhaseFromLegacy(progress, Boolean(legacyOffer?.generatedOffer));

  const pipeline: CompanyPipelineState = {
    companyId,
    phase,
    acquisitionMode: progress?.acquisitionMode || corpus.mode,
    stale: {
      messages: false,
      clusters: false,
      avatars: false,
      avatarOffers: false,
      marketIntel: false,      renderedCopy: false,
    },
    activeRunId: null,
    lastRunId: null,
    updatedAt: new Date().toISOString(),
  };

  pipelineStore.byCompany[companyId] = pipeline;

  return { pipeline, syntheticClusters, patchedAvatars };
}

/** Apply legacy progress flags from pipeline phase for Returning screen */
export function syncProgressWithPipeline(
  progress: Progress,
  companyId: string
): Progress {
  const pipeline = usePipelineStore.getState().byCompany[companyId];
  if (!pipeline) return progress;
  const flags = pipelinePhaseToLegacyFlags(pipeline.phase);
  return {
    ...progress,
    ...flags,
    pipelinePhase: pipeline.phase,
    acquisitionMode: pipeline.acquisitionMode,
  };
}

