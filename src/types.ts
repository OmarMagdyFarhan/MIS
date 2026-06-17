export interface Specialization {
  name: string;
  note: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  logoUrl?: string; // Optional logo URL
  specializations: Specialization[];
  usp: string;
  country: string;
  websiteUrl?: string;
  isGlobalMode?: boolean;
  createdAt: string;
  validationResult?: {
    question: string;
    example: string;
    score: number;
  };
}

export interface OfferScore {
  total: number;
  clarity: number;
  clarityReasoning?: string;
  relevance: number;
  relevanceReasoning?: string;
  urgency: number;
  urgencyReasoning?: string;
  reasoning: string;
  explanation?: string;
  improvementTip?: string;
}

export interface Offer {
  companyId: string;
  product: string;
  relevance: string;
  reason: string;
  audience: string;
  transformation: string;
  generatedOffer: string;
  generatedAt: string;
  score?: OfferScore;
  history?: Offer[];
  fixSuggestion?: {
    weakestDimension: string;
    diagnosis: string;
    fixSentence: string;
    whereToPutIt: string;
  };
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  type: 'Copywriting' | 'Design' | 'Technical' | 'Strategy';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeEstimate: string;
}

export interface EditSignal {
  field: string;
  before: string;
  after: string;
  industry: string;
  timestamp: string;
  type: 'user_edit' | 'score_improvement';
  deltaScore?: number;
}

export interface IndustryIntelligence {
  topAvatarCategories: string[];
  bestTransformationAngles: string[];
  offerStructuresThatWorked: string[];
  avatarCategoriesDrilledInto: string[];
  lowScoringPatterns: string[];
  avgScoreImprovement: number;
  companiesAnalyzed: number;
  lastUpdated: string;
}

export interface ScoreDeltaInsight {
  deltaTotal: number;
  biggestGain: string;
  gainAmount: number;
  narrative: string;
  whatAvatarsDid: string;
  nextWeakLink: string;
  suggestion: string;
}

export interface RankedAvatarMetadata {
  displayRank: number;
  displayState: 'expanded' | 'collapsed';
  collapseReason?: string;
  priorityLabel: 'primary' | 'secondary' | 'low-priority';
  actionSuggestion: string;
}

export type AvatarLifecycleStatus =
  | 'emerging'
  | 'active'
  | 'declining'
  | 'obsolete';

export interface AvatarEvidenceSnapshot {
  messageCount: number;
  clusterCohesion: number;
  confidenceScore: number;
  representativeQuotes: string[];      // top 3 rawText values from cluster
  aspectDistribution: Record<string, number>;
  corpusVersion: number;
  recordedAt: string;
}

export interface Avatar {
  id: string;
  companyId: string;
  /** Intelligence pipeline: segment cluster this avatar materialized from */
  clusterId?: string | null;
  acquisitionSource?: 'mining' | 'ai' | 'manual' | 'competitor' | 'mixed';
  validationStatus?: 'provisional' | 'validated';
  /** When merged into another segment, points to surviving avatar id */
  mergedIntoAvatarId?: string | null;
  /** Avatars absorbed into this segment (provenance) */
  mergedFromAvatarIds?: string[];
  lifecycleStatus?: AvatarLifecycleStatus;
  evidenceSnapshot?: AvatarEvidenceSnapshot;
  previousSnapshot?: AvatarEvidenceSnapshot;
  name: string;
  description: string;
  score?: number;
  reasoning?: string;
  definingCharacteristic: string;
  visualDescriptor: string; // Added: missing in previous version
  category: 'Goals and Challenges' | 'Demographics' | 'Interest' | 'Triggering Events';
  canHaveSubAvatars: boolean;
  parentId?: string;
  subAvatars?: Avatar[];
  
  // Elements of Value (Bain & Co Pyramid)
  elementsOfValue?: {
    category: 'Functional' | 'Emotional' | 'Life Changing' | 'Social Impact';
    element: string;
    reasonWhy?: string;
  }[];
  valueAnalysis?: string;
  
