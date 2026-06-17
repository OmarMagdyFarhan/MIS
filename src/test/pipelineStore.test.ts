import { describe, it, expect, beforeEach } from 'vitest';
import { usePipelineStore } from '../stores/pipelineStore';
import { EMPTY_STALE } from '../lib/pipelineGraph';
import type { AvatarOfferRecord } from '../types/pipeline';

const CO = 'co_test';

function resetStore() {
  usePipelineStore.setState({
    byCompany: {},
    runs: {},
    avatarOffers: {},    provenance: {},
    marketIntelligence: {},
    hydrated: false,
  });
}

function makeAvatarOffer(id: string, companyId: string, avatarId: string): AvatarOfferRecord {
  const now = new Date().toISOString();
  return {
    id,
    companyId,
    avatarId,
    clusterId: `cl_${avatarId}`,
    formula: { audience: 'A', product: 'P', transformation: 'T', reasonToActNow: 'R', specificity: 'S' },
    validationStatus: 'provisional',
    confidence: {
      overall: 0.5, dimensions: { evidenceVolume: 0.5, clusterCohesion: 0.5, offerEvidenceAlignment: 0.5, crossSegmentAgreement: 0.5 },
      status: 'provisional', reasons: [], computedAt: now, corpusVersion: 1,
    },
    derivedFrom: { corpusVersion: 1 },
    updatedAt: now,
  };
}


describe('pipelineStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── ensureCompany ──────────────────────────────────────────────────────────

  it('ensureCompany creates default pipeline state', () => {
    const state = usePipelineStore.getState().ensureCompany(CO);
    expect(state.phase).toBe('company_complete');
    expect(state.acquisitionMode).toBe('hybrid');
    expect(state.stale).toEqual(EMPTY_STALE);
  });

  it('ensureCompany is idempotent', () => {
    usePipelineStore.getState().setPhase(CO, 'corpus_analyzed');
    const again = usePipelineStore.getState().ensureCompany(CO);
    expect(again.phase).toBe('corpus_analyzed');
  });

  // ── setPhase ───────────────────────────────────────────────────────────────

  it('setPhase advances the pipeline phase', () => {
    usePipelineStore.getState().setPhase(CO, 'clusters_proposed');
    expect(usePipelineStore.getState().byCompany[CO].phase).toBe('clusters_proposed');
  });

  // ── stale flag propagation ──────────────────────────────────────────────────

  it('markLayerStale(clusters) marks clusters and all downstream layers', () => {
    usePipelineStore.getState().ensureCompany(CO);
    usePipelineStore.getState().markLayerStale(CO, 'clusters');
    const { stale } = usePipelineStore.getState().byCompany[CO];
    expect(stale.clusters).toBe(true);
    expect(stale.avatars).toBe(true);
    expect(stale.avatarOffers).toBe(true);
    expect(stale.marketIntel).toBe(true);
    expect(stale.renderedCopy).toBe(true);
    // messages (upstream) should NOT be marked
    expect(stale.messages).toBe(false);
  });
it('clearStale(avatarOffers) clears only avatarOffers', () => {
    usePipelineStore.getState().markLayerStale(CO, 'clusters');
    usePipelineStore.getState().clearStale(CO, ['avatarOffers']);
    const { stale } = usePipelineStore.getState().byCompany[CO];
    expect(stale.avatarOffers).toBe(false);
    expect(stale.clusters).toBe(true); // untouched
  });

  it('clearStale() with no keys clears everything', () => {
    usePipelineStore.getState().markLayerStale(CO, 'corpus');
    usePipelineStore.getState().clearStale(CO);
    const { stale } = usePipelineStore.getState().byCompany[CO];
    expect(Object.values(stale).every(v => v === false)).toBe(true);
  });

  // ── run lifecycle ──────────────────────────────────────────────────────────

  it('startRun creates a running run and sets activeRunId', () => {
    const run = usePipelineStore.getState().startRun(CO, 'analyze_corpus');
    expect(run.status).toBe('running');
    expect(run.intent).toBe('analyze_corpus');
    expect(usePipelineStore.getState().byCompany[CO].activeRunId).toBe(run.id);
  });

  it('finishRun marks run completed and clears activeRunId', () => {
    const run = usePipelineStore.getState().startRun(CO, 'propose_clusters');
    usePipelineStore.getState().finishRun(run.id, 'completed');
    expect(usePipelineStore.getState().runs[run.id].status).toBe('completed');
    expect(usePipelineStore.getState().byCompany[CO].activeRunId).toBeNull();
    expect(usePipelineStore.getState().byCompany[CO].lastRunId).toBe(run.id);
  });

  it('finishRun records error on failure', () => {
    const run = usePipelineStore.getState().startRun(CO, 'materialize_avatars');
    usePipelineStore.getState().finishRun(run.id, 'failed', 'AI timeout');
    expect(usePipelineStore.getState().runs[run.id].status).toBe('failed');
    expect(usePipelineStore.getState().runs[run.id].error).toBe('AI timeout');
  });

  it('getActiveRun returns null when no active run', () => {
    usePipelineStore.getState().ensureCompany(CO);
    expect(usePipelineStore.getState().getActiveRun(CO)).toBeNull();
  });

  // ── avatar offer CRUD ──────────────────────────────────────────────────────

  it('setAvatarOffer stores and retrieves an AvatarOfferRecord', () => {
    const record = makeAvatarOffer('ao1', CO, 'av1');
    usePipelineStore.getState().setAvatarOffer(record);
    const offers = usePipelineStore.getState().getAvatarOffersForCompany(CO);
    expect(offers).toHaveLength(1);
    expect(offers[0].id).toBe('ao1');
  });

  it('getAvatarOffersForCompany filters by companyId', () => {
    usePipelineStore.getState().setAvatarOffer(makeAvatarOffer('ao1', CO, 'av1'));
    usePipelineStore.getState().setAvatarOffer(makeAvatarOffer('ao2', 'other_co', 'av2'));
    const offers = usePipelineStore.getState().getAvatarOffersForCompany(CO);
    expect(offers).toHaveLength(1);
    expect(offers[0].companyId).toBe(CO);
  });

  // ── core offer CRUD ────────────────────────────────────────────────────────

  // ── getLegacyProgressFlags ─────────────────────────────────────────────────

  it('getLegacyProgressFlags maps pipeline phases to legacy booleans', () => {
    usePipelineStore.getState().setPhase(CO, 'segments_materialized');
    const flags = usePipelineStore.getState().getLegacyProgressFlags(CO);
    expect(flags.stage1Complete).toBe(true);
    expect(flags.stage3Complete).toBe(true);

  });
});

describe('UUID format for generated IDs', () => {
  beforeEach(resetStore);

  it('startRun generates a run ID in UUID format', () => {
    const run = usePipelineStore.getState().startRun(CO, 'analyze_corpus');
    expect(run.id).toMatch(/^run_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('addProvenance generates a provenance ID in UUID format', () => {
    usePipelineStore.getState().addProvenance(CO, {
      artifactType: 'cluster',
      artifactId: 'cl1',
      evidenceMessageIds: ['m1'],
      runId: 'run_test',
    });
    const links = usePipelineStore.getState().getProvenance(CO);
    expect(links[0].id).toMatch(/^prov_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('each startRun call produces a unique ID', () => {
    const run1 = usePipelineStore.getState().startRun(CO, 'analyze_corpus');
    const run2 = usePipelineStore.getState().startRun(CO, 'analyze_corpus');
    expect(run1.id).not.toBe(run2.id);
  });
});
