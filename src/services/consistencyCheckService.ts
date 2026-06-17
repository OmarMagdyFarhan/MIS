/**
 * Strategic Consistency Check
 *
 * Detects contradictions between avatars, market intelligence,
 * and the core offer. Flags misalignments with a confidence penalty.
 *
 * Examples of inconsistency:
 * - Avatar says "budget-conscious" but core offer says "premium luxury"
 * - Market intel says "problem-unaware" but offer says "compare us to X"
 * - Avatar pricePerception says "too expensive" but model charges premium
 */

import type { Avatar } from '../types';
import type { MarketIntelligenceData } from '../types';
import type { } from '../types/pipeline';

export type ConsistencyFlag = 'consistent' | 'tension' | 'contradiction';

export interface ConsistencyIssue {
  field: string;
  sourceA: string;
  sourceB: string;
  valueA: string;
  valueB: string;
  flag: ConsistencyFlag;
  description: string;
  suggestedResolution: string;
}

export interface ConsistencyReport {
  companyId: string;
  overallConsistency: number;   // 0–1
  issues: ConsistencyIssue[];
  contradictions: ConsistencyIssue[];
  tensions: ConsistencyIssue[];
}

export function checkStrategicConsistency(
  companyId: string,
  avatars: Avatar[],
  marketIntel: MarketIntelligenceData | null,
): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];

  // Check 1: Price perception vs offer transformation language
  const premiumOffer = avatars.some(a =>
    a.targetedOffer?.transformation?.toLowerCase().match(
    /\b(luxury|premium|elite|exclusive|world-class|best-in-class)\b/
  ));
  const budgetAvatars = avatars.filter(a =>
    a.marketIntelligence?.pricePerception?.toLowerCase().match(
      /\b(expensive|too much|can't afford|budget|cheap)\b/
    )
  );
  if (premiumOffer && budgetAvatars.length > avatars.length / 2) {
    issues.push({
      field: 'price_positioning',
      sourceA: 'avatar_offers.formula.transformation',
      sourceB: `avatars[${budgetAvatars.map(a => a.name).join(', ')}].marketIntelligence.pricePerception`,
      valueA: 'Premium positioning language detected',
      valueB: `${budgetAvatars.length} avatar(s) show price sensitivity`,
      flag: 'contradiction',
      description: 'Core offer uses premium language but majority of avatars show price sensitivity.',
      suggestedResolution: 'Either add a risk-reversal (money-back guarantee) to the offer or reconsider the premium positioning.',
    });
  }


  // Check 3: Avatar synthesis contradictions across segments
  const motivations = avatars
    .filter(a => a.synthesis?.realPrimaryMotivation)
    .map(a => {
      const m = a.synthesis!.realPrimaryMotivation;
      return typeof m === 'object' && 'claim' in m ? (m as { claim: string }).claim : String(m);
    });

  // Detect if any two avatars have directly opposite motivations
  if (motivations.length >= 2) {
    const oppositePattern: [string, string][] = [
      ['save money', 'premium quality'],
      ['fast', 'thorough'],
      ['simple', 'comprehensive'],
    ];
    for (const [a, b] of oppositePattern) {
      const hasA = motivations.some(m => m.toLowerCase().includes(a));
      const hasB = motivations.some(m => m.toLowerCase().includes(b));
      if (hasA && hasB) {
        issues.push({
          field: 'cross_avatar_motivation',
          sourceA: 'avatar.synthesis.realPrimaryMotivation',
          sourceB: 'avatar.synthesis.realPrimaryMotivation',
          valueA: `"${a}" motivation detected in one segment`,
          valueB: `"${b}" motivation detected in another segment`,
          flag: 'tension',
          description: `Opposing motivations across segments: "${a}" vs "${b}". The core offer may not serve both.`,
          suggestedResolution: 'Consider separate messaging tracks for each segment or clarify which segment is primary.',
        });
      }
    }
  }

  const contradictions = issues.filter(i => i.flag === 'contradiction');
  const tensions = issues.filter(i => i.flag === 'tension');

  const penaltyPerContradiction = 0.2;
  const penaltyPerTension = 0.08;
  const overallConsistency = Math.max(0,
    1 - contradictions.length * penaltyPerContradiction - tensions.length * penaltyPerTension
  );

  return { companyId, overallConsistency, issues, contradictions, tensions };
}
