/**
 * Centralized intelligence pipeline thresholds.
 * Phase 14: Raised to production-grade minimums per audit recommendations.
 */
export const PIPELINE_THRESHOLDS = {
  /** Min messages in a cluster before validation is allowed */
  MIN_MESSAGES_VALIDATED_CLUSTER: 5,       // raised from 2 — prevents single-message avatars

  /** Min messages for high-confidence corpus mode */
  HIGH_CONFIDENCE_MESSAGE_COUNT: 8,

  /** Auto-validate cohesion threshold (0–1) */
  AUTO_VALIDATE_COHESION: 0.65,            // raised from 0.55 per audit recommendation

  /** Jaccard similarity to suggest avatar merge */
  AVATAR_DEDUPE_SIMILARITY: 0.72,

  /** Corpus volume + validated cluster for validated confidence status */
  CORPUS_VALIDATED_MESSAGE_COUNT: 8,

  /** Divisor for volume dimension in corpus confidence */
  CORPUS_CONFIDENCE_VOLUME_DIVISOR: 8,

  /** Bootstrap mode confidence cap */
  BOOTSTRAP_CONFIDENCE_CAP: 0.55,

  /** Minimum analyzed messages to run clustering */
  MIN_MESSAGES_FOR_CLUSTERING: 5,          // raised from 1

  /** Cohesion below this → recommend splitting before avatar generation */
  CLUSTER_SPLIT_THRESHOLD: 0.35,

  /**
   * Avatar Readiness Score minimum (0–100) before generation is allowed.
   * Score = evidenceVolume(25) + cohesion(25) + mvaCoverage(25) + sourceDiversity(5) + relevance(20)
   */
  AVATAR_READINESS_MIN_SCORE: 60,

  /** Minimum distinct evidence sources per cluster before avatar generation */
  AVATAR_MIN_EVIDENCE_SOURCES: 2,

  // ── Issue 6: Batch & corpus size caps ────────────────────────────────────
  /** Max messages per single analysis run */
  MAX_MESSAGES_PER_BATCH: 50,

  /** Hard cap on total messages per company corpus */
  MAX_CORPUS_SIZE: 500,
} as const;

export type PipelineThresholdKey = keyof typeof PIPELINE_THRESHOLDS;

/**
 * Compute an Avatar Readiness Score (0-100) for a cluster.
 * Returns score and breakdown for UI display.
 *
 * Issue 5: Added relevanceScore parameter (0–1), contributing 20 points.
 * evidenceVolume reduced from 30→25 to keep total at 100.
 */
export function computeAvatarReadinessScore(
  messageCount: number,
  cohesionScore: number,
  mvaDomainsCovered: number,  // 0-3 (motivation, value, anxiety)
  distinctSourceCount: number,
  relevanceScore: number = 1.0  // default 1.0 for backward compat
): { score: number; breakdown: Record<string, number>; ready: boolean; gaps: string[] } {
  // evidenceVolume max = 25 (reduced from 30 to accommodate relevance dimension)
  const evidenceVolume = messageCount >= 20 ? 25 : messageCount >= 10 ? 17 : messageCount >= 5 ? 8 : 0;
  const cohesionPoints = Math.round(cohesionScore * 25);
  const mvaPoints = Math.round((mvaDomainsCovered / 3) * 25);
  const sourcePoints = distinctSourceCount >= 3 ? 5 : distinctSourceCount === 2 ? 3 : distinctSourceCount === 1 ? 1 : 0;
  const relevancePoints = Math.round(relevanceScore * 20);

  const score = evidenceVolume + cohesionPoints + mvaPoints + sourcePoints + relevancePoints;
  const ready = score >= PIPELINE_THRESHOLDS.AVATAR_READINESS_MIN_SCORE;

  const gaps: string[] = [];
  if (messageCount < 5) gaps.push(`Add ${5 - messageCount} more evidence pieces`);
  if (cohesionScore < 0.65) gaps.push('Evidence is not cohesive enough — consider splitting the theme');
  if (mvaDomainsCovered < 3) {
    const missing = [];
    if (mvaDomainsCovered < 1) missing.push('buying motivations');
    if (mvaDomainsCovered < 2) missing.push('value signals');
    if (mvaDomainsCovered < 3) missing.push('anxiety/objection signals');
    if (missing.length) gaps.push(`Add evidence about: ${missing.join(', ')}`);
  }
  if (distinctSourceCount < 2) gaps.push('Add evidence from at least one more source');
  if (relevanceScore < 0.6) gaps.push('Evidence may not be relevant to your business — review the messages');

  return {
    score,
    breakdown: { evidenceVolume, cohesionPoints, mvaPoints, sourcePoints, relevancePoints },
    ready,
    gaps,
  };
}
