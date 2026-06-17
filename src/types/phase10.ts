// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 10 - NEW TYPES (additive extension, no breaking changes)
// Adds: Domain Events, Feeling Wheel, Conversion Aspect Analysis,
//       Knowledge Graph, JTBD, ProblemStatement, AvatarGeneration
// These extend existing types.ts & pipeline.ts – nothing is removed.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── DOMAIN EVENTS ───────────────────────────────────────────────────────────

export interface DomainEvent {
  id: string;
  timestamp: number;
  aggregateId: string;
  version: number;
  eventType: string;
}

export interface CommentAddedEvent extends DomainEvent {
  eventType: 'CommentAdded';
  data: { commentId: string; text: string; clusterId?: string; quality?: number };
}

export interface CommentValidatedEvent extends DomainEvent {
  eventType: 'CommentValidated';
  data: { commentId: string; confidence: number; problems: ProblemStatement[]; validatedAt: number };
}

export interface CommentAnalyzedEvent extends DomainEvent {
  eventType: 'CommentAnalyzed';
  data: { commentId: string; emotion: EmotionAnalysisV2; conversionAspect: ConversionAspectAnalysis; clusterId: string };
}

export interface ClusterCreatedEvent extends DomainEvent {
  eventType: 'ClusterCreated';
  data: { clusterId: string; label: string; memberCount: number; initialConfidence: number };
}

export interface ClusterUpdatedEvent extends DomainEvent {
  eventType: 'ClusterUpdated';
  data: { clusterId: string; memberCount: number; confidenceChange: number; newMembers?: string[] };
}

export interface ProblemExtractedEvent extends DomainEvent {
  eventType: 'ProblemExtracted';
  data: { problemId: string; clusterId: string; rootCause: string; severity: number; affectedCommentCount: number; relatedCommentIds: string[] };
}

export interface JTBDIdentifiedEvent extends DomainEvent {
  eventType: 'JTBDIdentified';
  data: { jtbdId: string; clusterId: string; functionalJob: string; emotionalJob: string; socialJob: string; confidence: number };
}

export interface EmotionUpdatedEvent extends DomainEvent {
  eventType: 'EmotionUpdated';
  data: { clusterId: string; primaryEmotion: CoreEmotion; secondaryEmotion: MidEmotion; specificFeelings: SpecificEmotionV2[]; intensity: number; indicators: string[] };
}

export interface AvatarNeedsRefreshEvent extends DomainEvent {
  eventType: 'AvatarNeedsRefresh';
  data: { avatarId: string; reason: string; sourceClusters: string[]; problemCount: number; commentCount: number };
}

export interface AvatarGeneratedEvent extends DomainEvent {
  eventType: 'AvatarGenerated';
  data: { avatarId: string; name: string; sourceClusters: string[]; score: number; generation: AvatarGeneration };
}

export interface OfferNeedsReviewEvent extends DomainEvent {
  eventType: 'OfferNeedsReview';
  data: { offerId: string; avatarId: string; reason: string; mismatches: string[]; recommendations: string[] };
}

export interface OfferEvaluatedEvent extends DomainEvent {
  eventType: 'OfferEvaluated';
  data: { offerId: string; score: { total: number; reasoning: string }; reasoning: string };
}

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): void;
  getEventLog(aggregateId: string): DomainEvent[];
  getEventsSince(timestamp: number): DomainEvent[];
}

// ─── FEELING WHEEL (3-level hierarchy) ───────────────────────────────────────
// NOTE: SpecificEmotionV2 is the Phase 10 expansion of the existing SpecificEmotion.
// Kept as a separate type to avoid breaking existing analyses.

export type CoreEmotion = 'happy' | 'sad' | 'angry' | 'scared';

export type MidEmotion =
  | 'confident' | 'content' | 'playful'         // happy branch
  | 'discouraged' | 'disappointed' | 'gloomy'   // sad branch
  | 'frustrated' | 'aggressive' | 'cynical'     // angry branch
  | 'anxious' | 'uncertain' | 'timid';          // scared branch

