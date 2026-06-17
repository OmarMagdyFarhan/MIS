import type { Avatar } from '../types';
import type { Cluster, EvidenceMessage } from '../types/pipeline';
import { getClaimText, getClaimSources } from '../types';

export interface ClaimComparison {
  fieldPath: string;
  label: string;
  avatarA: { text: string; confidence?: number; sourceCount: number };
  avatarB: { text: string; confidence?: number; sourceCount: number };
  divergenceType: 'identical' | 'similar' | 'opposite' | 'one_missing';
}

export interface AvatarComparisonReport {
  avatarA: { id: string; name: string; messageCount: number };
  avatarB: { id: string; name: string; messageCount: number };
  claimComparisons: ClaimComparison[];
  aspectOverlap: number;           // Jaccard similarity of dominant aspects
  evidenceOverlap: number;         // % of shared supporting message IDs
  recommendedAction: 'keep_both' | 'consider_merge' | 'review_split';
  reasoning: string;
}

const SYNTHESIS_FIELDS: Array<{
  key: keyof NonNullable<Avatar['synthesis']>;
  label: string;
  fieldPath: string;
}> = [
  { key: 'realPrimaryMotivation', label: 'Primary Motivation',  fieldPath: 'synthesis.realPrimaryMotivation' },
  { key: 'realPrimaryBlocker',    label: 'Primary Blocker',     fieldPath: 'synthesis.realPrimaryBlocker' },
  { key: 'actualBuyingWindow',    label: 'Buying Window',       fieldPath: 'synthesis.actualBuyingWindow' },
  { key: 'winningApproach',       label: 'Winning Approach',    fieldPath: 'synthesis.winningApproach' },
  { key: 'uniqueInsight',         label: 'Unique Insight',      fieldPath: 'synthesis.uniqueInsight' },
];

export function compareAvatars(
  avatarA: Avatar,
  avatarB: Avatar,
  clusterA: Cluster | undefined,
  clusterB: Cluster | undefined,
  messages: EvidenceMessage[]
): AvatarComparisonReport {
  const claimComparisons: ClaimComparison[] = SYNTHESIS_FIELDS.map(({ key, label, fieldPath }) => {
    const fieldA = avatarA.synthesis?.[key];
    const fieldB = avatarB.synthesis?.[key];

    const textA = getClaimText(fieldA as any);
    const textB = getClaimText(fieldB as any);

    const confA = typeof fieldA === 'object' && fieldA && 'confidence' in fieldA
      ? (fieldA as any).confidence as number : undefined;
    const confB = typeof fieldB === 'object' && fieldB && 'confidence' in fieldB
      ? (fieldB as any).confidence as number : undefined;

    const sourceCountA = getClaimSources(fieldA as any).length;
    const sourceCountB = getClaimSources(fieldB as any).length;

    const divergenceType = classifyDivergence(textA, textB);

    return {
      fieldPath,
      label,
      avatarA: { text: textA, confidence: confA, sourceCount: sourceCountA },
      avatarB: { text: textB, confidence: confB, sourceCount: sourceCountB },
      divergenceType,
    };
  });

  // Aspect overlap (Jaccard)
  const aspectsA = new Set(
    messages.filter(m => clusterA?.messageIds.includes(m.id))
      .map(m => m.analysis?.conversionFormulaAspect).filter(Boolean)
  );
  const aspectsB = new Set(
    messages.filter(m => clusterB?.messageIds.includes(m.id))
      .map(m => m.analysis?.conversionFormulaAspect).filter(Boolean)
  );
  const intersection = [...aspectsA].filter(x => aspectsB.has(x)).length;
  const union = new Set([...aspectsA, ...aspectsB]).size;
  const aspectOverlap = union > 0 ? intersection / union : 0;

  // Evidence overlap — shared supporting message IDs
  const allSourceIdsA = new Set(
    SYNTHESIS_FIELDS.flatMap(({ key }) => getClaimSources((avatarA.synthesis?.[key]) as any))
  );
  const allSourceIdsB = new Set(
    SYNTHESIS_FIELDS.flatMap(({ key }) => getClaimSources((avatarB.synthesis?.[key]) as any))
  );
  const sharedSources = [...allSourceIdsA].filter(id => allSourceIdsB.has(id)).length;
  const totalSources = new Set([...allSourceIdsA, ...allSourceIdsB]).size;
  const evidenceOverlap = totalSources > 0 ? sharedSources / totalSources : 0;

  const { recommendedAction, reasoning } = classifyRecommendation(
    aspectOverlap, evidenceOverlap, claimComparisons
  );

  return {
    avatarA: {
      id: avatarA.id, name: avatarA.name,
      messageCount: clusterA?.messageIds.length ?? 0,
    },
    avatarB: {
      id: avatarB.id, name: avatarB.name,
      messageCount: clusterB?.messageIds.length ?? 0,
    },
    claimComparisons,
    aspectOverlap,
    evidenceOverlap,
    recommendedAction,
    reasoning,
  };
}

function classifyDivergence(a: string, b: string): ClaimComparison['divergenceType'] {
  if (!a || !b) return 'one_missing';
  if (a.toLowerCase() === b.toLowerCase()) return 'identical';
  // Check for opposite keywords
  const oppositeMarkers = [['buy', 'never buy'], ['confident', 'hesitant'], ['trust', 'distrust']];
  for (const [pos, neg] of oppositeMarkers) {
    if ((a.includes(pos) && b.includes(neg)) || (a.includes(neg) && b.includes(pos))) {
      return 'opposite';
    }
  }
  return 'similar';
}

function classifyRecommendation(
  aspectOverlap: number,
  evidenceOverlap: number,
  claims: ClaimComparison[]
): { recommendedAction: AvatarComparisonReport['recommendedAction']; reasoning: string } {
  const oppositeCount = claims.filter(c => c.divergenceType === 'opposite').length;

  if (aspectOverlap > 0.7 && evidenceOverlap > 0.4) {
    return {
      recommendedAction: 'consider_merge',
      reasoning: `High aspect overlap (${Math.round(aspectOverlap * 100)}%) and shared evidence suggest these segments may describe the same customer.`,
    };
  }
  if (oppositeCount >= 2) {
    return {
      recommendedAction: 'keep_both',
      reasoning: `${oppositeCount} opposing psychological claims confirm these are genuinely different customer segments.`,
    };
  }
  return {
    recommendedAction: 'review_split',
    reasoning: 'Moderate overlap. Review cluster assignments to ensure evidence is correctly distributed.',
  };
}
