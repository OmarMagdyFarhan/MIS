// EVENT BUS ADAPTERS — Phase 12
// Single source of truth: corpusStore only. clusterStore removed.
// findOrCreateCluster NEVER generates fake IDs.

import type {
  MessageService, ClusterService, ProblemService,
  EmotionService, AvatarService, OfferService,
} from './eventBus';
import { EmotionService as EmotionServiceImpl } from './emotionService';
import { ProblemAnalysisService, JTBDAnalysisService } from './problemAnalysisService';
import { AvatarServiceV2 } from './avatarServiceV2';
import { useCorpusStore } from '../features/corpus/store';
import { useCompanyStore } from '../stores/companyStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { useOfferStore } from '../stores/offerStore';
import type { EvidenceMessage, Cluster } from '../types/pipeline';

const _emotionImpl = new EmotionServiceImpl();
const _problemImpl = new ProblemAnalysisService();
const _jtbdImpl    = new JTBDAnalysisService();
const _avatarImpl  = new AvatarServiceV2();

function findMessageInCorpora(messageId: string): { companyId: string; msg: EvidenceMessage } | null {
  for (const [companyId, corpus] of Object.entries(useCorpusStore.getState().corpora)) {
    const msg = (corpus as any).messages?.find((m: EvidenceMessage) => m.id === messageId);
    if (msg) return { companyId, msg };
  }
  return null;
}

function findClusterById(clusterId: string): { companyId: string; cluster: Cluster } | null {
  for (const [companyId, corpus] of Object.entries(useCorpusStore.getState().corpora)) {
    const cluster = (corpus as any).clusters?.find((c: Cluster) => c.id === clusterId);
    if (cluster) return { companyId, cluster };
  }
  return null;
}

function getClusterMessages(clusterId: string): EvidenceMessage[] {
  const found = findClusterById(clusterId);
  if (!found) return [];
  const corpus = (useCorpusStore.getState().corpora as any)[found.companyId];
  return (corpus?.messages ?? []).filter((m: EvidenceMessage) => m.clusterId === clusterId);
}

export const messageMiningServiceAdapter: MessageService = {
  async getMessage(id: string) {
    const found = findMessageInCorpora(id);
    if (!found) return { text: '', clusterId: undefined };
    return { text: found.msg.rawText ?? '', clusterId: found.msg.clusterId ?? undefined };
  },
  async analyzeEmotion(text: string) {
    const stub = { id: 'tmp', rawText: text, source: 'paste' as const, analyzed: false, clusterId: null, createdAt: '', updatedAt: '' } as EvidenceMessage;
    return _emotionImpl.aggregateEmotionsFromCluster([stub]);
  },
  async analyzeConversionAspects(text: string) {
    const lower = text.toLowerCase();
    const aspects: string[] = [];
    if (lower.includes('price') || lower.includes('cost'))     aspects.push('pricing');
    if (lower.includes('time')  || lower.includes('fast'))     aspects.push('time');
    if (lower.includes('trust') || lower.includes('secure'))   aspects.push('trust');
    if (lower.includes('quality') || lower.includes('broken')) aspects.push('quality');
    return aspects.length > 0 ? aspects : ['general'];
  },
};

export const clusterServiceAdapter: ClusterService = {
  async getCluster(id: string) {
    return findClusterById(id)?.cluster ?? null;
  },
  async getClusterComments(clusterId: string) {
    return getClusterMessages(clusterId);
  },
  // Returns existing clusterId from corpusStore. NEVER generates a fake ID.
  async findOrCreateCluster(commentId: string, _emotion: unknown, _aspect: unknown) {
    const found = findMessageInCorpora(commentId);
    return found?.msg.clusterId ?? '';
  },
  async generateClusterLabel(clusterId: string) {
    const found = findClusterById(clusterId);
    return found?.cluster.label ?? `Cluster ${clusterId.slice(-6)}`;
  },
  async getClusterSize(clusterId: string) {
    return getClusterMessages(clusterId).length;
  },
};

