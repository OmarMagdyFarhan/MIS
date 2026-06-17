/**
 * messageQualityScorer — deterministic pre-analysis quote quality assessment.
 * No React, No Zustand, No AI calls. Pure string analysis using weighted heuristics.
 * Safe to call synchronously on every keystroke.
 */

export interface QuoteScore {
  raw: number;
  tier: 'low' | 'medium' | 'high';
  breakdown: {
    length: number;
    specificity: number;
    emotionalDensity: number;
    painOutcomeSignal: number;
  };
  flags: QuoteFlag[];
}

export type QuoteFlag =
  | 'too_short'
  | 'too_generic'
  | 'no_emotional_signal'
  | 'no_pain_or_outcome'
  | 'filler_only';

export interface BatchQualitySummary {
  totalQuotes: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  overallScore: number;
  readiness: 'strong' | 'acceptable' | 'weak';
  dominantFlag: QuoteFlag | null;
}

const FILLER_ONLY_PATTERN = /^[\s\W]*(good|great|nice|ok|okay|thanks|thank you|love it|love this|highly recommend|recommended|works|working|perfect|excellent|amazing|wonderful|fantastic|five stars|5 stars|[\u2B50]+)[\s\W]*$/i;

const GENERIC_PATTERNS: RegExp[] = [
  /\b(good|great|nice|ok|okay|fine|cool|awesome|love it|hate it|bad|terrible)\b/gi,
  /\b(very|really|so|just|basically|kind of|sort of|pretty much)\b/gi,
];

const SPECIFICITY_ANCHORS: RegExp[] = [
  /\d+/,
  /\b(because|since|when|after|before|compared to|instead of|unlike)\b/gi,
  /\b(always|never|every time|used to|switched|replaced|tried)\b/gi,
  /["'«»].{10,}/,
];

const EMOTION_VOCABULARY: string[] = [
  'frustrated', 'overwhelmed', 'anxious', 'worried', 'stressed',
  'disappointed', 'annoyed', 'angry', 'furious', 'upset', 'confused',
  'scared', 'nervous', 'helpless', 'hopeless', 'desperate', 'exhausted',
  'embarrassed', 'ashamed', 'betrayed', 'ignored', 'undervalued',
  'excited', 'thrilled', 'relieved', 'grateful', 'confident', 'proud',
  'satisfied', 'delighted', 'inspired', 'motivated', 'hopeful', 'calm',
  'happy', 'joyful', 'loved', 'valued', 'respected', 'empowered',
  'extremely', 'incredibly', 'absolutely', 'completely', 'totally',
  'desperately', 'deeply', 'profoundly',
];

const INTENSITY_AMPLIFIERS = ['extremely', 'incredibly', 'absolutely', 'completely', 'totally', 'desperately', 'deeply', 'profoundly'];

const PAIN_SIGNALS: string[] = [
  "can't", "cannot", "couldn't", "doesn't work", "broken", "failed",
  "problem", "struggle", "struggling", "issue", "bug", "error", "crash",
  "waste", "wasted", "expensive", "overpriced", "not worth", "useless",
  "gave up", "stopped using", "uninstalled", "switched", "quit",
  "frustrating", "painful", "difficult", "hard to", "impossible to",
];

const OUTCOME_SIGNALS: string[] = [
  "now i can", "finally", "solved", "fixed", "helped me", "changed my",
  "made it easier", "saved me", "worth every", "best decision", "love how",
  "thank you for", "works perfectly", "exactly what", "never going back",
  "increased", "decreased", "reduced", "improved", "doubled", "cut in half",
];

function scoreLength(text: string): { score: number; flag: QuoteFlag | null } {
  const len = text.trim().length;
  if (len < 25) return { score: 0, flag: 'too_short' };
  if (len < 60) return { score: 8, flag: null };
  if (len < 120) return { score: 16, flag: null };
  if (len < 250) return { score: 22, flag: null };
  return { score: 25, flag: null };
}

function scoreSpecificity(text: string): { score: number; flag: QuoteFlag | null } {
  let score = 12;
  let genericMatches = 0;
  for (const p of GENERIC_PATTERNS) {
    const matches = text.match(p);
    genericMatches += matches ? matches.length : 0;
  }
  score = Math.max(0, score - genericMatches * 3);

  let anchorMatches = 0;
  for (const a of SPECIFICITY_ANCHORS) {
    if (a.test(text)) anchorMatches++;
  }
  score = Math.min(25, score + anchorMatches * 4);

  const words = text.trim().split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  if (score < 4 && uniqueWords.size < 3) {
    return { score, flag: 'too_generic' };
  }
  return { score, flag: null };
}

function scoreEmotionalDensity(text: string): { score: number; flag: QuoteFlag | null } {
  const lower = text.toLowerCase();
  let matches = 0;
  let hasAmplifier = false;
  for (const word of EMOTION_VOCABULARY) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    if (re.test(lower)) {
      matches++;
      if (INTENSITY_AMPLIFIERS.includes(word)) hasAmplifier = true;
    }
  }
  let score = 0;
  if (matches === 0) return { score: 0, flag: 'no_emotional_signal' };
  if (matches === 1) score = 10;
  else if (matches === 2) score = 17;
  else score = 22;
  if (hasAmplifier && matches > 0) score = Math.min(25, score + 3);
  return { score, flag: null };
}

