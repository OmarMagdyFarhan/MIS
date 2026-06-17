import type { Cluster, EvidenceMessage } from '../types/pipeline';
import type { ConversionFormulaAspect } from '../types';
import { PIPELINE_THRESHOLDS } from '../constants/pipelineThresholds';

export interface ClusterSignalGroup {
  aspect: ConversionFormulaAspect;
  messageIds: string[];
  suggestedLabel: string;
}

export interface ClusterIntegrityReport {
  clusterId: string;
  cohesionScore: number;
  isPure: boolean;
  signalGroups: ClusterSignalGroup[];
  splitRecommended: boolean;
  reason?: string;
}

export function analyzeClusterIntegrity(
  cluster: Cluster,
  messages: EvidenceMessage[]
): ClusterIntegrityReport {
  const members = messages.filter(
    m => cluster.messageIds.includes(m.id) && m.analyzed && m.analysis
  );

  const cohesionScore = cluster.cohesionScore ?? 0;
  const splitRecommended =
    cohesionScore < PIPELINE_THRESHOLDS.CLUSTER_SPLIT_THRESHOLD && members.length >= 4;

  const byAspect = new Map<ConversionFormulaAspect, EvidenceMessage[]>();
  for (const m of members) {
    const aspect = m.analysis!.conversionFormulaAspect;
    if (!aspect) continue;
    if (!byAspect.has(aspect)) byAspect.set(aspect, []);
    byAspect.get(aspect)!.push(m);
  }

  const signalGroups: ClusterSignalGroup[] = Array.from(byAspect.entries())
    .filter(([, msgs]) => msgs.length >= 2)
    .map(([aspect, msgs]) => ({
      aspect,
      messageIds: msgs.map(m => m.id),
      suggestedLabel: buildGroupLabel(aspect, msgs),
    }));

  const isPure =
    signalGroups.length <= 1 ||
    cohesionScore >= PIPELINE_THRESHOLDS.CLUSTER_SPLIT_THRESHOLD;

  const reason = !isPure
    ? `${signalGroups.length} distinct signal groups (${signalGroups
        .map(g => `${g.aspect}: ${g.messageIds.length}`)
        .join(', ')})`
    : undefined;

  return { clusterId: cluster.id, cohesionScore, isPure, signalGroups, splitRecommended, reason };
}

function buildGroupLabel(aspect: ConversionFormulaAspect, msgs: EvidenceMessage[]): string {
  const topics = msgs.map(m => m.analysis?.topic ?? '').filter(Boolean);
  const topTopic = mostFrequent(topics) ?? aspect;
  return `${topTopic} (${aspect})`;
}

function mostFrequent(arr: string[]): string | undefined {
  const freq = new Map<string, number>();
  for (const v of arr) freq.set(v, (freq.get(v) ?? 0) + 1);
  let best: string | undefined;
  let bestCount = 0;
  for (const [v, c] of freq) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best;
}

export function splitClusterByAspect(
  cluster: Cluster,
  report: ClusterIntegrityReport,
  corpusVersion: number
): Cluster[] {
  const now = new Date().toISOString();
  return report.signalGroups.map((group, i) => ({
    ...cluster,
    id: `${cluster.id}_split_${i}_${Date.now()}`,
    label: group.suggestedLabel,
    messageIds: group.messageIds,
    status: 'proposed' as const,
    validationStatus: 'provisional' as const,
    cohesionScore: undefined,
    corpusVersion,
    createdAt: now,
    updatedAt: now,
  }));
}
