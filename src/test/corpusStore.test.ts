import { describe, it, expect, beforeEach } from 'vitest';
import { useCorpusStore, createEmptyCorpus, evidenceToMined, minedToEvidenceList } from '../features/corpus/store';
import type { EvidenceMessage } from '../types/pipeline';

const COMPANY_ID = 'test_co';

function resetStore() {
  useCorpusStore.setState({ corpora: {}, hydrated: false });
}

function makeMsg(id: string, text: string): EvidenceMessage {
  const now = new Date().toISOString();
  return {
    id,
    rawText: text,
    source: 'paste',
    analyzed: false,
    clusterId: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe('corpusStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ── ensureCorpus ──────────────────────────────────────────────────────────

  it('ensureCorpus creates a fresh corpus for a new company', () => {
    const corpus = useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    expect(corpus.companyId).toBe(COMPANY_ID);
    expect(corpus.version).toBe(1);
    expect(corpus.messages).toHaveLength(0);
    expect(corpus.clusters).toHaveLength(0);
  });

  it('ensureCorpus returns existing corpus on subsequent calls', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    useCorpusStore.getState().bumpVersion(COMPANY_ID); // v2
    const again = useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    expect(again.version).toBe(2);
  });

  // ── setMessages ───────────────────────────────────────────────────────────

  it('setMessages replaces the message list', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    const msgs = [makeMsg('m1', 'Hello'), makeMsg('m2', 'World')];
    useCorpusStore.getState().setMessages(COMPANY_ID, msgs);
    const { messages } = useCorpusStore.getState().getCorpus(COMPANY_ID);
    expect(messages).toHaveLength(2);
    expect(messages[0].rawText).toBe('Hello');
  });

  // ── removeMessage ─────────────────────────────────────────────────────────

  it('removeMessage removes the message and prunes cluster membership', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    const msgs = [makeMsg('m1', 'A'), makeMsg('m2', 'B')];
    useCorpusStore.getState().setMessages(COMPANY_ID, msgs);
    useCorpusStore.getState().setClusters(COMPANY_ID, [
      {
        id: 'cl1', companyId: COMPANY_ID, corpusVersion: 1, label: 'Cluster 1',
        status: 'proposed', messageIds: ['m1', 'm2'], source: 'mining',
        validationStatus: 'provisional', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
    ]);
    useCorpusStore.getState().removeMessage(COMPANY_ID, 'm1');
    const corpus = useCorpusStore.getState().getCorpus(COMPANY_ID);
    expect(corpus.messages.map(m => m.id)).toEqual(['m2']);
    expect(corpus.clusters[0].messageIds).toEqual(['m2']);
  });

  // ── bumpVersion ───────────────────────────────────────────────────────────

  it('bumpVersion increments the corpus version', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    const v1 = useCorpusStore.getState().bumpVersion(COMPANY_ID);
    expect(v1).toBe(2);
    const v2 = useCorpusStore.getState().bumpVersion(COMPANY_ID);
    expect(v2).toBe(3);
  });

  // ── mergeClusters ─────────────────────────────────────────────────────────

  it('mergeClusters unions message IDs and marks source clusters as merged', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    const now = new Date().toISOString();
    useCorpusStore.getState().setClusters(COMPANY_ID, [
      {
        id: 'cl1', companyId: COMPANY_ID, corpusVersion: 1, label: 'Alpha',
        status: 'proposed', messageIds: ['m1', 'm2'], source: 'mining',
        validationStatus: 'provisional', createdAt: now, updatedAt: now,
      },
      {
        id: 'cl2', companyId: COMPANY_ID, corpusVersion: 1, label: 'Beta',
        status: 'proposed', messageIds: ['m3'], source: 'mining',
        validationStatus: 'provisional', createdAt: now, updatedAt: now,
      },
    ]);

    const merged = useCorpusStore.getState().mergeClusters(COMPANY_ID, ['cl1', 'cl2'], 'Alpha+Beta');
    expect(merged).not.toBeNull();
    expect(merged!.messageIds.sort()).toEqual(['m1', 'm2', 'm3']);
    expect(merged!.label).toBe('Alpha+Beta');

    const clusters = useCorpusStore.getState().getCorpus(COMPANY_ID).clusters;
    const cl2 = clusters.find(c => c.id === 'cl2');
    expect(cl2?.status).toBe('merged');
  });

  it('mergeClusters returns null when fewer than 2 sources provided', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    const result = useCorpusStore.getState().mergeClusters(COMPANY_ID, ['cl1']);
    expect(result).toBeNull();
  });

  // ── splitCluster ──────────────────────────────────────────────────────────

  it('splitCluster creates new cluster and removes messages from parent', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    const now = new Date().toISOString();
    const msgs = ['m1', 'm2', 'm3'].map(id => makeMsg(id, id));
    useCorpusStore.getState().setMessages(COMPANY_ID, msgs);
    useCorpusStore.getState().setClusters(COMPANY_ID, [
      {
        id: 'cl1', companyId: COMPANY_ID, corpusVersion: 1, label: 'Parent',
        status: 'proposed', messageIds: ['m1', 'm2', 'm3'], source: 'mining',
        validationStatus: 'provisional', createdAt: now, updatedAt: now,
      },
    ]);

    const newCluster = useCorpusStore.getState().splitCluster(COMPANY_ID, 'cl1', ['m3'], 'Split Off');
    expect(newCluster).not.toBeNull();
    expect(newCluster!.messageIds).toEqual(['m3']);
    expect(newCluster!.label).toBe('Split Off');

    const corpus = useCorpusStore.getState().getCorpus(COMPANY_ID);
    const parent = corpus.clusters.find(c => c.id === 'cl1')!;
    expect(parent.messageIds.sort()).toEqual(['m1', 'm2']);

    // Messages should have correct clusterId assignments
    const m3 = corpus.messages.find(m => m.id === 'm3')!;
    expect(m3.clusterId).toBe(newCluster!.id);
  });

  it('splitCluster bumps the corpus version', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    const now = new Date().toISOString();
    useCorpusStore.getState().setMessages(COMPANY_ID, [makeMsg('m1', 'a'), makeMsg('m2', 'b')]);
    useCorpusStore.getState().setClusters(COMPANY_ID, [
      {
        id: 'cl1', companyId: COMPANY_ID, corpusVersion: 1, label: 'Parent',
        status: 'proposed', messageIds: ['m1', 'm2'], source: 'mining',
        validationStatus: 'provisional', createdAt: now, updatedAt: now,
      },
    ]);
    const vBefore = useCorpusStore.getState().getCorpus(COMPANY_ID).version;
    useCorpusStore.getState().splitCluster(COMPANY_ID, 'cl1', ['m2'], 'New');
    const vAfter = useCorpusStore.getState().getCorpus(COMPANY_ID).version;
    expect(vAfter).toBeGreaterThan(vBefore);
  });

  it('splitCluster returns null for unknown cluster', () => {
    useCorpusStore.getState().ensureCorpus(COMPANY_ID);
    const result = useCorpusStore.getState().splitCluster(COMPANY_ID, 'no-such-cluster', ['m1'], 'X');
    expect(result).toBeNull();
  });

  // ── evidenceToMined / minedToEvidenceList ─────────────────────────────────

  it('evidenceToMined converts analyzed evidence to MinedMessage shape', () => {
    const now = new Date().toISOString();
    const ev: EvidenceMessage = {
      id: 'ev1',
      rawText: 'Customer said X',
      source: 'paste',
      analyzed: true,
      analysis: { topic: 'Pain', conversionFormulaAspect: 'Anxiety', messageType: 'Social Proof Signal', qualityScore: 0.8 },
      clusterId: 'cl1',
      createdAt: now,
      updatedAt: now,
    };
    const mined = evidenceToMined([ev]);
    expect(mined[0].text).toBe('Customer said X');
    expect(mined[0].topic).toBe('Pain');
    expect(mined[0].conversionFormulaAspect).toBe('Anxiety');
    expect(mined[0].analyzed).toBe(true);
  });

  it('minedToEvidenceList roundtrips back to EvidenceMessage shape', () => {
    const mined = [{ id: 'm1', text: 'Hello', analyzed: false }];
    const evList = minedToEvidenceList(mined, COMPANY_ID);
    expect(evList[0].rawText).toBe('Hello');
    expect(evList[0].source).toBe('paste');
    expect(evList[0].analyzed).toBe(false);
  });
});

