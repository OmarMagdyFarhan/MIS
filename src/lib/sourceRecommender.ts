/**
 * sourceRecommender — deterministic gap analysis and source recommendation engine.
 * No React, No Zustand, No AI calls. Pure client-side gap analysis.
 */
import type { EvidenceMessage, Cluster } from '../types/pipeline';
import { computeCorpusHealth } from './corpusHealth';
import type { CorpusHealth } from './corpusHealth';

export type CoreEmotionFamily = 'Happy' | 'Surprised' | 'Bad' | 'Fearful' | 'Angry' | 'Disgusted' | 'Sad';

interface EmotionGap {
  core: CoreEmotionFamily;
  messageCount: number;
  isThin: boolean;
}

export interface ConversionGap {
  motivation: { score: number; isMissing: boolean };
  value: { score: number; isMissing: boolean };
  anxiety: { score: number; isMissing: boolean };
  hasMissingDimension: boolean;
  weakest: 'motivation' | 'value' | 'anxiety' | null;
}

export interface GapProfile {
  corpusTooSmall: boolean;
  thinEmotionCores: EmotionGap[];
  conversionGaps: ConversionGap;
  overallSeverity: 'critical' | 'moderate' | 'minor';
}

export type RecommendedSource =
  | 'amazon_reviews'
  | 'reddit_threads'
  | 'support_chat_logs'
  | 'customer_interviews'
  | 'survey_responses'
  | 'forum_qa'
  | 'social_media_comments';

export interface SourceRecommendation {
  source: RecommendedSource;
  label: string;
  priority: 'critical' | 'high' | 'medium';
  reason: string;
  fills: string[];
  searchHint: string;
}

const EMOTION_TO_CORE: Record<string, CoreEmotionFamily> = {
  Happy: 'Happy', Playful: 'Happy', Content: 'Happy', Interested: 'Happy', Proud: 'Happy',
  Accepted: 'Happy', Powerful: 'Happy', Peaceful: 'Happy', Trusting: 'Happy', Optimistic: 'Happy',
  Surprised: 'Surprised', Startled: 'Surprised', Confused: 'Surprised', Amazed: 'Surprised', Excited: 'Surprised',
  Bad: 'Bad', Bored: 'Bad', Busy: 'Bad', Stressed: 'Bad', Tired: 'Bad',
  Fearful: 'Fearful', Scared: 'Fearful', Anxious: 'Fearful', Insecure: 'Fearful', Weak: 'Fearful',
  Rejected: 'Fearful', Threatened: 'Fearful',
  Angry: 'Angry', Mad: 'Angry', Aggressive: 'Angry', Frustrated: 'Angry', Distant: 'Angry', Critical: 'Angry',
  Disgusted: 'Disgusted', Disapproving: 'Disgusted', Awful: 'Disgusted', Repelled: 'Disgusted',
  Sad: 'Sad', Disappointing: 'Sad', Hurt: 'Sad', Guilty: 'Sad', Despair: 'Sad', Vulnerable: 'Sad', Lonely: 'Sad',
};

export function detectGaps(messages: EvidenceMessage[], clusters: Cluster[]): GapProfile {
  const analyzed = messages.filter(m => m.analyzed);
  const corpusTooSmall = analyzed.length < 40;

  // Emotion gap detection
  const coreCounts: Record<CoreEmotionFamily, number> = {
    Happy: 0, Surprised: 0, Bad: 0, Fearful: 0, Angry: 0, Disgusted: 0, Sad: 0,
  };
  for (const cluster of clusters) {
    const clusterMsgs = messages.filter(m => cluster.messageIds.includes(m.id));
    const emotion = (cluster as any).dominantEmotion ?? 
                    (cluster as any).clusterEmotions?.[0] ?? '';
    const core = EMOTION_TO_CORE[emotion];
    if (core) coreCounts[core] += clusterMsgs.length;
  }
  const thinEmotionCores: EmotionGap[] = clusters.length === 0 ? [] :
    (Object.entries(coreCounts) as [CoreEmotionFamily, number][]).map(([core, messageCount]) => ({
      core,
      messageCount,
      isThin: messageCount < 5,
    })).filter(e => e.isThin);

  // Conversion gap detection
  let motivationScore = 0;
  let valueScore = 0;
  let anxietyScore = 0;

  for (const m of analyzed) {
    const ca = (m.analysis as any)?.conversionAspects;
    if (!ca) continue;
    motivationScore += (ca.motivation?.desiredOutcomes?.length ?? 0) +
      (ca.motivation?.painPoints?.length ?? 0) +
      (ca.motivation?.purchasePrompts?.length ?? 0);
    valueScore += (ca.value?.uniqueBenefits?.length ?? 0) +
      (ca.value?.delightfulFeatures?.length ?? 0) +
      (ca.value?.dealreakerNeeds?.length ?? 0);
    anxietyScore += (ca.anxiety?.uncertainties?.length ?? 0) +
      (ca.anxiety?.objections?.length ?? 0) +
      (ca.anxiety?.perceivedRisks?.length ?? 0);
  }

  const conversionGaps: ConversionGap = {
    motivation: { score: motivationScore, isMissing: motivationScore === 0 },
    value: { score: valueScore, isMissing: valueScore === 0 },
    anxiety: { score: anxietyScore, isMissing: anxietyScore === 0 },
    hasMissingDimension: motivationScore === 0 || valueScore === 0 || anxietyScore === 0,
    weakest: null,
  };

  const scores = [
    { k: 'motivation' as const, v: motivationScore },
    { k: 'value' as const, v: valueScore },
    { k: 'anxiety' as const, v: anxietyScore },
  ].filter(x => x.v > 0).sort((a, b) => a.v - b.v);
  conversionGaps.weakest = scores[0]?.k ?? null;

  const overallSeverity: GapProfile['overallSeverity'] =
    (corpusTooSmall && conversionGaps.hasMissingDimension) ? 'critical' :
    (corpusTooSmall || conversionGaps.hasMissingDimension) ? 'moderate' :
    'minor';

  return { corpusTooSmall, thinEmotionCores, conversionGaps, overallSeverity };
}