function scorePainOutcome(text: string): { score: number; flag: QuoteFlag | null } {
  const lower = text.toLowerCase();
  let painCount = 0;
  let outcomeCount = 0;
  for (const s of PAIN_SIGNALS) {
    if (lower.includes(s)) painCount++;
  }
  for (const s of OUTCOME_SIGNALS) {
    if (lower.includes(s)) outcomeCount++;
  }
  if (painCount === 0 && outcomeCount === 0) return { score: 0, flag: 'no_pain_or_outcome' };
  if (painCount > 0 && outcomeCount > 0) return { score: 25, flag: null };
  if (painCount >= 2) return { score: 18, flag: null };
  if (painCount === 1) return { score: 12, flag: null };
  if (outcomeCount >= 2) return { score: 20, flag: null };
  return { score: 14, flag: null };
}

export function scoreQuote(text: string): QuoteScore {
  if (FILLER_ONLY_PATTERN.test(text)) {
    return {
      raw: 5,
      tier: 'low',
      breakdown: { length: 5, specificity: 0, emotionalDensity: 0, painOutcomeSignal: 0 },
      flags: ['filler_only'],
    };
  }

  const lengthResult = scoreLength(text);
  const specificityResult = scoreSpecificity(text);
  const emotionResult = scoreEmotionalDensity(text);
  const painResult = scorePainOutcome(text);

  const raw = lengthResult.score + specificityResult.score + emotionResult.score + painResult.score;
  const flags: QuoteFlag[] = [
    lengthResult.flag,
    specificityResult.flag,
    emotionResult.flag,
    painResult.flag,
  ].filter((f): f is QuoteFlag => f !== null);

  const tier: 'low' | 'medium' | 'high' = raw >= 65 ? 'high' : raw >= 35 ? 'medium' : 'low';

  return {
    raw: Math.min(100, raw),
    tier,
    breakdown: {
      length: lengthResult.score,
      specificity: specificityResult.score,
      emotionalDensity: emotionResult.score,
      painOutcomeSignal: painResult.score,
    },
    flags,
  };
}

export function scoreBatch(quotes: string[]): { scores: QuoteScore[]; summary: BatchQualitySummary } {
  const nonEmpty = quotes.filter(q => q.trim().length > 0);
  const scores = nonEmpty.map(q => scoreQuote(q));

  const highCount = scores.filter(s => s.tier === 'high').length;
  const mediumCount = scores.filter(s => s.tier === 'medium').length;
  const lowCount = scores.filter(s => s.tier === 'low').length;
  const overallScore = scores.length === 0 ? 0 : Math.round(scores.reduce((sum, s) => sum + s.raw, 0) / scores.length);

  const readiness: BatchQualitySummary['readiness'] =
    overallScore >= 60 ? 'strong' :
    overallScore >= 38 ? 'acceptable' : 'weak';

  const flagCounts: Record<QuoteFlag, number> = {
    too_short: 0, too_generic: 0, no_emotional_signal: 0, no_pain_or_outcome: 0, filler_only: 0,
  };
  for (const s of scores.filter(s => s.tier !== 'high')) {
    for (const f of s.flags) flagCounts[f]++;
  }
  const dominantFlag: QuoteFlag | null = (Object.entries(flagCounts) as [QuoteFlag, number][])
    .filter(([, c]) => c > 0)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  return {
    scores,
    summary: { totalQuotes: nonEmpty.length, highCount, mediumCount, lowCount, overallScore, readiness, dominantFlag },
  };
}