// ── Issue 4: Deduplication tests ─────────────────────────────────────────────

describe('corpusStore — deduplication (Issue 4)', () => {
  beforeEach(() => resetStore());

  it('addMessage ignores exact duplicate text', () => {
    const store = useCorpusStore.getState();
    store.ensureCorpus(COMPANY_ID);
    store.addMessage(COMPANY_ID, 'My dog barks too much');
    store.addMessage(COMPANY_ID, 'My dog barks too much'); // exact duplicate
    const corpus = store.getCorpus(COMPANY_ID);
    expect(corpus.messages).toHaveLength(1);
  });

  it('addMessage ignores case/whitespace duplicate', () => {
    const store = useCorpusStore.getState();
    store.ensureCorpus(COMPANY_ID);
    store.addMessage(COMPANY_ID, 'My dog barks too much');
    store.addMessage(COMPANY_ID, '  MY DOG BARKS TOO MUCH  ');
    const corpus = store.getCorpus(COMPANY_ID);
    expect(corpus.messages).toHaveLength(1);
  });

  it('addMessage allows similar but distinct messages', () => {
    const store = useCorpusStore.getState();
    store.ensureCorpus(COMPANY_ID);
    store.addMessage(COMPANY_ID, 'My dog barks too much');
    store.addMessage(COMPANY_ID, 'My dog barks at night');
    const corpus = store.getCorpus(COMPANY_ID);
    expect(corpus.messages).toHaveLength(2);
  });
});