export function shouldActivate(health: CorpusHealth, gaps: GapProfile): boolean {
  return health.coverage.analyzed < 40 || health.thinClusterCount > 0 || gaps.conversionGaps.hasMissingDimension;
}

export function buildRecommendations(gaps: GapProfile): SourceRecommendation[] {
  const recs: Map<RecommendedSource, SourceRecommendation> = new Map();

  function upsert(source: RecommendedSource, rec: Omit<SourceRecommendation, 'source'>) {
    const existing = recs.get(source);
    if (!existing) {
      recs.set(source, { source, ...rec });
    } else {
      const priorities = { critical: 3, high: 2, medium: 1 };
      if (priorities[rec.priority] > priorities[existing.priority]) {
        recs.set(source, {
          source,
          label: existing.label,
          priority: rec.priority,
          reason: rec.reason,
          fills: [...new Set([...existing.fills, ...rec.fills])],
          searchHint: rec.searchHint,
        });
      } else {
        recs.set(source, {
          ...existing,
          fills: [...new Set([...existing.fills, ...rec.fills])],
        });
      }
    }
  }

  if (gaps.conversionGaps.motivation.isMissing) {
    upsert('amazon_reviews', {
      label: 'Amazon Reviews',
      priority: 'critical',
      reason: 'Your corpus has zero motivation signals — desired outcomes and purchase triggers are entirely absent.',
      fills: ["Desired outcomes in buyers' own words", 'Purchase triggers', 'Before/after outcome language'],
      searchHint: 'Search: "[your product category]" on Amazon · sort by "Most Critical" and "Most Recent" · look for 3-star reviews',
    });
    upsert('customer_interviews', {
      label: 'Customer Interviews',
      priority: 'critical',
      reason: 'Motivation signals need long-form JTBD language that only interviews surface.',
      fills: ['Long-form JTBD language', 'Functional and emotional outcome articulation'],
      searchHint: 'Run 3–5 customer calls using: "Walk me through the moment you decided to buy"',
    });
  }

  if (gaps.conversionGaps.anxiety.isMissing) {
    upsert('reddit_threads', {
      label: 'Reddit Threads',
      priority: 'critical',
      reason: 'Your corpus is missing anxiety signals — pre-purchase objections are absent.',
      fills: ['Pre-purchase uncertainty', 'Unfiltered objections', 'Peer comparison questions'],
      searchHint: 'Search: r/[relevant subreddit] "[product name] worth it?" OR "should I buy" OR "disappointed"',
    });
    upsert('forum_qa', {
      label: 'Forum Q&A',
      priority: 'high',
      reason: 'Forum questions surface hesitation signals before commitment that anxiety corpus needs.',
      fills: ['Specific product questions', 'Hesitation signals before commitment'],
      searchHint: 'Search: "[product category] questions" site:quora.com OR site:reddit.com',
    });
  }

  if (gaps.conversionGaps.value.isMissing) {
    upsert('support_chat_logs', {
      label: 'Support Chat Logs',
      priority: 'critical',
      reason: 'Value signals are absent — you need direct evidence of what features matter and what causes churn.',
      fills: ['Dealbreaker features stated directly', 'What makes users leave', 'Exact friction language'],
      searchHint: 'Export 90-day support ticket archive · filter for "cancel", "refund", "doesn\'t work", "switched to"',
    });
    upsert('survey_responses', {
      label: 'Survey Responses',
      priority: 'high',
      reason: 'Surveys reveal feature priority ranking that your missing value signals require.',
      fills: ['Feature priority ranking', 'Benefit awareness gaps'],
      searchHint: 'Send NPS survey asking: "What almost stopped you from buying?" and "What could we remove and you\'d barely notice?"',
    });
  }

  for (const core of gaps.thinEmotionCores) {
    if (core.core === 'Fearful' || core.core === 'Bad') {
      upsert('reddit_threads', {
        label: 'Reddit Threads',
        priority: 'high',
        reason: `Fear/anxiety cluster has only ${core.messageCount} messages — far below the 5 needed for reliable modeling.`,
        fills: ['Raw fear language', 'Worst-case scenario thinking', 'Trust objections'],
        searchHint: 'Search: r/[relevant subreddit] "scared" OR "worried" OR "risk" OR "trust"',
      });
    }
    if (core.core === 'Angry') {
      upsert('support_chat_logs', {
        label: 'Support Chat Logs',
        priority: 'high',
        reason: `Anger/frustration cluster has only ${core.messageCount} messages — support logs will fill this quickly.`,
        fills: ['Precise complaint language', 'Escalation triggers', 'Unmet expectations'],
        searchHint: 'Export 90-day support ticket archive · filter for "frustrated", "angry", "terrible", "worst"',
      });
    }
    if (core.core === 'Happy') {
      upsert('amazon_reviews', {
        label: 'Amazon Reviews',
        priority: 'medium',
        reason: `Positive/delight cluster has only ${core.messageCount} messages — 5-star Amazon reviews will fill this.`,
        fills: ['Delight signals', 'Outcome validation', 'Advocacy language'],
        searchHint: 'Search: "[your product category]" on Amazon · sort by "Top Reviews" · focus on 5-star reviews',
      });
    }
    if (core.core === 'Sad') {
      upsert('customer_interviews', {
        label: 'Customer Interviews',
        priority: 'medium',
        reason: `Disappointment/sadness cluster has only ${core.messageCount} messages — interviews surface unmet expectation stories.`,
        fills: ['Unmet expectation stories', 'Regret language', 'Switch triggers'],
        searchHint: 'Run 3–5 churned customer calls: "What were you hoping for when you first signed up?"',
      });
    }
  }

  if (gaps.corpusTooSmall) {
    upsert('amazon_reviews', {
      label: 'Amazon Reviews',
      priority: 'critical',
      reason: 'Corpus too small for reliable segmentation — Amazon reviews provide high volume quickly.',
      fills: ['High volume, structured format', 'Diverse buyer perspectives', 'Natural language outcomes'],
      searchHint: 'Search: "[your product category]" on Amazon · sort by "Most Critical" and "Most Recent" · look for 3-star reviews',
    });
    upsert('reddit_threads', {
      label: 'Reddit Threads',
      priority: 'critical',
      reason: 'Reddit provides authentic unguarded opinions that small corpora need to reach analytical depth.',
      fills: ['Authentic emotional tone', 'Unguarded opinions', 'Situational context'],
      searchHint: 'Search Google: site:reddit.com "[your product/category]" -"buy" -"sell" (organic discussion only)',
    });
  }

  const priorityOrder = { critical: 3, high: 2, medium: 1 };
  return Array.from(recs.values())
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .slice(0, 5);
}