  // Detailed info (Prompts 3-6)
  demographics?: {
    age: string;
    income: string;
    education: string;
    location: string;
  };
  traits?: {
    hobbies: string;
    interests: string;
    values: string;
  };
  sources?: {
    brands: string[];
    books: string[];
    magazines: string[];
    podcasts: string[];
    influencers: string[];
  };
  questionnaire?: {
    anxious: string;
    motivation: string;
    fondPast: string;
    complicated: string;
    valuableInfo: string;
    moneyMotivation: string;
    healthMotivation: string;
    designMotivation: string;
    fun: string;
    risk: string;
    proudRoles: string;
    aspiringRoles: string;
    averageDay: string;
    averageExpectation: string;
    appearanceMotivation: string;
  };
  transformation?: {
    beforeProblem: string;
    beforeHave: string;
    beforeFeelings: string;
    beforeDay: string;
    beforeStatus: string;
    afterBenefit: string;
    afterDeepBenefit: string;
    afterHave: string;
    afterFeelings: string;
    afterDay: string;
    afterStatus: string;
    hook: string;
  };
  hesitations?: {
    judgments: string;
    reasoning: string;
    addressing: string;
  };

  // New Profile Extension
  imageUrl?: string;
  transformationFramework?: {
    emotional: { before: string; after: string };
    results: { before: string; after: string };
    lifestyle: { before: string; after: string };
    stress: { before: string; after: string };
    identity: { before: string; after: string };
    relationships: { before: string; after: string };
    selfPerception: { before: string; after: string };
    identityTransformation?: { from: string; to: string }; // Added for clarity
  };
  targetedOffer?: {
    offerName: string;
    transformation: string;
    hook: string;
    reasoning: string;
    score?: OfferScore;
  };
  marketIntelligence?: {
    pricePerception: string;
    buyingBehavior: string;
    culturalConsiderations: string;
    offerFraming: string;
  };
  behavioralAnalysis?: {
    category: 'Functional' | 'Emotional' | 'Life Changing' | 'Social Impact';
    analysis: string;
  }[];
  executionPlan?: ActionItem[];
  critique?: string; // Intelligence Hub feedback
  synthesis?: {
    realPrimaryMotivation: CitedClaim | string;
    realPrimaryBlocker: CitedClaim | string;
    actualBuyingWindow: CitedClaim | string;
    winningApproach: CitedClaim | string;
    messagesToUse: string[];
    messagesToAvoid: string[];
    uniqueInsight: CitedClaim | string;
    conflictsResolved: { conflict: string; resolution: string }[];
    confidenceScore: number;
  };
  adversarialProbe?: {
    attackVector: string;
    objection: string;
    resolution: string;
    isResolved: boolean;
  }[]; // Added: structured types for adversarial results
  pipelineMetadata?: {
    totalCalls: number;
    retriesUsed: number;
    synthesisConfidence: number; // Keep for metrics
    scoreGateDecision: string;
    adversarialAttacksResolved: number;
  };
  uiMetadata?: RankedAvatarMetadata;
  
  // Enriched Context (Requested by user)
  deepContext?: {
    pathToPurchase: {
      awareness: string;
      consideration: string;
      decision: string;
    };
    beyondDemographics: {
      valuesAndBeliefs: string;
      painPoints: string;
      goalsAndAspirations: string;
      fearsAndObjections: string;
      interestsAndHobbies: string;
    };
    behavioralDetails: {
      onlineHangouts: string;
      contentConsumption: string;
      communicationPreferences: string;
      purchaseTriggers: string;
    };
  };
  // ── Phase 10 additions ──────────────────────────────────────────────────
  generation?: import('./types/phase10').AvatarGeneration;
  emotionalProfile?: {
    primary: import('./types/phase10').CoreEmotion;
    secondary: import('./types/phase10').MidEmotion;
    specific: import('./types/phase10').SpecificEmotionV2;
    feelingWheel: import('./types/phase10').FeelingWheelLocation;
    intensity: number;
  };
  conversionProfile?: import('./types/phase10').ConversionAspectAnalysis;
  jtbd?: import('./types/phase10').JTBD;
  /** Primary Element of Value (Bain framework, AI-proposed + user-confirmed) */
  primaryValueElement?: import('./types/valueElements').PrimaryValueElement;
}

