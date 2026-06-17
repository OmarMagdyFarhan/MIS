// ═══════════════════════════════════════════════════════════════════════════════
// EMOTION ANALYSIS SERVICE — Phase 10 (Feeling Wheel integration)
// Import path: src/services/emotionService.ts
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  CoreEmotion, MidEmotion, SpecificEmotionV2,
  FeelingWheelLocation, EmotionAnalysisV2,
} from '../types/phase10';
import type { EvidenceMessage } from '../types/pipeline';

// ─── FEELING WHEEL ────────────────────────────────────────────────────────────

export const FEELING_WHEEL: Record<CoreEmotion, Partial<Record<MidEmotion, SpecificEmotionV2[]>>> = {
  happy: {
    confident: ['proud', 'respected', 'valued', 'courageous'],
    content:   ['peaceful', 'grateful', 'satisfied', 'hopeful'],
    playful:   ['joyful', 'creative', 'excited', 'energetic'],
  },
  sad: {
    discouraged:   ['hopeless', 'defeated', 'powerless', 'ashamed'],
    disappointed:  ['let down', 'betrayed', 'hurt', 'lonely'],
    gloomy:        ['miserable', 'depressed', 'dark', 'empty'],
  },
  angry: {
    frustrated: ['provoked', 'irritated', 'annoyed', 'withdrawn'],
    aggressive: ['hostile', 'combative', 'violent', 'bitter'],
    cynical:    ['sarcastic', 'contemptuous', 'skeptical', 'distrustful'],
  },
  scared: {
    anxious:   ['worried', 'insecure', 'nervous', 'hesitant'],
    uncertain: ['confused', 'doubtful', 'lost', 'overwhelmed'],
    timid:     ['vulnerable', 'weak', 'powerless', 'intimidated'],
  },
} as any;

function findWheelLocation(feeling: string): FeelingWheelLocation | null {
  const fl = feeling.toLowerCase();
  for (const [core, secondaries] of Object.entries(FEELING_WHEEL)) {
    for (const [secondary, specifics] of Object.entries(secondaries)) {
      if (specifics.some((s: string) => s.toLowerCase() === fl)) {
        return { core: core as CoreEmotion, ring1: secondary as MidEmotion, ring2: feeling as SpecificEmotionV2 };
      }
      if (secondary.toLowerCase() === fl) {
        return { core: core as CoreEmotion, ring1: feeling as MidEmotion, ring2: (specifics as string[])[0] as SpecificEmotionV2 };
      }
    }
    if (core.toLowerCase() === fl) {
      const firstSecondary = Object.keys(secondaries)[0] as MidEmotion;
      const firstSpecific  = (Object.values(secondaries)[0] as string[])[0] as SpecificEmotionV2;
      return { core: feeling as CoreEmotion, ring1: firstSecondary, ring2: firstSpecific };
    }
  }
  return null;
}

// ─── KEYWORD PATTERNS ────────────────────────────────────────────────────────

interface EmotionPattern { keywords: string[]; core: CoreEmotion; intensity: 1|2|3|4|5|6|7|8|9|10 }

const EMOTION_PATTERNS: EmotionPattern[] = [
  { keywords: ['great','awesome','love','excellent','perfect','brilliant'], core: 'happy',  intensity: 9 },
  { keywords: ['good','nice','glad','satisfied','pleased'],                 core: 'happy',  intensity: 7 },
  { keywords: ['okay','fine','alright','acceptable'],                       core: 'happy',  intensity: 5 },
  { keywords: ['frustrated','annoyed','angry','furious','!!!'],             core: 'angry',  intensity: 9 },
  { keywords: ['irritated','bothered','upset','aggravated'],                core: 'angry',  intensity: 7 },
  { keywords: ['disappointed','let down'],                                  core: 'angry',  intensity: 5 },
  { keywords: ['scared','terrified','panicked','frightened'],               core: 'scared', intensity: 9 },
  { keywords: ['anxious','worried','nervous','concerned'],                  core: 'scared', intensity: 7 },
  { keywords: ['uncertain','unsure','doubtful','hesitant'],                 core: 'scared', intensity: 5 },
  { keywords: ['sad','depressed','miserable','hopeless'],                   core: 'sad',    intensity: 9 },
  { keywords: ['unhappy','discouraged','demoralized'],                      core: 'sad',    intensity: 7 },
  { keywords: ['down','low','gloomy','somber'],                             core: 'sad',    intensity: 5 },
];

// ─── EMOTION SERVICE ─────────────────────────────────────────────────────────

export class EmotionService {
  analyzeCommentEmotion(text: string, sourceCommentId: string): EmotionAnalysisV2 {
    const detected = this.detectEmotion(text);
    const wheelLoc: FeelingWheelLocation = findWheelLocation(detected.feeling) ?? {
      core:  detected.core,
      ring1: Object.keys(FEELING_WHEEL[detected.core])[0] as MidEmotion,
      ring2: (Object.values(FEELING_WHEEL[detected.core])[0] as SpecificEmotionV2[])[0],
    };

    return {
      primaryEmotion:   wheelLoc.core,
      secondaryEmotion: wheelLoc.ring1,
      specificFeeling:  wheelLoc.ring2,
      feelingWheelPath: wheelLoc,
      intensity:        detected.intensity,
      indicators:       this.extractIndicators(text, detected.core),
      sourceCommentId,
    };
  }

