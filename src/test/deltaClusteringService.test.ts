import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/aiService', () => ({
  generateAIContent: vi.fn(),
}));

import { deltaCluster } from '../features/corpus/services/deltaClusteringService';
import type { Cluster, EvidenceMessage } from '../types/pipeline';
import type { Company } from '../types';

const now = new Date().toISOString();

const mockCompany: Company = {
  id: 'co1',
  name: 'Acme',
  industry: 'SaaS',
  specializations: [],
  usp: 'fast and reliable',
  country: 'Global',
  websiteUrl: '',
  isGlobalMode: true,
  createdAt: now,
};

function makeCluster(id: string, msgIds: string[]): Cluster {
  return {
    id,
    companyId: 'co1',
    corpusVersion: 1,
    label: `Cluster ${id}`,
    status: 'validated',
    messageIds: msgIds,
    source: 'mining',
    validationStatus: 'validated',
    createdAt: now,
    updatedAt: now,
  };
}

function makeMsg(id: string, analyzed = true): EvidenceMessage {
  return {
    id,
    rawText: `Message ${id} about customer pain point`,
    source: 'paste',
    analyzed,
    analysis: analyzed
      ? {
          topic: 'test',
          conversionFormulaAspect: 'Anxiety',
          messageType: 'Uncertainty',
          qualityScore: 0.7,
        }
      : undefined,
    clusterId: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe('deltaCluster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results and unassigned list when no analyzed messages', async () => {
    const result = await deltaCluster(mockCompany, [], [makeMsg('m1', false)], [], 2);
    expect(result.updatedClusters).toHaveLength(0);
    expect(result.newClusters).toHaveLength(0);
    expect(result.unassigned).toContain('m1');
  });

  it('returns unassigned when no existing clusters', async () => {
    const msg = makeMsg('m1');
    const result = await deltaCluster(mockCompany, [], [msg], [msg], 2);
    expect(result.updatedClusters).toHaveLength(0);
    expect(result.unassigned).toContain('m1');
  });

  it('assigns new message to existing cluster when AI returns assignment', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      assignments: [{ messageId: 'new1', clusterId: 'cl1', isNew: false }],
    });

    const cluster = makeCluster('cl1', ['old1']);
    const newMsg = makeMsg('new1');
    const result = await deltaCluster(mockCompany, [cluster], [newMsg], [newMsg], 2);

    expect(result.updatedClusters).toHaveLength(1);
    expect(result.updatedClusters[0].messageIds).toContain('new1');
    expect(result.updatedClusters[0].messageIds).toContain('old1');
  });

  it('sets trendDirection to growing on updated cluster', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      assignments: [{ messageId: 'new1', clusterId: 'cl1', isNew: false }],
    });

    const cluster = makeCluster('cl1', ['old1', 'old2']);
    const newMsg = makeMsg('new1');
    const result = await deltaCluster(mockCompany, [cluster], [newMsg], [newMsg], 2);

    expect(result.updatedClusters[0].trendDirection).toBe('growing');
  });

  it('creates a new cluster when AI marks messages as new', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      assignments: [
        { messageId: 'n1', clusterId: null, isNew: true },
        { messageId: 'n2', clusterId: null, isNew: true },
      ],
    });

    const cluster = makeCluster('cl1', ['old1']);
    const msgs = [makeMsg('n1'), makeMsg('n2')];
    const result = await deltaCluster(mockCompany, [cluster], msgs, msgs, 2);

    expect(result.newClusters).toHaveLength(1);
    expect(result.newClusters[0].messageIds).toContain('n1');
    expect(result.newClusters[0].messageIds).toContain('n2');
    expect(result.newClusters[0].trendDirection).toBe('growing');
  });

  it('puts single new-flagged message in unassigned (not enough for a cluster)', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      assignments: [{ messageId: 'n1', clusterId: null, isNew: true }],
    });

    const cluster = makeCluster('cl1', ['old1']);
    const newMsg = makeMsg('n1');
    const result = await deltaCluster(mockCompany, [cluster], [newMsg], [newMsg], 2);

    expect(result.newClusters).toHaveLength(0);
    expect(result.unassigned).toContain('n1');
  });

  it('falls back gracefully when AI throws', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('AI failure'));

    const cluster = makeCluster('cl1', ['old1']);
    const newMsg = makeMsg('new1');
    const result = await deltaCluster(mockCompany, [cluster], [newMsg], [newMsg], 2);

    expect(result.updatedClusters).toHaveLength(0);
    expect(result.unassigned).toContain('new1');
  });

  it('appends a messageCountHistory entry to updated cluster', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      assignments: [{ messageId: 'new1', clusterId: 'cl1', isNew: false }],
    });

    const cluster = makeCluster('cl1', ['old1']);
    const newMsg = makeMsg('new1');
    const result = await deltaCluster(mockCompany, [cluster], [newMsg], [newMsg], 2);

    const history = result.updatedClusters[0].messageCountHistory ?? [];
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[history.length - 1].corpusVersion).toBe(2);
    expect(history[history.length - 1].count).toBe(2);
  });

  it('skips archived clusters when assigning', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      assignments: [],
    });

    const archivedCluster = { ...makeCluster('cl1', ['old1']), status: 'archived' as const };
    const newMsg = makeMsg('new1');
    const result = await deltaCluster(mockCompany, [archivedCluster], [newMsg], [newMsg], 2);

    // archived cluster → no existing active clusters → unassigned
    expect(result.unassigned).toContain('new1');
  });
});

// ── Issue 2: Clustering offer context test ───────────────────────────────────

import { proposeClustersFromMessages } from '../features/corpus/services/clusteringService';

describe('proposeClustersFromMessages — offer context (Issue 2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes offer context to clustering when offer is provided', async () => {
    const { generateAIContent } = await import('../services/aiService');
    let capturedPrompt = '';
    (generateAIContent as ReturnType<typeof vi.fn>).mockImplementation(async ({ userMessage }: any) => {
      capturedPrompt = userMessage;
      return '{"clusters":[{"label":"test","messageIds":["m1"],"dominantAspects":["Anxiety"],"dominantTypes":["Objection"]}]}';
    });

    const offer = { generatedOffer: 'Train your dog in 30 days' } as any;
    const msgs: any[] = [{
      id: 'm1', rawText: 'my dog barks all night', source: 'paste',
      analyzed: true, clusterId: null, createdAt: now, updatedAt: now,
      analysis: { topic: 'Behavior', conversionFormulaAspect: 'Anxiety', messageType: 'Uncertainty', qualityScore: 0.7 },
    }];
    await proposeClustersFromMessages(mockCompany, msgs, 1, offer);
    expect(capturedPrompt).toContain('Train your dog in 30 days');
  });

  it('works without offer (backward compat)', async () => {
    const { generateAIContent } = await import('../services/aiService');
    (generateAIContent as ReturnType<typeof vi.fn>).mockResolvedValue(
      '{"clusters":[{"label":"test","messageIds":["m1"],"dominantAspects":["Anxiety"],"dominantTypes":["Objection"]}]}'
    );
    const msgs: any[] = [{
      id: 'm1', rawText: 'my dog barks all night', source: 'paste',
      analyzed: true, clusterId: null, createdAt: now, updatedAt: now,
      analysis: { topic: 'Behavior', conversionFormulaAspect: 'Anxiety', messageType: 'Uncertainty', qualityScore: 0.7 },
    }];
    const result = await proposeClustersFromMessages(mockCompany, msgs, 1);
    expect(result).toHaveLength(1);
  });
});
