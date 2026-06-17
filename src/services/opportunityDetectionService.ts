import type { Avatar } from '../types';
import type { Cluster, EvidenceMessage } from '../types/pipeline';
import { computeClusterCohesion } from './confidenceService';

export interface DetectedOpportunity {
  cluster: Cluster;
  messageCount: number;
  cohesionScore: number;
  dominantAspects: string[];
  topQuotes: string[];            // top 3 rawText excerpts by quality
  opportunityScore: number;       // 0–1: how valuable this opportunity is
  reason: string;
}

const MIN_MESSAGES_OPPORTUNITY = 5;
const MIN_COHESION_OPPORTUNITY = 0.5;

export function detectOpportunities(
  clusters: Cluster[],
  avatars: Avatar[],
  messages: EvidenceMessage[]
): DetectedOpportunity[] {
  // Collect all cluster IDs that have a validated avatar
  const coveredClusterIds = new Set(
    avatars
      .filter(a => a.validationStatus === 'validated' || a.acquisitionSource === 'mining')
      .map(a => a.clusterId)
      .filter((id): id is string => Boolean(id))
  );

  const opportunities: DetectedOpportunity[] = [];

  for (const cluster of clusters) {
    // Skip archived, merged, or already-covered clusters
    if (cluster.status === 'archived' || cluster.status === 'merged') continue;
    if (coveredClusterIds.has(cluster.id)) continue;

    const clusterMessages = messages.filter(
      m => cluster.messageIds.includes(m.id) && m.analyzed
    );

    if (clusterMessages.length < MIN_MESSAGES_OPPORTUNITY) continue;

    const cohesionScore = computeClusterCohesion(cluster, messages);
    if (cohesionScore < MIN_COHESION_OPPORTUNITY) continue;

    const aspectFreq = new Map<string, number>();
    for (const m of clusterMessages) {
      const a = m.analysis!.conversionFormulaAspect;
      aspectFreq.set(a, (aspectFreq.get(a) ?? 0) + 1);
    }
    const dominantAspects = [...aspectFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    const topQuotes = clusterMessages
      .sort((a, b) => (b.analysis?.qualityScore ?? 0) - (a.analysis?.qualityScore ?? 0))
      .slice(0, 3)
      .map(m => m.rawText.slice(0, 150));

    // Score: volume (50%) + cohesion (50%)
    const volumeScore = Math.min(1, clusterMessages.length / 20);
    const opportunityScore = volumeScore * 0.5 + cohesionScore * 0.5;

    const reason = `${clusterMessages.length} messages, ${Math.round(cohesionScore * 100)}% cohesion — no avatar created yet`;

    opportunities.push({
      cluster,
      messageCount: clusterMessages.length,
      cohesionScore,
      dominantAspects,
      topQuotes,
      opportunityScore,
      reason,
    });
  }

  return opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);
}
