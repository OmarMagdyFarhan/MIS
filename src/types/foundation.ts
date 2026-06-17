export type FoundationId = 'market' | 'product' | 'brand' | 'model';

export type AnswerStatus =
  | 'empty'           // no data, no user input
  | 'inferred'        // system pre-filled, awaiting user decision
  | 'validated'       // user confirmed or edited
  | 'deferred';       // user marked "research later"

// ─── Signal Strength vs Evidence Quality are different dimensions ─────────────
// Signal Strength (0–1): how strongly the available data points toward a conclusion
// Evidence Quality: how trustworthy the underlying dataset is
// Example: 3 avatars → Signal 0.82, Quality: low
//          800 analyzed messages + 12 avatars → Signal 0.82, Quality: high
export type EvidenceQuality = 'low' | 'medium' | 'high';

export type InferenceSource =
  | 'avatars'
  | 'messages'
  | 'market_intel'
  | 'offer_formula'
  | 'company_profile'
  | 'none';

export interface InferredOption {
  value: string;
  signalStrength: number;              // 0–1, renamed from "confidence" in types
  evidenceQuality: EvidenceQuality;
  sources: InferenceSource[];
  reasoning: string;                   // one sentence: why this was inferred
  isHypothesis: true;                  // always true — enforces hypothesis framing
  supportingEvidenceIds?: string[];
}

export interface GapSignal {
  description: string;
  researchQuestion: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface FoundationAnswer {
  questionId: string;
  foundationId: FoundationId;
  status: AnswerStatus;
  primarySuggestion?: InferredOption;
  alternatives?: InferredOption[];    // max 2
  gaps?: GapSignal[];
  overallSignalStrength: number;      // 0–1
  overallEvidenceQuality: EvidenceQuality;
  // User decision
  userChoice?: 'primary' | 'alternative_0' | 'alternative_1' | 'custom' | 'deferred';
  customValue?: string;
  chosenValue?: string;
  chosenAt?: string;
  feedbackApplied: boolean;
}

export type InferenceStrategy =
  | 'from_offer_audience'
  | 'from_avatars_demographics'
  | 'from_market_intel_core_problem'
  | 'from_market_intel_awareness'
  | 'from_avatars_motivation'
  | 'from_avatars_sources'
  | 'from_messages_buyer_signal'
  | 'from_corpus_aspect_distribution'
  | 'from_offer_transformation'
  | 'from_offer_product'
  | 'from_offer_specificity'
  | 'from_avatars_transformation_hook'
  | 'from_avatars_price_perception'
  | 'from_avatars_risk'
  | 'from_corpus_trust_messages'
  | 'from_avatars_values_traits'
  | 'from_avatars_emotional_pattern'
  | 'not_inferable';

export interface FoundationQuestion {
  id: string;
  foundationId: FoundationId;
  label: string;
  description: string;
  isRequired: boolean;                // strategic importance, independent of inferability
  inferenceStrategy: InferenceStrategy;
  inputType: 'text' | 'select' | 'number';
  placeholder?: string;
}
