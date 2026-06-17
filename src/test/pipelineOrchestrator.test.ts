import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runPipelineIntent, validateClustersAuto, recalculateDownstream } from '../services/pipelineOrchestrator';
import { useCorpusStore } from '../features/corpus/store';
import { usePipelineStore } from '../stores/pipelineStore';
import type { Company } from '../types';
import type { Cluster } from '../types/pipeline';

// ── Minimal AI service mock ───────────────────────────────────────────────────
vi.mock('../features/corpus/services/messageMiningService', () => ({
  analyzeMessages: vi.fn(async (texts: string[]) =>
    texts.map(t => ({
      topic: 'Test Topic',
      conversionFormulaAspect: 'Anxiety',
      messageType: 'Testimonial',
    }))
  ),
  deriveMarketIntelligence: vi.fn(async () => ({
    topPains: ['pain1'],
    topMotivations: ['motivation1'],
    topFrictions: ['friction1'],
    marketTheme: 'Test Market',
    problemAwarenessLevel: 'problem_aware',
    messagingRecommendations: [],
    competitorGaps: [],
    audienceInsights: '',
  })),
  createAvatarFromMessage: vi.fn(async (msg: any, company: Company) => ({
    name: 'Test Avatar',
    description: 'Generated from evidence',
    companyId: company.id,
  })),
  improveAvatarWithMessage: vi.fn(async (avatar: any) => avatar),
  matchMessageToAvatar: vi.fn(() => null),
}));

vi.mock('../features/corpus/services/messageMiningOrchestrator', () => ({
  runMessageMiningAnalysis: vi.fn(async () => {}),
}));

vi.mock('../features/corpus/services/clusteringService', () => ({
  proposeClustersFromMessages: vi.fn(async (company: Company, messages: any[]) => {
    const now = new Date().toISOString();
    return messages.length
      ? [{
          id: 'cl_generated',
          companyId: company.id,
          corpusVersion: 1,
          label: 'Generated Cluster',
          status: 'proposed' as const,
          messageIds: messages.slice(0, 2).map((m: any) => m.id),
          source: 'mining' as const,
          validationStatus: 'provisional' as const,
          createdAt: now,
          updatedAt: now,
        }]
      : [];
  }),
  assignMessagesToClusters: vi.fn((messages: any[], clusters: any[]) => {
    return messages.map((m: any) => ({
      ...m,
      clusterId: clusters[0]?.id ?? null,
    }));
  }),
  AUTO_VALIDATE_COHESION: 0.75,
  MIN_MESSAGES_FOR_VALIDATION: 3,
}));

vi.mock('../services/offerSynthesisService', () => ({
  synthesizeAvatarOfferFormula: vi.fn(async () => ({
    formula: { audience: 'A', product: 'P', transformation: 'T', reasonToActNow: 'R', specificity: 'S' },
    rendered: { generatedOffer: 'Mock avatar offer copy', hook: 'Hook' },
  })),
  buildAvatarOfferRecord: vi.fn((_cid: string, avatar: any, cluster: any, ...rest: any[]) => {
    const now = new Date().toISOString();
    return {
      id: `ao_${avatar.id}`,
      companyId: _cid,
      avatarId: avatar.id,
      clusterId: cluster.id,
      formula: { audience: 'A', product: 'P', transformation: 'T', reasonToActNow: 'R', specificity: 'S' },
      validationStatus: 'provisional' as const,
      confidence: { overall: 0.5, dimensions: { evidenceVolume: 0.5, clusterCohesion: 0.5, offerEvidenceAlignment: 0.5, crossSegmentAgreement: 0.5 }, status: 'provisional' as const, reasons: [], computedAt: now, corpusVersion: 1 },
      derivedFrom: { corpusVersion: 1 },
      updatedAt: now,
    };
  }),
}));

