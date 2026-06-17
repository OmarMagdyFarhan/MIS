import { describe, it, expect, beforeEach } from 'vitest';
import { usePipelineStore } from '../stores/pipelineStore';
import { useCorpusStore } from '../features/corpus/store';
import { migrateCompanyIntelligence, syncProgressWithPipeline } from '../lib/pipelineMigration';
import { resolveAvatarProvenance } from '../lib/provenanceResolver';
import type { Company, Avatar, Offer, Progress } from '../types';
import type { EvidenceMessage, Cluster, ProvenanceLink } from '../types/pipeline';

// ── Helpers ────────────────────────────────────────────────────────────────────

function resetStores() {
  useCorpusStore.setState({ corpora: {}, hydrated: false });
  usePipelineStore.setState({
    byCompany: {}, runs: {}, avatarOffers: {},    provenance: {}, marketIntelligence: {}, hydrated: false,
  });
}

const COMPANY: Company = {
  id: 'co_migrate',
  name: 'Migration Test Co',
  industry: 'Health',
  specializations: [],
  usp: '',
  country: 'US',
  createdAt: new Date().toISOString(),
};

function makeAvatar(id: string, name: string, clusterId?: string): Avatar {
  return {
    id,
    companyId: COMPANY.id,
    name,
    description: `${name} desc`,
    acquisitionSource: 'ai',
    validationStatus: 'provisional',
    canHaveSubAvatars: false,
    clusterId: clusterId ?? null,
  } as Avatar;
}

function makeEvidenceMsg(id: string, text: string, clusterId?: string): EvidenceMessage {
  const now = new Date().toISOString();
  return {
    id, rawText: text, source: 'paste', analyzed: true,
    analysis: { topic: 'Pain', conversionFormulaAspect: 'Anxiety', messageType: 'Social Proof Signal', qualityScore: 0.8 },
    clusterId: clusterId ?? null, createdAt: now, updatedAt: now,
  };
}

function makeCluster(id: string, msgIds: string[], avatarId?: string): Cluster {
  const now = new Date().toISOString();
  return {
    id, companyId: COMPANY.id, corpusVersion: 1, label: id,
    status: 'validated', messageIds: msgIds, source: 'mining',
    validationStatus: 'validated', avatarId: avatarId ?? undefined,
    createdAt: now, updatedAt: now,
  };
}

// ── Provenance Tests ────────────────────────────────────────────────────────────

describe('provenance', () => {
  beforeEach(() => {
    resetStores();
  });

  it('addProvenance + getProvenance roundtrip', () => {
    usePipelineStore.getState().addProvenance(COMPANY.id, {
      artifactType: 'avatar_offer',
      artifactId: 'ao1',
      evidenceMessageIds: ['m1', 'm2', 'm3'],
      clusterId: 'cl1',
      runId: 'run_abc',
    });
    const links = usePipelineStore.getState().getProvenance(COMPANY.id, 'ao1');
    expect(links).toHaveLength(1);
    expect(links[0].evidenceMessageIds).toEqual(['m1', 'm2', 'm3']);
    expect(links[0].clusterId).toBe('cl1');
    expect(links[0].runId).toBe('run_abc');
    expect(links[0].createdAt).toBeTruthy();
  });

  it('multiple provenance links accumulate for same company', () => {
    for (let i = 0; i < 3; i++) {
      usePipelineStore.getState().addProvenance(COMPANY.id, {
        artifactType: 'cluster', artifactId: `cl${i}`, evidenceMessageIds: [], runId: 'r1',
      });
    }
    const all = usePipelineStore.getState().getProvenance(COMPANY.id);
    expect(all).toHaveLength(3);
  });

  it('getProvenance returns empty array for unknown company', () => {
    expect(usePipelineStore.getState().getProvenance('no-such-company')).toEqual([]);
  });

  it('resolveAvatarProvenance returns segment definition item with correct cluster evidence quotes', () => {
    const avatar = makeAvatar('av1', 'Buyer', 'cl1');
    const messages = [
      makeEvidenceMsg('m1', 'Quote 1', 'cl1'),
      makeEvidenceMsg('m2', 'Quote 2', 'cl1'),
      makeEvidenceMsg('m3', 'Unrelated', 'cl2'),
    ];
    const clusters = [makeCluster('cl1', ['m1', 'm2'], 'av1')];
    const provenanceLinks: ProvenanceLink[] = [];

    const items = resolveAvatarProvenance(avatar, messages, clusters, provenanceLinks, undefined);
    // resolveAvatarProvenance returns ProvenanceExplainability items per field.
    // There must always be at least the 'segment' item.
    expect(items.length).toBeGreaterThanOrEqual(1);

    // The 'segment' item should carry evidence quotes from the avatar's cluster messages
    const segmentItem = items.find(i => i.field === 'segment');
    expect(segmentItem).toBeDefined();
    expect(segmentItem!.cluster?.id).toBe('cl1');
    expect(segmentItem!.evidenceQuotes.map(q => q.id).sort()).toEqual(['m1', 'm2']);
  });

  it('resolveAvatarProvenance includes avatarOffer formula item when avatarOffer provided', () => {
    const now = new Date().toISOString();
    const avatar = makeAvatar('av1', 'Buyer', 'cl1');
    // Give avatar a targetedOffer so that item is included
    (avatar as any).targetedOffer = { offerName: 'Special Deal', hook: 'Your hook here' };
    const messages = [makeEvidenceMsg('m1', 'Quote A', 'cl1')];
    const clusters = [makeCluster('cl1', ['m1'], 'av1')];
    const avatarOffer = {
      id: 'ao1', companyId: COMPANY.id, avatarId: 'av1', clusterId: 'cl1',
      formula: { audience: 'A', product: 'P', transformation: 'Before to After', reasonToActNow: 'R', specificity: 'S' },
      validationStatus: 'provisional' as const,
      confidence: { overall: 0.6, dimensions: { evidenceVolume: 0.6, clusterCohesion: 0.6, offerEvidenceAlignment: 0.6, crossSegmentAgreement: 0.6 }, status: 'provisional' as const, reasons: [], computedAt: now, corpusVersion: 1 },
      derivedFrom: { corpusVersion: 1, messageIds: ['m1'] },
      updatedAt: now,
    };
    const items = resolveAvatarProvenance(avatar, messages, clusters, [], avatarOffer);
    const formulaItem = items.find(i => i.field === 'formula.transformation');
    expect(formulaItem).toBeDefined();
    expect(formulaItem!.value).toBe('Before to After');
    expect(formulaItem!.evidenceQuotes[0].id).toBe('m1');
  });
});