  private detectEmotion(text: string): { core: CoreEmotion; feeling: string; intensity: 1|2|3|4|5|6|7|8|9|10 } {
    const tl = text.toLowerCase();
    let best: EmotionPattern | null = null;
    let best_score = 0;
    for (const p of EMOTION_PATTERNS) {
      const score = p.keywords.filter(kw => tl.includes(kw)).length;
      if (score > best_score) { best_score = score; best = p; }
    }
    if (best && best_score > 0) return { core: best.core, feeling: best.keywords[0], intensity: best.intensity };
    return { core: 'happy', feeling: 'neutral', intensity: 5 };
  }

  private extractIndicators(text: string, emotion: CoreEmotion): string[] {
    const tl = text.toLowerCase();
    const patterns: Record<CoreEmotion, string[]> = {
      happy:  ['breakthrough','solved','working now','easy','perfect'],
      angry:  ['failed','broken','wasted time','not working'],
      scared: ['uncertain','risk','might fail','what if'],
      sad:    ['gave up','lost','abandoned','stuck','hopeless'],
    };
    const found = (patterns[emotion] || []).filter(p => tl.includes(p));
    if ((text.match(/!/g) || []).length > 2) found.push('emphatic language');
    return found.slice(0, 3);
  }

  aggregateEmotionsFromCluster(comments: EvidenceMessage[]) {
    const counts = new Map<CoreEmotion, number>();
    const allEmotions: EmotionAnalysisV2[] = [];
    const allIndicators = new Set<string>();

    for (const c of comments) {
      if (c.analysis?.phase10Emotion) {
        allEmotions.push(c.analysis.phase10Emotion);
        const core = c.analysis.phase10Emotion.primaryEmotion;
        counts.set(core, (counts.get(core) ?? 0) + 1);
        c.analysis.phase10Emotion.indicators.forEach(i => allIndicators.add(i));
      }
    }

    if (allEmotions.length === 0) {
      return { primary: 'happy' as CoreEmotion, secondary: 'content' as MidEmotion,
               specific: 'satisfied' as SpecificEmotionV2, intensity: 5, indicators: [],
               distribution: { happy: 1, sad: 0, angry: 0, scared: 0 } };
    }

    let dominant: CoreEmotion = 'happy';
    let max = 0;
    for (const [e, n] of counts) if (n > max) { max = n; dominant = e; }

    const distribution = {
      happy: counts.get('happy') ?? 0,
      sad:   counts.get('sad')   ?? 0,
      angry: counts.get('angry') ?? 0,
      scared: counts.get('scared') ?? 0,
    };

    const domEmotions = allEmotions.filter(e => e.primaryEmotion === dominant);
    const secondaryCounts = new Map<MidEmotion, number>();
    const specificCounts  = new Map<SpecificEmotionV2, number>();
    for (const e of domEmotions) {
      secondaryCounts.set(e.secondaryEmotion, (secondaryCounts.get(e.secondaryEmotion) ?? 0) + 1);
      specificCounts.set(e.specificFeeling,   (specificCounts.get(e.specificFeeling)   ?? 0) + 1);
    }

    const topSecondary = [...secondaryCounts.entries()].sort((a,b) => b[1]-a[1])[0]?.[0]
      ?? (Object.keys(FEELING_WHEEL[dominant])[0] as MidEmotion);
    const topSpecific = [...specificCounts.entries()].sort((a,b) => b[1]-a[1])[0]?.[0]
      ?? ((FEELING_WHEEL[dominant] as any)[topSecondary]?.[0] ?? 'satisfied') as SpecificEmotionV2;

    const avgIntensity = Math.round(allEmotions.reduce((s,e) => s + e.intensity, 0) / allEmotions.length);

    return {
      primary: dominant, secondary: topSecondary, specific: topSpecific,
      intensity: avgIntensity as 1|2|3|4|5|6|7|8|9|10,
      indicators: Array.from(allIndicators).slice(0, 5),
      distribution,
    };
  }

  generateEmotionalDescription(agg: ReturnType<EmotionService['aggregateEmotionsFromCluster']>): string {
    const { primary, secondary, specific, intensity } = agg;
    const label = intensity > 7 ? 'intensely' : intensity > 4 ? 'moderately' : 'slightly';
    return `Customers ${label} feel ${specific}/${secondary} (core: ${primary}). Intensity: ${intensity}/10.`;
  }

  suggestOfferAngle(agg: ReturnType<EmotionService['aggregateEmotionsFromCluster']>): string {
    const angles: Record<CoreEmotion, string> = {
      happy:  'Reinforce their confidence by showing how your product excels',
      angry:  'Empathize with their frustration and show how you solve the problem',
      scared: 'Build trust through guarantees, case studies, and clear support',
      sad:    'Inspire hope by showing the transformation your product enables',
    };
    return angles[agg.primary];
  }
}

// ─── PROFILE BUILDER (used by avatarService) ─────────────────────────────────

export class EmotionProfileBuilder {
  private svc = new EmotionService();

  buildAvatarEmotionalProfile(comments: EvidenceMessage[]) {
    const agg = this.svc.aggregateEmotionsFromCluster(comments);
    return {
      primaryEmotion:   agg.primary,
      secondaryEmotion: agg.secondary,
      specificFeeling:  agg.specific,
      feelingWheel: { core: agg.primary, ring1: agg.secondary, ring2: agg.specific },
      intensity:        agg.intensity,
      distribution:     agg.distribution,
      indicators:       agg.indicators,
      description:      this.svc.generateEmotionalDescription(agg),
      offerAngle:       this.svc.suggestOfferAngle(agg),
    };
  }
}
