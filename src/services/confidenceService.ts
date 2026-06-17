import type { Cluster, EvidenceMessage, OfferFormula } from '../types/pipeline';
import { defaultConfidence } from '../lib/offerAdapters';
import { PIPELINE_THRESHOLDS } from '../constants/pipelineThresholds';

/**
 * Fix 3 — Decoupled cohesion: pure coherence + small additive volume bonus.
 * The old formula penalized small but tight clusters via (members.length / 5) multiplier.
 */
export function computeClusterCohesion(cluster: Cluster, messages: EvidenceMessage[]): number {
  const members = messages.filter(m => cluster.messageIds.includes(m.id) && m.analysis);
  if (members.length < 2) return members.length === 1 ? 0.45 : 0;
  const topics = members.map(m => m.analysis!.topic);
  const uniqueTopics = new Set(topics).size;
  const topicScore = 1 - (uniqueTopics - 1) / Math.max(1, members.length - 1);
  const aspects = members.map(m => m.analysis!.conversionFormulaAspect);
  const uniqueAspects = new Set(aspects).size;
  const aspectScore = 1 - (uniqueAspects - 1) / Math.max(1, members.length - 1);
  const coherence = topicScore * 0.6 + aspectScore * 0.4;
  const volumeBonus = Math.min(0.1, (members.length - 2) * 0.02);
  return Math.min(1, coherence + volumeBonus);
}

/**
 * Fix 1 — Evidence-derived confidence; per-aspect calibration.
 *
 * Different aspects appear at different natural rates in real corpora:
 *  - 'motivation' is the most common aspect; a moderate coverage ratio (e.g. 30%) already
 *    signals meaningful evidence, so it gets a higher multiplier (3.0) and a higher floor (0.30).
 *  - 'value' is moderately common; multiplier 2.5, floor 0.28.
 *  - 'anxiety' is naturally rarer — customers mention fears and objections less freely than
 *    motivations and values, so the same raw coverage ratio deserves a higher scaled score;
 *    multiplier 3.5, floor 0.25 (but also a lower ceiling of 0.88 to prevent over-claiming).
 *  - 'trigger' is the rarest; multiplier 4.0, floor 0.20, ceiling 0.85.
 *
 * All values are empirically calibrated to keep confidence meaningful across corpus sizes.
 */
const ASPECT_CALIBRATION: Record<
  'motivation' | 'value' | 'anxiety' | 'trigger',
  { multiplier: number; floor: number; ceiling: number }
> = {
  motivation: { multiplier: 3.0, floor: 0.30, ceiling: 0.92 },
  value:      { multiplier: 2.5, floor: 0.28, ceiling: 0.92 },
  anxiety:    { multiplier: 3.5, floor: 0.25, ceiling: 0.88 },
  trigger:    { multiplier: 4.0, floor: 0.20, ceiling: 0.85 },
};

export function computeAspectConfidence(
  aspect: 'motivation' | 'value' | 'anxiety' | 'trigger',
  allMessages: string[],
  matchingMessages: string[]
): number {
  if (allMessages.length === 0) return 0;
  const { multiplier, floor, ceiling } = ASPECT_CALIBRATION[aspect];
  const coverage = matchingMessages.length / allMessages.length;
  const base = Math.min(1, coverage * multiplier);
  return Math.max(floor, Math.min(ceiling, base));
}

/**
 * Fix 2 — Multi-dimensional quality scoring replaces the naive rawText.length / 120.
 */
export function computeMessageQuality(
  rawText: string,
  analysis: { conversionSignalTags?: string[]; conversionFormulaAspect?: string; topic?: string }
): number {
  const lengthScore = Math.min(0.5, rawText.trim().length / 200);
  const tagScore = Math.min(0.3, (analysis.conversionSignalTags?.length ?? 0) * 0.075);
  const specificityBonus = analysis.topic && analysis.topic.split(' ').length > 3 ? 0.2 : 0;
  return Math.min(1, lengthScore + tagScore + specificityBonus);
}

export function computeCorpusConfidence(
  messages: EvidenceMessage[],
  clusters: Cluster[],
  mode: 'evidence_first' | 'hybrid' | 'bootstrap'
): import('../types/pipeline').ConfidenceSnapshot {
  const analyzed = messages.filter(m => m.analyzed && m.rawText.trim().length > 5);
  const validatedClusters = clusters.filter(c => c.validationStatus === 'validated' && c.status !== 'merged');
  const volume = analyzed.length;
  let overall =
    Math.min(1, volume / PIPELINE_THRESHOLDS.CORPUS_CONFIDENCE_VOLUME_DIVISOR) * 0.5 +
    (validatedClusters.length > 0 ? 0.3 : 0);
  if (validatedClusters.length) {
    const cohesion =
      validatedClusters.reduce((acc, c) => acc + (c.cohesionScore ?? 0.5), 0) / validatedClusters.length;
    overall += cohesion * 0.2;
  }
  if (mode === 'bootstrap') overall = Math.min(overall, PIPELINE_THRESHOLDS.BOOTSTRAP_CONFIDENCE_CAP);
  const status =
    volume >= PIPELINE_THRESHOLDS.CORPUS_VALIDATED_MESSAGE_COUNT && validatedClusters.length >= 1
      ? 'validated'
      : 'provisional';
  return defaultConfidence(overall, status, volume);
}

export function computeOfferAlignment(
  formula: OfferFormula,
  messages: EvidenceMessage[],
  clusterId?: string
): number {
  const relevant = messages.filter(
    m => m.analyzed && (!clusterId || m.clusterId === clusterId)
  );
  if (!relevant.length) return 0.35;
  const blob = `${formula.transformation} ${formula.reasonToActNow}`.toLowerCase();
  let hits = 0;
  for (const m of relevant) {
    const words = m.analysis?.topic?.toLowerCase().split(/\s+/) || [];
    if (words.some(w => w.length > 3 && blob.includes(w))) hits++;
  }
  return Math.min(1, 0.4 + hits / Math.max(1, relevant.length));
}