export type SpecificEmotionV2 =
  | 'proud' | 'respected' | 'valued' | 'courageous' | 'creative' | 'loving'
  | 'ashamed' | 'worried' | 'miserable' | 'lonely' | 'powerless'
  | 'provoked' | 'hostile' | 'bitter' | 'annoyed' | 'withdrawn'
  | 'panicked' | 'insecure' | 'shocked' | 'overwhelmed' | 'vulnerable'
  | 'peaceful' | 'grateful' | 'satisfied' | 'hopeful'
  | 'joyful' | 'excited' | 'energetic'
  | 'hopeless' | 'defeated'
  | 'let down' | 'betrayed' | 'hurt'
  | 'depressed' | 'dark' | 'empty'
  | 'irritated' | 'combative' | 'sarcastic' | 'contemptuous' | 'skeptical' | 'distrustful'
  | 'nervous' | 'hesitant' | 'confused' | 'doubtful' | 'lost'
  | 'weak' | 'intimidated';

export interface FeelingWheelLocation {
  core: CoreEmotion;
  ring1: MidEmotion;
  ring2: SpecificEmotionV2;
}

export interface EmotionAnalysisV2 {
  primaryEmotion: CoreEmotion;
  secondaryEmotion: MidEmotion;
  specificFeeling: SpecificEmotionV2;
  feelingWheelPath: FeelingWheelLocation;
  intensity: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  indicators: string[];
  sourceCommentId: string;
}

// ─── CONVERSION ASPECTS (3-layer: Motivation / Value / Anxiety) ──────────────

export interface MotivationAnalysis {
  desiredOutcomes: string[];
  painPoints: string[];
  purchasePrompts: string[];
  confidence: number;
  sourceCommentIds: string[];
}

export interface ValueAnalysis {
  uniqueBenefits: string[];
  delightfulFeatures: string[];
  dealreakerNeeds: string[];
  confidence: number;
  sourceCommentIds: string[];
}

export interface AnxietyAnalysis {
  uncertainties: string[];
  objections: string[];
  perceivedRisks: string[];
  confidence: number;
  sourceCommentIds: string[];
}

export interface ConversionAspectAnalysis {
  motivation: MotivationAnalysis;
  value: ValueAnalysis;
  anxiety: AnxietyAnalysis;
}

// ─── PROBLEM STATEMENT & JTBD ────────────────────────────────────────────────

export interface ProblemStatement {
  id: string;
  clusterId: string;
  problem: string;
  rootCause: string;
  severity: number; // 0-10
  affectedCommentCount: number;
  affectedCommentIds: string[];
  category?: string;
}

export interface JTBD {
  id: string;
  clusterId: string;
  functionalJob: string;
  emotionalJob: string;
  socialJob: string;
  confidence: number; // 0-1
  derivedFromComments: string[];
}

// ─── AVATAR GENERATION METADATA (provenance) ─────────────────────────────────

export interface AvatarGeneration {
  method: 'clusters' | 'comments' | 'ai-initial';
  timestamp: number;
  sourceClusterIds: string[];
  sourceCommentIds: string[];
  commentCount: number;
  clusterCount: number;
  evidenceQuality: number;   // 0-1
  clusterCohesion: number;   // 0-1
  dominantProblems: ProblemStatement[];
  dominantEmotion?: CoreEmotion;
  dominantJTBD?: JTBD;
  // ── Phase 14.2 additions ──────────────────────────────────────────────────
  modelUsed?: string;        // e.g. 'gemini-1.5-flash', 'openai/gpt-4o-mini'
  providerUsed?: 'gemini' | 'openrouter'; // which provider answered
}

// ─── KNOWLEDGE GRAPH ─────────────────────────────────────────────────────────

export type GraphNodeType =
  | 'comment' | 'cluster' | 'problem' | 'jtbd' | 'emotion' | 'avatar' | 'offer';

export type GraphRelationship =
  | 'CONTRIBUTED_TO' | 'PART_OF' | 'EXTRACTED_FROM' | 'FELT_IN'
  | 'SYNTHESIZED_INTO' | 'DESIGNED_FOR' | 'ADDRESSES' | 'SATISFIES'
  | 'BUILDS' | 'EXPRESSES' | 'NEEDS' | 'EXPERIENCES' | 'SOLVES' | 'CREATES';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  properties: Record<string, unknown>;
  labels: string[];
  createdAt: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relationship: GraphRelationship;
  properties: Record<string, unknown>;
  weight?: number;
  createdAt: number;
}