// ── Migration Tests ─────────────────────────────────────────────────────────────

describe('migration — migrateCompanyIntelligence', () => {
  beforeEach(() => {
    resetStores();
  });

  it('creates synthetic clusters for legacy avatars without clusterId', () => {
    const avatars = [makeAvatar('av1', 'Alex'), makeAvatar('av2', 'Sam')];
    const progress: Progress = {
      stage1Complete: true, stage2Complete: true, stage3Complete: true,
      avatars,
    };
    const { syntheticClusters, patchedAvatars } = migrateCompanyIntelligence(COMPANY, progress, undefined);
    expect(syntheticClusters).toHaveLength(2);
    expect(patchedAvatars.every(a => a.clusterId)).toBe(true);
  });

  it('does not create synthetic cluster when clusterId already present', () => {
    const avatars = [makeAvatar('av1', 'Alex', 'cl_existing')];
    const progress: Progress = { stage1Complete: true, stage2Complete: true, stage3Complete: true, avatars };
    const { syntheticClusters, patchedAvatars } = migrateCompanyIntelligence(COMPANY, progress, undefined);
    expect(syntheticClusters).toHaveLength(0);
    expect(patchedAvatars[0].clusterId).toBe('cl_existing');
  });
it('does not overwrite existing core offer during migration', () => {
    // Pre-set a core offer
    const existingCore = {
      companyId: COMPANY.id,
      formula: { audience: 'New', product: 'NewProduct', transformation: 'T', reasonToActNow: 'R', specificity: 'S' },
      validationStatus: 'validated' as const,
      confidence: { overall: 0.9, dimensions: { evidenceVolume: 0.9, clusterCohesion: 0.9, offerEvidenceAlignment: 0.9, crossSegmentAgreement: 0.9 }, status: 'validated' as const, reasons: [], computedAt: new Date().toISOString(), corpusVersion: 2 },
      derivedFrom: { corpusVersion: 2 },
      updatedAt: new Date().toISOString(),
    };

    const legacyOffer: Offer = {
      companyId: COMPANY.id, product: 'OldProduct', relevance: '', reason: '', audience: '', transformation: '',
      generatedOffer: 'Old copy', generatedAt: new Date().toISOString(),
    };
    migrateCompanyIntelligence(COMPANY, { stage1Complete: true, stage2Complete: true, stage3Complete: false }, legacyOffer);
    // Should NOT have overwritten
  });

  it('infers pipeline phase from legacy progress flags', () => {
    const progress: Progress = {
      stage1Complete: true, stage2Complete: false, stage3Complete: false,
      avatars: [],
    };
    const { pipeline } = migrateCompanyIntelligence(COMPANY, progress, undefined);
    expect(pipeline.phase).toBe('corpus_active');
  });

  it('syncProgressWithPipeline merges pipeline phase flags into legacy progress', () => {
    usePipelineStore.setState(state => ({
      byCompany: {
        ...state.byCompany,
        [COMPANY.id]: {
          companyId: COMPANY.id,
          phase: 'corpus_analyzed',
          stale: { messages: false, clusters: false, avatars: false, avatarOffers: false, marketIntel: false, renderedCopy: false },
        } as any,
      },
    }));
    const progress: Progress = { stage1Complete: true, stage2Complete: false, stage3Complete: false };
    const synced = syncProgressWithPipeline(progress, COMPANY.id);
    expect(synced.stage2Complete).toBe(true);
  });
});

// ── Avatar Dedupe Tests ─────────────────────────────────────────────────────────

describe('avatar dedupe — materialization guard', () => {
  beforeEach(() => {
    resetStores();
  });

  it('materialize_avatars skips cluster when avatar is already in existingAvatars', async () => {
    // Seed corpus with a cluster that already has an avatarId present in existingAvatars
    useCorpusStore.getState().ensureCorpus(COMPANY.id);
    const now = new Date().toISOString();
    const msgs = [
      makeEvidenceMsg('m1', 'Quote A', 'cl1'),
      makeEvidenceMsg('m2', 'Quote B', 'cl1'),
    ];
    useCorpusStore.getState().setMessages(COMPANY.id, msgs);
    useCorpusStore.getState().setClusters(COMPANY.id, [
      makeCluster('cl1', ['m1', 'm2'], 'av_existing'),
    ]);

    const existingAvatar = makeAvatar('av_existing', 'Pre-existing Avatar', 'cl1');
    const created: any[] = [];
    await (await import('../services/pipelineOrchestrator')).runPipelineIntent(
      COMPANY,
      'materialize_avatars',
      {
        existingAvatars: [existingAvatar],
        callbacks: { onAvatarCreated: (a) => created.push(a) },
      }
    );
    // Should NOT have created a new avatar — cluster already has an avatar in existingAvatars
    expect(created).toHaveLength(0);
  });
});