export interface SynthesisReport {
  rating: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  verdict: string;
}

export interface ActionableInsight {
  type: 'warning' | 'opportunity' | 'action';
  title: string;
  observation: string;
  action: string;
  why: string;
  urgency: 'before_next_stage' | 'anytime';
}

export interface Progress {
  stage1Complete: boolean;
  stage2Complete: boolean;
  stage3Complete: boolean;
  /** Pipeline phase mirror (see types/pipeline.ts) */
  pipelinePhase?: import('./types/pipeline').PipelinePhase;
  acquisitionMode?: import('./types/pipeline').AcquisitionMode;
  avatars?: Avatar[];
  scoreDelta?: ScoreDeltaInsight;
  actionableInsights?: ActionableInsight[];
  synthesisReports?: Record<string, SynthesisReport>;
}

export type Stage = 1 | 2 | 3 | 4;

// ─── Message Mining ──────────────────────────────────────────────

export type ConversionFormulaAspect =
  | 'Anxiety'
  | 'Motivation'
  | 'Friction'
  | 'Incentive'
  | 'Trust'
  | 'Urgency'
  | 'Value';

// ─── Evidence Citation ────────────────────────────────────────────────────────

export interface CitedClaim {
  claim: string;
  supportingMessageIds: string[];   // IDs from EvidenceMessage
  confidence: number;               // 0–1, returned by AI
  lowConfidence?: boolean;          // auto-set: true if supportingMessageIds.length < 3
}

export function getClaimText(field: CitedClaim | string | undefined): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.claim;
}

export function getClaimSources(field: CitedClaim | string | undefined): string[] {
  if (!field || typeof field === 'string') return [];
  return field.supportingMessageIds;
}

export function normalizeClaim(field: CitedClaim | string | undefined): CitedClaim | undefined {
  if (!field) return undefined;
  if (typeof field === 'string') {
    return { claim: field, supportingMessageIds: [], confidence: 0, lowConfidence: true };
  }
  return {
    ...field,
    lowConfidence: field.supportingMessageIds.length < 3,
  };
}

// ─── Psychological Core Sub-aspects ──────────────────────────────────────────

export type MotivationSubAspect =
  | 'Desired Outcome'
  | 'Pain Point / Problem'
  | 'Purchase Prompt';

export type ValueSubAspect =
  | 'Unique Benefit & Advantage'
  | 'Delightful Product Feature'
  | 'Dealbreaker Need / Requirement';

export type AnxietySubAspect =
  | 'Uncertainty'
  | 'Objection'
  | 'Perceived Risk';

export type PsychologicalSubAspect =
  | MotivationSubAspect
  | ValueSubAspect
  | AnxietySubAspect;

// ─── Conversion Signal Tags (flat — Friction / Incentive / Trust / Urgency) ──

export type FrictionSignal    = 'Usability Issue' | 'Complexity' | 'Effort Cost';
export type IncentiveSignal   = 'Discount' | 'Bonus Value' | 'Reward Framing';
export type TrustSignal       = 'High Trust Signal' | 'Low Trust Signal' | 'Authority Mention';
export type UrgencySignal     = 'Time Pressure' | 'Scarcity Mention';

export type ConversionSignalTag =
  | FrictionSignal
  | IncentiveSignal
  | TrustSignal
  | UrgencySignal;

// ─── Feel Wheel Emotion System ────────────────────────────────────────────────
// Three-ring wheel: core → mid → specific
// Storage: single specific label per message. Core/mid inferred downstream.

export type LegacyCoreEmotion =
  | 'Happy' | 'Surprised' | 'Bad' | 'Fearful'
  | 'Angry' | 'Disgusted' | 'Sad';

export type MidEmotion =
  | 'Playful' | 'Content' | 'Interested' | 'Proud' | 'Accepted' | 'Powerful'
  | 'Peaceful' | 'Trusting' | 'Optimistic'
  | 'Startled' | 'Confused' | 'Amazed' | 'Excited'
  | 'Bored' | 'Busy' | 'Stressed' | 'Tired'
  | 'Scared' | 'Anxious' | 'Insecure' | 'Weak' | 'Rejected' | 'Threatened'
  | 'Mad' | 'Aggressive' | 'Frustrated' | 'Distant' | 'Critical'
  | 'Disapproving' | 'Disappointing' | 'Awful' | 'Repelled'
  | 'Hurt' | 'Depressed' | 'Guilty' | 'Despair' | 'Vulnerable' | 'Lonely';