// ── Issue 6: Corpus size cap tests ───────────────────────────────────────────

import { PIPELINE_THRESHOLDS } from '../constants/pipelineThresholds';

describe('corpusStore — size cap (Issue 6)', () => {
  beforeEach(() => resetStore());

  it('addMessage respects MAX_CORPUS_SIZE', () => {
    const store = useCorpusStore.getState();
    store.ensureCorpus(COMPANY_ID);
    for (let i = 0; i < PIPELINE_THRESHOLDS.MAX_CORPUS_SIZE + 10; i++) {
      store.addMessage(COMPANY_ID, `Unique message number ${i} about dogs`);
    }
    const corpus = store.getCorpus(COMPANY_ID);
    expect(corpus.messages.length).toBeLessThanOrEqual(PIPELINE_THRESHOLDS.MAX_CORPUS_SIZE);
  }, 20000);
});

// ── Issue 9: Multi-tenant ownership tests ────────────────────────────────────

describe('corpusStore — ownership (Issue 9)', () => {
  beforeEach(() => {
    resetStore();
    // Reset ownership state
    useCorpusStore.setState({ activeUserId: null, companyOwners: {} });
  });

  it('assertCompanyAccess throws when wrong user tries to access company', () => {
    const store = useCorpusStore.getState();
    store.setActiveUser('user_A');
    store.registerCompanyOwner('co1', 'user_B');
    expect(() => store.assertCompanyAccess('co1')).toThrow('Access denied');
  });

  it('assertCompanyAccess passes when user owns the company', () => {
    const store = useCorpusStore.getState();
    store.setActiveUser('user_A');
    store.registerCompanyOwner('co1', 'user_A');
    expect(() => store.assertCompanyAccess('co1')).not.toThrow();
  });

  it('assertCompanyAccess skips check when no activeUserId is set (backward compat)', () => {
    const store = useCorpusStore.getState();
    store.setActiveUser(null as any);
    store.registerCompanyOwner('co1', 'user_B');
    expect(() => store.assertCompanyAccess('co1')).not.toThrow();
  });

  it('addMessage throws when wrong user tries to add to a company', () => {
    const store = useCorpusStore.getState();
    store.ensureCorpus('co1');
    store.setActiveUser('user_A');
    store.registerCompanyOwner('co1', 'user_B');
    expect(() => store.addMessage('co1', 'test message')).toThrow('Access denied');
  });
});
