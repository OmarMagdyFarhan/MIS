/**
 * corpusHealth — pure diagnostic functions for corpus quality assessment.
 * This module has no side effects, takes snapshots of the three arrays,
 * and is safe to call on every render inside a useMemo.
 * No React imports. No Zustand imports. No AI calls.
 */
import type { EvidenceMessage, Cluster, CorpusIngest, IngestSource } from '../types/pipeline';

export const INGEST_SOURCE_LABELS: Record<IngestSource, string> = {
  amazon_reviews: 'Amazon Reviews',
  reddit: 'Reddit',
  support_chat: 'Support Chat',
  customer_interview: 'Customer Interview',
  survey_response: 'Survey Response',
  social_media: 'Social Media',
  manual_paste: 'Manual Paste',
  csv_import: 'CSV Import',
  unknown: 'Unknown',
};

export interface CoverageMetrics {
  total: number;
  analyzed: number;
  raw: number;
  pct: number;
}

export interface SourceStrengthEntry {
  source: IngestSource;
  label: string;
  messageCount: number;
  analyzedCount: number;
  signalCount: number;
  density: number;
}

export interface ClusterHealthEntry {
  clusterId: string;
  label: string;
  messageCount: number;
  dominantEmotion: string;
  isThin: boolean;
  analyzedCount: number;
  coveragePct: number;
}

export interface CorpusHealth {
  coverage: CoverageMetrics;
  sourceStrength: SourceStrengthEntry[];
  clusterHealth: ClusterHealthEntry[];
  lastUpdatedAt: string | null;
  thinClusterCount: number;
}

function countSignals(m: EvidenceMessage): number {
  const ca = m.analysis?.conversionAspects as any;
  if (!ca) return 0;
  return [
    ca.motivation?.desiredOutcomes,
    ca.motivation?.painPoints,
    ca.motivation?.purchasePrompts,
    ca.value?.uniqueBenefits,
    ca.value?.delightfulFeatures,
    ca.value?.dealreakerNeeds,
    ca.anxiety?.uncertainties,
    ca.anxiety?.objections,
    ca.anxiety?.perceivedRisks,
  ].reduce((sum: number, arr: any[] | undefined) => sum + (arr?.length ?? 0), 0);
}

/**
 * Compute corpus health diagnostics.
 * This function has no side effects, takes snapshots of the three arrays,
 * and is safe to call on every render inside a useMemo.
 */
export function computeCorpusHealth(
  messages: EvidenceMessage[],
  clusters: Cluster[],
  ingests: CorpusIngest[]
): CorpusHealth {
  // A. Coverage
  const total = messages.length;
  const analyzed = messages.filter(m => m.analyzed).length;
  const raw = total - analyzed;
  const pct = total === 0 ? 0 : analyzed / total;
  const coverage: CoverageMetrics = { total, analyzed, raw, pct };

  // B. Source Strength
  const sourceMap: Record<string, { msgs: EvidenceMessage[]; source: IngestSource }> = {};
  for (const m of messages) {
    const src = ((m as any).source as IngestSource) || 'unknown';
    if (!sourceMap[src]) sourceMap[src] = { msgs: [], source: src };
    sourceMap[src].msgs.push(m);
  }

  const sourceStrength: SourceStrengthEntry[] = Object.entries(sourceMap).map(([src, { msgs, source }]) => {
    const analyzedMsgs = msgs.filter(m => m.analyzed);
    const signalCount = analyzedMsgs.reduce((sum, m) => sum + countSignals(m), 0);
    const density = analyzedMsgs.length === 0 ? 0 : signalCount / analyzedMsgs.length;
    return {
      source,
      label: INGEST_SOURCE_LABELS[source] ?? src,
      messageCount: msgs.length,
      analyzedCount: analyzedMsgs.length,
      signalCount,
      density,
    };
  }).sort((a, b) => b.density - a.density).slice(0, 5);

  // C. Cluster Health
  const clusterHealth: ClusterHealthEntry[] = clusters.map(c => {
    const clusterMsgs = messages.filter(m => c.messageIds.includes(m.id));
    const msgCount = clusterMsgs.length;
    const analyzedCount = clusterMsgs.filter(m => m.analyzed).length;
    const coveragePct = msgCount === 0 ? 0 : analyzedCount / msgCount;
    const dominantEmotion = (c as any).clusterEmotions?.[0] ?? (c as any).dominantEmotion ?? 'Unknown';
    return {
      clusterId: c.id,
      label: c.label,
      messageCount: msgCount,
      dominantEmotion: typeof dominantEmotion === 'string' ? dominantEmotion : 'Unknown',
      isThin: msgCount < 3,
      analyzedCount,
      coveragePct,
    };
  }).sort((a, b) => {
    if (a.isThin !== b.isThin) return a.isThin ? -1 : 1;
    return b.messageCount - a.messageCount;
  });

  const thinClusterCount = clusterHealth.filter(c => c.isThin).length;

  // Last updated
  const lastUpdatedAt = ingests.length > 0
    ? ingests.reduce((latest, i) => i.addedAt > latest ? i.addedAt : latest, ingests[0].addedAt)
    : null;

  return { coverage, sourceStrength, clusterHealth, lastUpdatedAt, thinClusterCount };
}
