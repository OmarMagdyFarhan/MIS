/**
 * Conversion Intelligence Service — Phase 14
 * Aggregates ConversionSignalTags from analyzed evidence into a
 * ConversionIntelligenceProfile per company.
 *
 * No AI calls required for v1 — pure signal aggregation.
 * This materialises the conversion signals that were classified
 * per-message but never surfaced.
 */

import type { EvidenceMessage } from '../types/pipeline';
import type { ConversionSignalTag } from '../types';

export interface ConversionSignal {
  text: string;
  weight: number;
  frequency: number;
  sourceMessageIds: string[];
  representativeQuote: string;
}

export interface ConversionIntelligenceProfile {
  companyId: string;
  buyingTriggers: ConversionSignal[];
  trustDrivers: ConversionSignal[];
  objections: ConversionSignal[];
  frictionPoints: ConversionSignal[];
  conversionOpportunities: ConversionSignal[];
  riskFactors: ConversionSignal[];
  totalSignalsAnalyzed: number;
  computedAt: string;
  corpusVersion: number;
}

/** Map ConversionSignalTags to ConversionIntelligence buckets */
const TAG_BUCKET_MAP: Partial<Record<ConversionSignalTag, keyof Omit<ConversionIntelligenceProfile,
  'companyId' | 'totalSignalsAnalyzed' | 'computedAt' | 'corpusVersion'>>> = {
  // Friction Signals
  'Usability Issue':    'frictionPoints',
  'Complexity':         'frictionPoints',
  'Effort Cost':        'frictionPoints',
  // Incentive Signals
  'Discount':           'conversionOpportunities',
  'Bonus Value':        'conversionOpportunities',
  'Reward Framing':     'conversionOpportunities',
  // Trust Signals
  'High Trust Signal':  'trustDrivers',
  'Low Trust Signal':   'riskFactors',
  'Authority Mention':  'trustDrivers',
  // Urgency Signals
  'Time Pressure':      'buyingTriggers',
  'Scarcity Mention':   'buyingTriggers',
};

function buildSignal(
  topic: string,
  rawText: string,
  msgId: string,
  quality: number,
  intensity: number
): { key: string; signal: ConversionSignal } {
  const key = topic.toLowerCase().trim().slice(0, 60);
  return {
    key,
    signal: {
      text: topic,
      weight: quality * (1 + intensity * 0.5),
      frequency: 1,
      sourceMessageIds: [msgId],
      representativeQuote: rawText.slice(0, 200),
    },
  };
}

/**
 * Aggregate conversion intelligence from all analyzed messages.
 * Pure aggregation — no AI calls.
 */
export function aggregateConversionIntelligence(
  companyId: string,
  messages: EvidenceMessage[],
  corpusVersion: number
): ConversionIntelligenceProfile {
  const buckets: Record<string, Map<string, ConversionSignal>> = {
    buyingTriggers: new Map(),
    trustDrivers: new Map(),
    objections: new Map(),
    frictionPoints: new Map(),
    conversionOpportunities: new Map(),
    riskFactors: new Map(),
  };

  let totalSignals = 0;

  for (const msg of messages) {
    if (!msg.analyzed || !msg.analysis) continue;
    const { topic, conversionSignalTags, qualityScore, emotionIntensity } = msg.analysis;
    if (!conversionSignalTags?.length) continue;

    const quality = qualityScore ?? 0.5;
    const intensity = emotionIntensity ?? 0.5;

    for (const tag of conversionSignalTags) {
      const bucketKey = TAG_BUCKET_MAP[tag];
      if (!bucketKey) continue;

      const bucket = buckets[bucketKey];
      const { key, signal } = buildSignal(topic, msg.rawText, msg.id, quality, intensity);

      if (bucket.has(key)) {
        const existing = bucket.get(key)!;
        existing.weight += signal.weight;
        existing.frequency += 1;
        existing.sourceMessageIds.push(msg.id);
      } else {
        bucket.set(key, { ...signal });
      }
      totalSignals++;
    }

    // Also map from conversionAspects if present (motivation.purchasePrompts → buyingTriggers)
    const ca = msg.analysis.conversionAspects;
    if (ca?.motivation?.purchasePrompts?.length) {
      for (const pp of ca.motivation.purchasePrompts) {
        const bucket = buckets['buyingTriggers'];
        const key = pp.toLowerCase().slice(0, 60);
        if (!bucket.has(key)) {
          bucket.set(key, {
            text: pp,
            weight: quality,
            frequency: 1,
            sourceMessageIds: [msg.id],
            representativeQuote: msg.rawText.slice(0, 200),
          });
        }
      }
    }
    if (ca?.anxiety?.objections?.length) {
      for (const obj of ca.anxiety.objections) {
        const bucket = buckets['objections'];
        const key = obj.toLowerCase().slice(0, 60);
        if (!bucket.has(key)) {
          bucket.set(key, {
            text: obj,
            weight: quality,
            frequency: 1,
            sourceMessageIds: [msg.id],
            representativeQuote: msg.rawText.slice(0, 200),
          });
        }
      }
    }
  }

  function sortBucket(map: Map<string, ConversionSignal>): ConversionSignal[] {
    return Array.from(map.values()).sort((a, b) => b.weight - a.weight);
  }

  return {
    companyId,
    buyingTriggers: sortBucket(buckets['buyingTriggers']),
    trustDrivers: sortBucket(buckets['trustDrivers']),
    objections: sortBucket(buckets['objections']),
    frictionPoints: sortBucket(buckets['frictionPoints']),
    conversionOpportunities: sortBucket(buckets['conversionOpportunities']),
    riskFactors: sortBucket(buckets['riskFactors']),
    totalSignalsAnalyzed: totalSignals,
    computedAt: new Date().toISOString(),
    corpusVersion,
  };
}
