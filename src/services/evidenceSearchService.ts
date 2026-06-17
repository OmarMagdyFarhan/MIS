import type { EvidenceMessage, Cluster } from '../types/pipeline';
import type { ConversionFormulaAspect, PsychologicalSubAspect } from '../types';

export interface EvidenceSearchQuery {
  text?: string;                          // free-text substring match on rawText/normalizedText
  aspect?: ConversionFormulaAspect;
  subAspect?: PsychologicalSubAspect;
  clusterIds?: string[];
  minQualityScore?: number;              // 0–1
  hasEmotion?: boolean;
  sourceLabels?: string[];
}

export interface EvidenceSearchResult {
  message: EvidenceMessage;
  cluster?: Cluster;
  matchReasons: string[];                // e.g. ['text match: "price"', 'aspect: Anxiety']
  relevanceScore: number;               // 0–1, higher = better match
}

export function searchEvidence(
  messages: EvidenceMessage[],
  clusters: Cluster[],
  query: EvidenceSearchQuery
): EvidenceSearchResult[] {
  if (!query.text && !query.aspect && !query.subAspect && !query.clusterIds?.length) {
    return [];
  }

  const results: EvidenceSearchResult[] = [];

  for (const message of messages) {
    if (!message.analyzed) continue;

    const matchReasons: string[] = [];
    let score = 0;

    // Text match
    if (query.text) {
      const needle = query.text.toLowerCase();
      const haystack = [
        message.rawText,
        message.normalizedText ?? '',
        message.analysis?.topic ?? '',
      ].join(' ').toLowerCase();

      if (haystack.includes(needle)) {
        matchReasons.push(`text match: "${query.text}"`);
        score += 0.4;
      } else {
        continue; // text query with no match → skip
      }
    }

    // Aspect filter
    if (query.aspect) {
      if (message.analysis?.conversionFormulaAspect === query.aspect) {
        matchReasons.push(`aspect: ${query.aspect}`);
        score += 0.3;
      } else if (!query.text) {
        continue; // aspect-only query, no match → skip
      }
    }

    // Sub-aspect filter
    if (query.subAspect) {
      if (message.analysis?.subAspect === query.subAspect) {
        matchReasons.push(`sub-aspect: ${query.subAspect}`);
        score += 0.2;
      } else {
        continue;
      }
    }

    // Cluster filter
    if (query.clusterIds?.length) {
      const inCluster = query.clusterIds.includes(message.clusterId ?? '');
      if (!inCluster) continue;
      matchReasons.push('in selected cluster');
      score += 0.1;
    }

    // Quality gate
    if (query.minQualityScore !== undefined) {
      if ((message.analysis?.qualityScore ?? 0) < query.minQualityScore) continue;
    }

    // Emotion filter
    if (query.hasEmotion && !message.analysis?.emotion) continue;

    // Source label filter
    if (query.sourceLabels?.length) {
      if (!query.sourceLabels.includes(message.sourceLabel ?? '')) continue;
    }

    const cluster = clusters.find(c => c.messageIds.includes(message.id));

    results.push({
      message,
      cluster,
      matchReasons,
      relevanceScore: Math.min(1, score),
    });
  }

  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function groupSearchResultsByAspect(
  results: EvidenceSearchResult[]
): Map<string, EvidenceSearchResult[]> {
  const groups = new Map<string, EvidenceSearchResult[]>();
  for (const result of results) {
    const key = result.message.analysis?.conversionFormulaAspect ?? 'Unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(result);
  }
  return groups;
}