export type SpecificEmotion =
  | 'Joyful' | 'Curious' | 'Inquisitive' | 'Successful' | 'Confident'
  | 'Respected' | 'Valued' | 'Courageous' | 'Creative' | 'Loving'
  | 'Thankful' | 'Sensitive' | 'Intimate' | 'Hopeful' | 'Inspired'
  | 'Aroused' | 'Cheeky' | 'Free' | 'Energetic' | 'Eager'
  | 'Awe' | 'Astonished' | 'Perplexed' | 'Disillusioned' | 'Dismayed'
  | 'Shocked' | 'Unfocused' | 'Sleepy' | 'Out of Control' | 'Overwhelmed'
  | 'Rushed' | 'Pressured' | 'Apathetic' | 'Indifferent' | 'Bored'
  | 'Helpless' | 'Frightened' | 'Worried'
  | 'Inadequate' | 'Inferior' | 'Worthless' | 'Insignificant'
  | 'Excluded' | 'Persecuted' | 'Nervous' | 'Exposed'
  | 'Betrayed' | 'Resentful' | 'Disrespected' | 'Ridiculed'
  | 'Indignant' | 'Violated' | 'Furious' | 'Jealous' | 'Provoked'
  | 'Hostile' | 'Infuriated' | 'Annoyed' | 'Withdrawn' | 'Numb'
  | 'Sceptical' | 'Dismissive' | 'Judgemental' | 'Embarrassed'
  | 'Appalled' | 'Revolted' | 'Nauseated' | 'Detestable'
  | 'Horrified' | 'Hesitant' | 'Disappointed' | 'Empty'
  | 'Remorseful' | 'Ashamed' | 'Powerless' | 'Grief' | 'Fragile'
  | 'Victimised' | 'Abandoned' | 'Isolated' | 'Ignored';

export interface MessageEmotion {
  specific: SpecificEmotion;
  mid: MidEmotion;       // inferred from specific — do not ask AI, derive from map
  core: CoreEmotion;     // inferred from mid — do not ask AI, derive from map
}

export type MessageType =
  | 'Uncertainty'
  | 'Dealbreaker Need'
  | 'Desired Outcome'
  | 'Objection'
  | 'Social Proof Signal'
  | 'Trigger Event'
  | 'Status Motivation'
  | 'Loss Aversion';

export interface MinedMessage {
  id: string;
  text: string;
  topic?: string;
  conversionFormulaAspect?: ConversionFormulaAspect;
  messageType?: MessageType;
  matchedAvatarId?: string | null;
  analyzed: boolean;
  subAspect?: PsychologicalSubAspect;
  secondaryAspect?: ConversionFormulaAspect;
  secondarySubAspect?: PsychologicalSubAspect;
  conversionSignalTags?: ConversionSignalTag[];
  emotion?: SpecificEmotion;
  resolvedEmotion?: MessageEmotion;
}

export interface MessageMiningSession {
  id: string;
  companyId: string;
  avatarId: string;
  messages: MinedMessage[];
  createdAt: string;
  lastAnalyzedAt?: string;
}

// ─── Market Intelligence ────────────────────────────────────────

export type ProblemAwarenessLevel =
  | 'Problem Unaware'
  | 'Problem Aware'
  | 'Solution Aware'
  | 'Product Aware';

export interface MarketIntelligenceData {
  companyId: string;
  coreProblem: string;
  desiredOutcome: string;
  problemAwarenessLevel: ProblemAwarenessLevel;
  buyerDescription: string;
  userDescription: string;
  jobCadence: string;
  derivedFromMessageCount: number;
  lastUpdatedAt: string;
  targetSegment?: string;
}

/** @deprecated use LegacyCoreEmotion */
export type CoreEmotion = LegacyCoreEmotion;