export function buildSummaryLine(gaps: GapProfile): string {
  if (gaps.corpusTooSmall && gaps.conversionGaps.hasMissingDimension) {
    const missing = [
      gaps.conversionGaps.motivation.isMissing ? 'motivation' : null,
      gaps.conversionGaps.value.isMissing ? 'value' : null,
      gaps.conversionGaps.anxiety.isMissing ? 'anxiety' : null,
    ].filter(Boolean).join(', ');
    return `Corpus is too small for reliable segmentation and ${missing} signals are entirely absent. Collecting from the sources below will unlock sharper avatars.`;
  }
  if (gaps.conversionGaps.hasMissingDimension) {
    const missing = [
      gaps.conversionGaps.motivation.isMissing ? 'motivation' : null,
      gaps.conversionGaps.value.isMissing ? 'value' : null,
      gaps.conversionGaps.anxiety.isMissing ? 'anxiety' : null,
    ].filter(Boolean).join(' and ');
    return `${missing.charAt(0).toUpperCase() + missing.slice(1)} signals are missing entirely. The system cannot model this dimension until you add this evidence.`;
  }
  if (gaps.thinEmotionCores.length > 0) {
    return `${gaps.thinEmotionCores.length} emotion cluster${gaps.thinEmotionCores.length > 1 ? 's have' : ' has'} fewer than 5 quotes each. Adding targeted evidence will strengthen segmentation confidence.`;
  }
  return 'Add evidence from these targeted sources to improve intelligence depth.';
}