vi.mock('../services/offerService', () => ({
  computeOfferScore: vi.fn(async (_company: any, offer: any) => offer),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const COMPANY: Company = {
  id: 'co_orch',
  name: 'Orchestrator Test Co',
  industry: 'SaaS',
  specializations: [],
  usp: 'Test USP',
  country: 'Global',
  createdAt: new Date().toISOString(),
};

function resetStores() {
  useCorpusStore.setState({ corpora: {}, hydrated: false });
  usePipelineStore.setState({
    byCompany: {}, runs: {}, avatarOffers: {},    provenance: {}, marketIntelligence: {}, hydrated: false,
  });
}

function seedMessages(count = 3) {
  useCorpusStore.getState().ensureCorpus(COMPANY.id);
  const msgs = Array.from({ length: count }, (_, i) => ({
    id: `m${i + 1}`,
    rawText: `Customer said thing ${i + 1} which is a reasonably long message to pass quality filter`,
    source: 'paste' as const,
    analyzed: false,
    clusterId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  useCorpusStore.getState().setMessages(COMPANY.id, msgs);
  return msgs;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('pipelineOrchestrator — intent routing', () => {
  beforeEach(() => {
    resetStores();
  });

  it('analyze_corpus marks messages as analyzed and advances phase', async () => {
    seedMessages(3);
    const result = await runPipelineIntent(COMPANY, 'analyze_corpus');
    expect(result.success).toBe(true);
    const phase = usePipelineStore.getState().byCompany[COMPANY.id]?.phase;
    expect(phase).toBe('corpus_analyzed');
    const msgs = useCorpusStore.getState().getCorpus(COMPANY.id).messages;
    expect(msgs.every(m => m.analyzed)).toBe(true);
  });

  it('analyze_corpus marks clusters layer stale', async () => {
    seedMessages(2);
    await runPipelineIntent(COMPANY, 'analyze_corpus');
    const stale = usePipelineStore.getState().byCompany[COMPANY.id]?.stale;
    expect(stale?.clusters).toBe(true);
  });

  it('propose_clusters advances phase to clusters_proposed', async () => {
    seedMessages(3);
    await runPipelineIntent(COMPANY, 'analyze_corpus');
    const result = await runPipelineIntent(COMPANY, 'propose_clusters');
    expect(result.success).toBe(true);
    expect(usePipelineStore.getState().byCompany[COMPANY.id]?.phase).toBe('clusters_proposed');
    const clusters = useCorpusStore.getState().getCorpus(COMPANY.id).clusters;
    expect(clusters.length).toBeGreaterThan(0);
  });

  it('materialize_avatars advances phase to segments_materialized', async () => {
    seedMessages(3);
    await runPipelineIntent(COMPANY, 'analyze_corpus');
    await runPipelineIntent(COMPANY, 'propose_clusters');
    // Give at least one cluster an avatarId slot by ensuring cluster has messages
    const result = await runPipelineIntent(COMPANY, 'materialize_avatars', { existingAvatars: [] });
    expect(result.success).toBe(true);
    expect(usePipelineStore.getState().byCompany[COMPANY.id]?.phase).toBe('segments_materialized');
  });

  it('returns { success: false } when an intent throws', async () => {
    const { proposeClustersFromMessages } = await import('../features/corpus/services/clusteringService');
    (proposeClustersFromMessages as any).mockRejectedValueOnce(new Error('AI failed'));
    seedMessages(2);
    await runPipelineIntent(COMPANY, 'analyze_corpus');
    const result = await runPipelineIntent(COMPANY, 'propose_clusters');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('pipelineOrchestrator — validateClustersAuto', () => {
  beforeEach(() => {
    resetStores();
  });

  it('auto-validates clusters meeting cohesion threshold', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY.id);
    const now = new Date().toISOString();
    const clusters: Cluster[] = [
      {
        id: 'cl1', companyId: COMPANY.id, corpusVersion: 1, label: 'Strong',
        status: 'proposed', messageIds: ['m1', 'm2', 'm3'], cohesionScore: 0.9,
        source: 'mining', validationStatus: 'provisional', createdAt: now, updatedAt: now,
      },
      {
        id: 'cl2', companyId: COMPANY.id, corpusVersion: 1, label: 'Weak',
        status: 'proposed', messageIds: ['m4'], cohesionScore: 0.4,
        source: 'mining', validationStatus: 'provisional', createdAt: now, updatedAt: now,
      },
    ];
    useCorpusStore.getState().setClusters(COMPANY.id, clusters);
    validateClustersAuto(COMPANY.id);
    const updated = useCorpusStore.getState().getCorpus(COMPANY.id).clusters;
    const strong = updated.find(c => c.id === 'cl1')!;
    const weak = updated.find(c => c.id === 'cl2')!;
    expect(strong.status).toBe('validated');
    expect(weak.status).toBe('proposed'); // still proposed
    expect(usePipelineStore.getState().byCompany[COMPANY.id]?.phase).toBe('clusters_validated');
  });

  it('does not validate merged clusters', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY.id);
    const now = new Date().toISOString();
    useCorpusStore.getState().setClusters(COMPANY.id, [{
      id: 'cl_merged', companyId: COMPANY.id, corpusVersion: 1, label: 'Merged',
      status: 'merged', messageIds: [], cohesionScore: 0.99,
      source: 'mining', validationStatus: 'provisional', createdAt: now, updatedAt: now,
    }]);
    validateClustersAuto(COMPANY.id);
    const c = useCorpusStore.getState().getCorpus(COMPANY.id).clusters[0];
    expect(c.status).toBe('merged'); // unchanged
  });
});

describe('pipelineOrchestrator — recalculateDownstream', () => {
  beforeEach(() => {
    resetStores();
  });
it('scope=offers_only runs synthesize_avatar_offers for each cluster-linked avatar', async () => {
    const { synthesizeAvatarOfferFormula } = await import('../services/offerSynthesisService');
    (synthesizeAvatarOfferFormula as any).mockClear();

    // synthesize_avatar_offers only fires for clusters that have an avatarId
    useCorpusStore.getState().ensureCorpus(COMPANY.id);
    useCorpusStore.getState().setMessages(COMPANY.id, [
      { id: 'm1', rawText: 'evidence', source: 'paste', analyzed: true, clusterId: 'cl1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
    useCorpusStore.getState().setClusters(COMPANY.id, [{
      id: 'cl1', companyId: COMPANY.id, corpusVersion: 1, label: 'Cluster',
      status: 'validated', messageIds: ['m1'], source: 'mining',
      validationStatus: 'validated', avatarId: 'av1',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }]);
    const avatarsWithCluster = [{ id: 'av1', companyId: COMPANY.id, name: 'Avatar 1', clusterId: 'cl1', acquisitionSource: 'ai', validationStatus: 'provisional', canHaveSubAvatars: false } as any];

    await recalculateDownstream(COMPANY, 'offers_only', avatarsWithCluster);
    expect(synthesizeAvatarOfferFormula).toHaveBeenCalledTimes(1);
  });
});