export const problemAnalysisServiceAdapter: ProblemService = {
  async extractProblemsFromCluster(cluster: unknown, comments: unknown[]) {
    if (!cluster) return [];
    try { return await _problemImpl.extractProblemsFromCluster(cluster as any, comments as any); }
    catch { return []; }
  },
  async extractJTBDFromCluster(cluster: unknown, comments: unknown[], problems: unknown[]) {
    if (!cluster) return null;
    try { return await _jtbdImpl.extractJTBDFromCluster(cluster as any, comments as any, problems as any); }
    catch { return null; }
  },
};

export const emotionServiceAdapter: EmotionService = {
  async aggregateEmotions(comments: unknown[]) {
    return _emotionImpl.aggregateEmotionsFromCluster(comments as EvidenceMessage[]);
  },
};

export const avatarServiceAdapter: AvatarService = {
  async shouldGenerateAvatar(clusterId: string) {
    const found = findClusterById(clusterId);
    if (!found) return false;
    return _avatarImpl.shouldGenerateAvatar(found.cluster, getClusterMessages(clusterId));
  },
  async getProblemCount(clusterId: string) {
    return (findClusterById(clusterId)?.cluster as any)?.dominantProblems?.length ?? 0;
  },
  async getCommentCount(clusterId: string) {
    return getClusterMessages(clusterId).length;
  },
  async generateAvatarFromClusters(clusterIds: string[]) {
    try {
      const clusterId = clusterIds[0];
      if (!clusterId) throw new Error('No clusterId');
      const found = findClusterById(clusterId);
      if (!found) throw new Error(`Cluster ${clusterId} not in corpusStore`);
      const { companyId, cluster } = found;
      const company = useCompanyStore.getState().companies.find(c => c.id === companyId);
      if (!company) throw new Error(`Company ${companyId} not found`);
      const messages = getClusterMessages(clusterId);
      const commentsMap = new Map([[clusterId, messages]]);
      const avatars = await _avatarImpl.generateAvatarsFromClusters(company, [cluster], commentsMap);
      const avatar = avatars[0];
      if (!avatar) throw new Error('No avatar returned');
      useOfferStore.getState().setProgress(prev => {
        const p = prev[companyId] ?? { stage1Complete: true, stage2Complete: false, stage3Complete: false };
        const existing: any[] = (p as any).avatars ?? [];
        const updated = existing.some((a: any) => a.id === avatar.id)
          ? existing.map((a: any) => a.id === avatar.id ? avatar : a)
          : [...existing, avatar];
        return { ...prev, [companyId]: { ...p, avatars: updated } };
      });
      useCorpusStore.getState().upsertCluster(companyId, {
        ...cluster, avatarId: avatar.id, updatedAt: new Date().toISOString(),
      });
      usePipelineStore.getState().markLayerStale(companyId, 'avatar_offers');
      return avatar;
    } catch (err) {
      console.error('[EventBus] generateAvatarFromClusters failed:', err);
      return { id: `avatar-event-${Date.now()}`, name: 'Pending generation', score: 0,
        generation: { sourceClusterIds: clusterIds, generatedAt: new Date().toISOString() } };
    }
  },
};

export const offerServiceAdapter: OfferService = {
  async getOffersForAvatar(avatarId: string) {
    return Object.values(useOfferStore.getState().offers).filter(
      (o: any) => o.avatarId === avatarId || o.targetAvatarId === avatarId
    );
  },
  async getOffer(offerId: string) {
    return Object.values(useOfferStore.getState().offers).find((o: any) => o.id === offerId) ?? null;
  },
  async getAvatar(avatarId: string) {
    for (const progress of Object.values(useOfferStore.getState().progress)) {
      const avatar = ((progress as any).avatars ?? []).find((a: any) => a.id === avatarId);
      if (avatar) return avatar;
    }
    return null;
  },
  async scoreOfferForAvatar(offer: unknown, avatar: unknown) {
    if (!offer || !avatar) return { total: 0, breakdown: {} };
    return (offer as any).score ?? { total: 5, breakdown: {} };
  },
};
