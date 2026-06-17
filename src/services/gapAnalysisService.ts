import type { Avatar, CitedClaim } from '../types';
import type { Cluster, EvidenceMessage } from '../types/pipeline';
import { getClaimSources } from '../types';
import { analyzeClusterIntegrity } from './clusterIntegrityService';

export interface ClaimGap {
  fieldPath: string;
  label: string;
  currentConfidence: number;
  supportingMessageCount: number;
  gapDescription: string;
  suggestedAction: string;
}

export interface AvatarGapReport {
  avatarId: string;
  avatarName: string;
  overallConfidence: number;         // from evidenceSnapshot or synthesis.confidenceScore
  targetConfidence: number;          // always 0.8
  gaps: ClaimGap[];
  clusterHealthWarning?: string;     // set if cluster is impure
  totalMissingMessages: number;      // estimated messages needed to close all gaps
  isReadyForCampaign: boolean;       // true if overallConfidence >= 0.8 and no critical gaps
}

const TARGET_CONFIDENCE = 0.8;
const MIN_SUPPORTING_MESSAGES = 3;

export function analyzeAvatarGaps(
  avatar: Avatar,
  cluster: Cluster | undefined,
  messages: EvidenceMessage[]
): AvatarGapReport {
  const overallConfidence = avatar.evidenceSnapshot?.confidenceScore
    ?? avatar.synthesis?.confidenceScore
    ?? 0;

  const gaps: ClaimGap[] = [];

  const SYNTHESIS_FIELDS: Array<{
    key: keyof NonNullable<Avatar['synthesis']>;
    label: string;
    fieldPath: string;
  }> = [
    { key: 'realPrimaryMotivation', label: 'Primary Motivation', fieldPath: 'synthesis.realPrimaryMotivation' },
    { key: 'realPrimaryBlocker',    label: 'Primary Blocker',    fieldPath: 'synthesis.realPrimaryBlocker' },
    { key: 'actualBuyingWindow',    label: 'Buying Window',      fieldPath: 'synthesis.actualBuyingWindow' },
    { key: 'winningApproach',       label: 'Winning Approach',   fieldPath: 'synthesis.winningApproach' },
    { key: 'uniqueInsight',         label: 'Unique Insight',     fieldPath: 'synthesis.uniqueInsight' },
  ];

  for (const { key, label, fieldPath } of SYNTHESIS_FIELDS) {
    const field = avatar.synthesis?.[key];
    if (!field) {
      gaps.push({
        fieldPath,
        label,
        currentConfidence: 0,
        supportingMessageCount: 0,
        gapDescription: 'Field not yet synthesized.',
        suggestedAction: 'Run deep dive to generate this field.',
      });
      continue;
    }

    const isCited = typeof field === 'object' && 'claim' in field;
    const sourceIds = getClaimSources(field as CitedClaim | string);
    const confidence = isCited ? (field as CitedClaim).confidence : 0;
    const count = sourceIds.length;

    if (count < MIN_SUPPORTING_MESSAGES || confidence < TARGET_CONFIDENCE) {
      const needed = Math.max(0, MIN_SUPPORTING_MESSAGES - count);
      gaps.push({
        fieldPath,
        label,
        currentConfidence: confidence,
        supportingMessageCount: count,
        gapDescription: count === 0
          ? 'No supporting messages linked to this claim.'
          : `Only ${count} supporting message${count === 1 ? '' : 's'} — needs at least ${MIN_SUPPORTING_MESSAGES}.`,
        suggestedAction: needed > 0
          ? `Add ${needed} more message${needed === 1 ? '' : 's'} that directly address "${label.toLowerCase()}" to the corpus.`
          : 'Re-run deep dive with updated corpus to improve confidence.',
      });
    }
  }

  // Cluster health check
  let clusterHealthWarning: string | undefined;
  if (cluster) {
    const integrity = analyzeClusterIntegrity(cluster, messages);
    if (!integrity.isPure) {
      clusterHealthWarning = `Cluster has mixed signals (${integrity.reason}). Split the cluster before trusting this avatar.`;
    }
  }

  const totalMissingMessages = gaps.reduce((sum, g) => {
    return sum + Math.max(0, MIN_SUPPORTING_MESSAGES - g.supportingMessageCount);
  }, 0);

  const isReadyForCampaign =
    overallConfidence >= TARGET_CONFIDENCE &&
    gaps.length === 0 &&
    !clusterHealthWarning;

  return {
    avatarId: avatar.id,
    avatarName: avatar.name,
    overallConfidence,
    targetConfidence: TARGET_CONFIDENCE,
    gaps,
    clusterHealthWarning,
    totalMissingMessages,
    isReadyForCampaign,
  };
}
