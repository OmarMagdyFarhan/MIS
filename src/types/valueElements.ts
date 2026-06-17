/**
 * Two-tier Elements of Value selection system.
 * Layer 1: The curated 12-element set — always attempted first.
 * Layer 2: The full 30-element fallback — used only when no Layer 1 element
 *   matches with sufficient AI confidence. Fallback usage must be flagged.
 */
export type ValueElementTier1 =
  | 'makes_money'
  | 'saves_time'
  | 'reduces_risk'
  | 'reduces_anxiety'
  | 'reduces_effort'
  | 'simplifies'
  | 'informs'
  | 'provides_access'
  | 'provides_hope'
  | 'motivates'
  | 'reduces_cost'
  | 'self_actualization';

export type ValueElementTier2 =
  | 'avoids_hassles'
  | 'organizes'
  | 'integrates'
  | 'connects'
  | 'variety'
  | 'sensory_appeal'
  | 'quality'
  | 'fun_entertainment'
  | 'attractiveness'
  | 'badge_value'
  | 'therapeutic_value'
  | 'wellness'
  | 'nostalgia'
  | 'design_aesthetics'
  | 'rewards_me'
  | 'heirloom'
  | 'affiliation_belonging'
  | 'self_transcendence';

export type ValueElement = ValueElementTier1 | ValueElementTier2;

export interface PrimaryValueElement {
  element: ValueElement;
  tier: 1 | 2;
  /** Whether AI used the fallback tier (should be rare — log for system improvement) */
  usedFallback: boolean;
  /** AI-generated one-sentence rationale grounded in the avatar's evidence */
  rationale: string;
  /** The AI's confidence in this assignment (0–1, derived from evidence coverage) */
  confidence: number;
  /** 'proposed' = AI assigned, awaiting user confirmation. 'confirmed' = user validated. */
  status: 'proposed' | 'confirmed';
  /** ISO timestamp of the last user confirmation or override */
  confirmedAt?: string;
}

export const VALUE_ELEMENT_LABELS: Record<ValueElement, string> = {
  makes_money: 'Makes Money',
  saves_time: 'Saves Time',
  reduces_risk: 'Reduces Risk',
  reduces_anxiety: 'Reduces Anxiety',
  reduces_effort: 'Reduces Effort',
  simplifies: 'Simplifies',
  informs: 'Informs',
  provides_access: 'Provides Access',
  provides_hope: 'Provides Hope',
  motivates: 'Motivates',
  reduces_cost: 'Reduces Cost',
  self_actualization: 'Self-Actualization',
  avoids_hassles: 'Avoids Hassles',
  organizes: 'Organizes',
  integrates: 'Integrates',
  connects: 'Connects',
  variety: 'Variety',
  sensory_appeal: 'Sensory Appeal',
  quality: 'Quality',
  fun_entertainment: 'Fun / Entertainment',
  attractiveness: 'Attractiveness',
  badge_value: 'Badge Value',
  therapeutic_value: 'Therapeutic Value',
  wellness: 'Wellness',
  nostalgia: 'Nostalgia',
  design_aesthetics: 'Design / Aesthetics',
  rewards_me: 'Rewards Me',
  heirloom: 'Heirloom',
  affiliation_belonging: 'Affiliation / Belonging',
  self_transcendence: 'Self-Transcendence',
};

export const TIER1_ELEMENTS: ValueElementTier1[] = [
  'makes_money', 'saves_time', 'reduces_risk', 'reduces_anxiety',
  'reduces_effort', 'simplifies', 'informs', 'provides_access',
  'provides_hope', 'motivates', 'reduces_cost', 'self_actualization',
];

export const TIER2_ELEMENTS: ValueElementTier2[] = [
  'avoids_hassles', 'organizes', 'integrates', 'connects',
  'variety', 'sensory_appeal', 'quality', 'fun_entertainment',
  'attractiveness', 'badge_value', 'therapeutic_value', 'wellness',
  'nostalgia', 'design_aesthetics', 'rewards_me', 'heirloom',
  'affiliation_belonging', 'self_transcendence',
];
