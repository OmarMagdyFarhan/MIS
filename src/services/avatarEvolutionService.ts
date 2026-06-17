import type { Avatar, AvatarLifecycleStatus, AvatarEvidenceSnapshot } from '../types';
import type { Cluster, EvidenceMessage } from '../types/pipeline';
import { computeClusterCohesion } from './confidenceService';

const MIN_MESSAGES_ACTIVE = 10;
const MIN_MESSAGES_EMERGING = 3;
const DECLINING_THRESHOLD = -0.15;  // -15% message count
const OBSOLETE_VERSIONS = 3;        // no new messages in 3 corpus versions

export function computeAvatarLifecycle(
  _avatar: Avatar,
  cluster: Cluster,
  _allMessages: EvidenceMessage[],
  _currentCorpusVersion: number
): AvatarLifecycleStatus {
  const messageCount = cluster.messageIds.length;

  if (messageCount < MIN_MESSAGES_EMERGING) return 'emerging';

  // Check for obsolete: no messages added in last OBSOLETE_VERSIONS versions
  const history = cluster.messageCountHistory ?? [];
  if (history.length >= OBSOLETE_VERSIONS) {
    const recent = history.slice(-OBSOLETE_VERSIONS);
    const allSameCount = recent.every(h => h.count === recent[0].count);
    if (allSameCount) return 'obsolete';
  }

  // Check declining
  if (
    cluster.trendDirection === 'declining' ||
    (cluster.trendDelta !== undefined && cluster.trendDelta < DECLINING_THRESHOLD * 100)
  ) {
    return 'declining';
  }

  return messageCount >= MIN_MESSAGES_ACTIVE ? 'active' : 'emerging';
}

export function buildEvidenceSnapshot(
  cluster: Cluster,
  messages: EvidenceMessage[],
  corpusVersion: number
): AvatarEvidenceSnapshot {
  const clusterMessages = messages.filter(
    m => cluster.messageIds.includes(m.id) && m.analyzed
  );

  const cohesion = computeClusterCohesion(cluster, messages);

  const aspectDistribution: Record<string, number> = {};
  for (const m of clusterMessages) {
    const aspect = m.analysis?.conversionFormulaAspect;
    if (aspect) aspectDistribution[aspect] = (aspectDistribution[aspect] ?? 0) + 1;
  }

  const representativeQuotes = clusterMessages
    .filter(m => m.rawText.length > 20)
    .sort((a, b) => (b.analysis?.qualityScore ?? 0) - (a.analysis?.qualityScore ?? 0))
    .slice(0, 3)
    .map(m => m.rawText.slice(0, 150));

  // Confidence: volume (40%) + cohesion (40%) + validated status (20%)
  const volumeScore = Math.min(1, clusterMessages.length / 30);
  const validatedBonus = cluster.validationStatus === 'validated' ? 0.2 : 0;
  const confidenceScore = Math.min(1, volumeScore * 0.4 + cohesion * 0.4 + validatedBonus);

  return {
    messageCount: cluster.messageIds.length,
    clusterCohesion: cohesion,
    confidenceScore,
    representativeQuotes,
    aspectDistribution,
    corpusVersion,
    recordedAt: new Date().toISOString(),
  };
}

export function computeConfidenceDelta(
  current: AvatarEvidenceSnapshot,
  previous?: AvatarEvidenceSnapshot
): { delta: number; direction: 'up' | 'down' | 'stable'; reason: string } {
  if (!previous) return { delta: 0, direction: 'stable', reason: 'No previous snapshot' };

  const delta = current.confidenceScore - previous.confidenceScore;
  const msgDelta = current.messageCount - previous.messageCount;

  if (Math.abs(delta) < 0.03) return { delta: 0, direction: 'stable', reason: 'No significant change' };

  const direction = delta > 0 ? 'up' : 'down';
  const reason = msgDelta > 0
    ? `+${msgDelta} new messages added`
    : msgDelta < 0
    ? `${msgDelta} messages removed`
    : 'Cohesion changed';

  return { delta: Math.round(delta * 100) / 100, direction, reason };
}

export function evolveAvatars(
  avatars: Avatar[],
  clusters: Cluster[],
  messages: EvidenceMessage[],
  currentCorpusVersion: number
): Avatar[] {
  return avatars.map(avatar => {
    const cluster = clusters.find(c => c.id === (avatar.clusterId ?? (avatar as Avatar & { sourceClusterId?: string }).sourceClusterId));
    if (!cluster) return avatar;

    const currentSnapshot = buildEvidenceSnapshot(cluster, messages, currentCorpusVersion);
    const lifecycleStatus = computeAvatarLifecycle(avatar, cluster, messages, currentCorpusVersion);

    return {
      ...avatar,
      lifecycleStatus,
      previousSnapshot: avatar.evidenceSnapshot,
      evidenceSnapshot: currentSnapshot,
    };
  });
}
