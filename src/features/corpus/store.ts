import { create } from 'zustand';
import { StorageManager } from '../../lib/storage';
import { markStale, EMPTY_STALE } from '../../lib/pipelineGraph';
import type {
  AcquisitionMode,
  AnalysisRun,
  Cluster,
  CorpusIngest,
  EvidenceMessage,
  EvidenceSource,
  MiningCorpus,
  PipelinePhase,
} from '../../types/pipeline';
import { MinedMessage } from '../../types';
import { resolveEmotion } from '../../lib/emotionMap';
import { getEventBus } from '../../App';
import type { CommentAddedEvent } from '../../types/phase10';
import { PIPELINE_THRESHOLDS } from '../../constants/pipelineThresholds';

const CORPUS_KEY = 'mis_intelligence_corpora';
const LEGACY_SESSIONS_KEY = 'mis_message_mining_sessions';

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Issue 4: Text normalization for dedup ────────────────────────────────────
function normalizeText(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createEmptyCorpus(companyId: string, mode: AcquisitionMode = 'hybrid'): MiningCorpus {
  const now = new Date().toISOString();
  return {
    companyId,
    version: 1,
    mode,
    messages: [],
    clusters: [],
    runs: [],
    createdAt: now,
    updatedAt: now,
  };
}

function minedToEvidence(m: MinedMessage, companyId: string): EvidenceMessage {
  const now = new Date().toISOString();
  return {
    id: m.id,
    rawText: m.text,
    source: 'paste',
    analyzed: m.analyzed,
    analysis:
      m.topic && m.conversionFormulaAspect && m.messageType
        ? {
            topic: m.topic,
            conversionFormulaAspect: m.conversionFormulaAspect,
            subAspect: m.subAspect,
            secondaryAspect: m.secondaryAspect,
            secondarySubAspect: m.secondarySubAspect,
            conversionSignalTags: m.conversionSignalTags,
            messageType: m.messageType,
            qualityScore: Math.min(1, m.text.trim().length / 120),
            emotion: m.emotion,
          }
        : undefined,
    clusterId: null,
    createdAt: now,
    updatedAt: now,
  };
}

interface CorpusState {
  corpora: Record<string, MiningCorpus>;
  hydrated: boolean;

  // ── Issue 9: Multi-tenant ownership ──────────────────────────────────────
  activeUserId: string | null;
  companyOwners: Record<string, string>; // companyId → userId

  getCorpus: (companyId: string) => MiningCorpus;
  ensureCorpus: (companyId: string, mode?: AcquisitionMode) => MiningCorpus;
  setMode: (companyId: string, mode: AcquisitionMode) => void;
  bumpVersion: (companyId: string) => number;

  setMessages: (companyId: string, messages: EvidenceMessage[]) => void;
  addMessage: (companyId: string, rawText: string, source?: EvidenceSource) => EvidenceMessage;
  updateMessage: (companyId: string, messageId: string, patch: Partial<EvidenceMessage>) => void;
  removeMessage: (companyId: string, messageId: string) => void;

  setClusters: (companyId: string, clusters: Cluster[]) => void;
  upsertCluster: (companyId: string, cluster: Cluster) => void;
  mergeClusters: (companyId: string, sourceIds: string[], targetLabel?: string) => Cluster | null;
  splitCluster: (
    companyId: string,
    clusterId: string,
    messageIdsForNew: string[],
    newLabel: string
  ) => Cluster | null;

  addRun: (companyId: string, run: AnalysisRun) => void;
  completeRun: (companyId: string, runId: string, status: 'completed' | 'failed', error?: string) => void;
  addIngest: (companyId: string, ingest: CorpusIngest) => void;

  // Issue 9 actions
  setActiveUser: (userId: string) => void;
  registerCompanyOwner: (companyId: string, userId: string) => void;
  assertCompanyAccess: (companyId: string) => void;

  importLegacySessions: (sessions: Record<string, { companyId: string; messages: MinedMessage[] }>) => void;
  loadFromStorage: () => Promise<void>;
  persist: () => Promise<void>;
}

export const useCorpusStore = create<CorpusState>((set, get) => ({
  corpora: {},
  hydrated: false,

  // Issue 9: Initial ownership state
  activeUserId: null,
  companyOwners: {},

  getCorpus: companyId => {
    return get().corpora[companyId] ?? createEmptyCorpus(companyId);
  },

  ensureCorpus: (companyId, mode) => {
    const existing = get().corpora[companyId];
    if (existing) return existing;
    const corpus = createEmptyCorpus(companyId, mode);
    set(s => ({ corpora: { ...s.corpora, [companyId]: corpus } }));
    void get().persist();
    return corpus;
  },

  setMode: (companyId, mode) => {
    const corpus = get().ensureCorpus(companyId, mode);
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: { ...corpus, mode, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
  },

  bumpVersion: companyId => {
    const corpus = get().ensureCorpus(companyId);
    const version = corpus.version + 1;
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: { ...corpus, version, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
    return version;
  },

  setMessages: (companyId, messages) => {
    const corpus = get().ensureCorpus(companyId);
    // Issue 4: Dedup in bulk setMessages
    const seen = new Set<string>();
    const deduped = messages.filter(m => {
      const key = normalizeText(m.rawText);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: { ...corpus, messages: deduped, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
  },

  addMessage: (companyId, rawText, source = 'paste') => {
    // Issue 9: Access check
    get().assertCompanyAccess(companyId);

    const corpus = get().ensureCorpus(companyId);

    // Issue 4: Dedup check
    const normalized = normalizeText(rawText);
    const isDuplicate = corpus.messages.some(m => normalizeText(m.rawText) === normalized);
    if (isDuplicate) {
      const existing = corpus.messages.find(m => normalizeText(m.rawText) === normalized)!;
      return existing;
    }

    // Issue 6: Corpus size cap
    if (corpus.messages.length >= PIPELINE_THRESHOLDS.MAX_CORPUS_SIZE) {
      console.warn(`[Corpus] Max size reached (${PIPELINE_THRESHOLDS.MAX_CORPUS_SIZE}). Message not added.`);
      return corpus.messages[corpus.messages.length - 1];
    }

    const msg: EvidenceMessage = {
      id: uid('ev'),
      rawText,
      source,
      analyzed: false,
      clusterId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    get().bumpVersion(companyId);
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: {
          ...corpus,
          version: (s.corpora[companyId]?.version ?? corpus.version),
          messages: [...corpus.messages, msg],
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    void get().persist();

    // Addendum A Rule 4: mark new-evidence so user can explicitly trigger re-analysis
    import('../../stores/pipelineStore').then(({ usePipelineStore }) => {
      usePipelineStore.getState().setSystemState(companyId, 'new-evidence');
    }).catch(() => {/* non-critical */});

    // ✅ Phase 10: Publish CommentAdded event so the event pipeline activates
    const eventBus = getEventBus();
    if (eventBus) {
      const event: CommentAddedEvent = {
        id: `comment-${msg.id}`,
        timestamp: Date.now(),
        aggregateId: msg.id,
        version: 1,
        eventType: 'CommentAdded',
        data: {
          commentId: msg.id,
          text: rawText,
          clusterId: companyId,
        },
      };
      eventBus.publish(event).catch(err =>
        console.error('[Phase 10] Failed to publish CommentAdded:', err)
      );
      console.log('[Phase 10] Published CommentAdded event:', msg.id);
    }

    return msg;
  },

  updateMessage: (companyId, messageId, patch) => {
    const corpus = get().ensureCorpus(companyId);
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: {
          ...corpus,
          messages: corpus.messages.map(m =>
            m.id === messageId ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m
          ),
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    void get().persist();
  },

  removeMessage: (companyId, messageId) => {
    // Issue 9: Access check
    get().assertCompanyAccess(companyId);

    const corpus = get().ensureCorpus(companyId);
    get().bumpVersion(companyId);
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: {
          ...corpus,
          messages: corpus.messages.filter(m => m.id !== messageId),
          clusters: corpus.clusters.map(c => ({
            ...c,
            messageIds: c.messageIds.filter(id => id !== messageId),
          })),
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    void get().persist();
  },

  setClusters: (companyId, clusters) => {
    // Issue 9: Access check
    get().assertCompanyAccess(companyId);

    const corpus = get().ensureCorpus(companyId);
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: { ...corpus, clusters, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
  },

  upsertCluster: (companyId, cluster) => {
    const corpus = get().ensureCorpus(companyId);
    const exists = corpus.clusters.some(c => c.id === cluster.id);
    const clusters = exists
      ? corpus.clusters.map(c => (c.id === cluster.id ? cluster : c))
      : [...corpus.clusters, cluster];
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: { ...corpus, clusters, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
  },

  mergeClusters: (companyId, sourceIds, targetLabel) => {
    const corpus = get().ensureCorpus(companyId);
    const sources = corpus.clusters.filter(c => sourceIds.includes(c.id));
    if (sources.length < 2) return null;
    const messageIds = [...new Set(sources.flatMap(c => c.messageIds))];
    const targetId = sources[0].id;
    const target: Cluster = {
      ...sources[0],
      id: targetId,
      label: targetLabel || sources[0].label,
      messageIds,
      status: 'validated',
      validationStatus: 'validated',
      source: 'mixed',
      updatedAt: new Date().toISOString(),
    };
    const merged = corpus.clusters.map(c => {
      if (c.id === targetId) return target;
      if (sourceIds.includes(c.id)) return { ...c, status: 'merged' as const, messageIds: [] as string[] };
      return c;
    });

    get().setClusters(companyId, merged);
    return target;
  },

  splitCluster: (companyId, clusterId, messageIdsForNew, newLabel) => {
    const corpus = get().ensureCorpus(companyId);
    const parent = corpus.clusters.find(c => c.id === clusterId);
    if (!parent) return null;
    const newCluster: Cluster = {
      id: uid('cl'),
      companyId,
      corpusVersion: corpus.version,
      label: newLabel,
      status: 'proposed',
      messageIds: messageIdsForNew,
      source: parent.source,
      validationStatus: 'provisional',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedParent: Cluster = {
      ...parent,
      messageIds: parent.messageIds.filter(id => !messageIdsForNew.includes(id)),
      updatedAt: new Date().toISOString(),
    };
    const clusters = [
      ...corpus.clusters.map(c => (c.id === clusterId ? updatedParent : c)),
      newCluster,
    ];
    get().setClusters(companyId, clusters);
    const messages = corpus.messages.map(m => {
      if (messageIdsForNew.includes(m.id)) {
        return { ...m, clusterId: newCluster.id, updatedAt: new Date().toISOString() };
      }
      if (m.clusterId === clusterId && !messageIdsForNew.includes(m.id)) {
        return { ...m, clusterId: updatedParent.id, updatedAt: new Date().toISOString() };
      }
      return m;
    });
    get().setMessages(companyId, messages);
    get().bumpVersion(companyId);
    return newCluster;
  },

  addRun: (companyId, run) => {
    const corpus = get().ensureCorpus(companyId);
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: { ...corpus, runs: [...corpus.runs, run], updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
  },

  completeRun: (companyId, runId, status, error) => {
    const corpus = get().ensureCorpus(companyId);
    set(s => ({
      corpora: {
        ...s.corpora,
        [companyId]: {
          ...corpus,
          runs: corpus.runs.map(r =>
            r.id === runId
              ? { ...r, status, error, finishedAt: new Date().toISOString() }
              : r
          ),
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    void get().persist();
  },

  addIngest: (companyId, ingest) => {
    const corpus = get().getCorpus(companyId);
    set(state => ({
      corpora: {
        ...state.corpora,
        [companyId]: {
          ...corpus,
          ingests: [...(corpus.ingests ?? []), ingest],
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    void get().persist();
  },

  // ── Issue 9: Ownership actions ───────────────────────────────────────────
  setActiveUser: (userId) => {
    set({ activeUserId: userId });
  },

  registerCompanyOwner: (companyId, userId) => {
    set(s => ({ companyOwners: { ...s.companyOwners, [companyId]: userId } }));
  },

  assertCompanyAccess: (companyId) => {
    const { activeUserId, companyOwners } = get();
    if (!activeUserId) return; // no auth configured — skip (backward compat)
    const owner = companyOwners[companyId];
    if (owner && owner !== activeUserId) {
      throw new Error(`Access denied: company ${companyId} belongs to a different user`);
    }
  },

  importLegacySessions: sessions => {
    const byCompany: Record<string, EvidenceMessage[]> = {};
    for (const session of Object.values(sessions)) {
      if (!session?.companyId) continue;
      const msgs = (session.messages || []).map(m => minedToEvidence(m, session.companyId));
      byCompany[session.companyId] = [...(byCompany[session.companyId] || []), ...msgs];
    }
    set(s => {
      const corpora = { ...s.corpora };
      for (const [companyId, messages] of Object.entries(byCompany)) {
        const existing = corpora[companyId] ?? createEmptyCorpus(companyId);
        const mergedIds = new Set(existing.messages.map(m => m.id));
        const deduped = [...existing.messages, ...messages.filter(m => !mergedIds.has(m.id))];
        corpora[companyId] = {
          ...existing,
          messages: deduped.length ? deduped : [{ ...messages[0], id: uid('ev'), rawText: '', analyzed: false }],
          updatedAt: new Date().toISOString(),
        };
      }
      return { corpora };
    });
  },

  loadFromStorage: async () => {
    const corpora = await StorageManager.load<Record<string, MiningCorpus>>(CORPUS_KEY, {});
    const legacy = await StorageManager.load<Record<string, { companyId: string; messages: MinedMessage[] }>>(
      LEGACY_SESSIONS_KEY,
      {}
    );
    if (Object.keys(legacy).length > 0 && Object.keys(corpora).length === 0) {
      get().importLegacySessions(legacy as any);
    } else {
      set({ corpora });
    }
    set({ hydrated: true });
    await get().persist();
  },

  persist: async () => {
    await StorageManager.save(CORPUS_KEY, get().corpora);
  },
}));

/** Evidence rows as MinedMessage for legacy mining UI */
export function evidenceToMined(messages: EvidenceMessage[]): MinedMessage[] {
  return messages.map(m => ({
    id: m.id,
    text: m.rawText,
    topic: m.analysis?.topic,
    conversionFormulaAspect: m.analysis?.conversionFormulaAspect,
    messageType: m.analysis?.messageType,
    analyzed: m.analyzed,
    matchedAvatarId: undefined,
    subAspect: m.analysis?.subAspect,
    secondaryAspect: m.analysis?.secondaryAspect,
    secondarySubAspect: m.analysis?.secondarySubAspect,
    conversionSignalTags: m.analysis?.conversionSignalTags,
    emotion: m.analysis?.emotion,
    resolvedEmotion: m.analysis?.emotion
      ? resolveEmotion(m.analysis.emotion)
      : undefined,
  }));
}

export function minedToEvidenceList(messages: MinedMessage[], companyId: string): EvidenceMessage[] {
  return messages.map(m => minedToEvidence(m, companyId));
}
