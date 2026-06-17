/**
 * Intelligence pipeline — canonical structured layers (L0–L8).
 * Rendered marketing copy is never stored here without a formula parent.
 */

import type {
  ConversionFormulaAspect,
  MessageType,
  MarketIntelligenceData,
  OfferScore,
  ProblemAwarenessLevel,
  PsychologicalSubAspect,
  ConversionSignalTag,
  SpecificEmotion,
} from '../types';

export type PipelinePhase =
  | 'company_complete'
  | 'corpus_active'
  | 'corpus_analyzed'
  | 'clusters_proposed'
  | 'clusters_validated'
  | 'segments_materialized'
  | 'avatar_offers_ready'
  | 'pipeline_complete'
  | 'copy_rendered';

export type AcquisitionMode = 'evidence_first' | 'hybrid' | 'bootstrap';
export type ValidationStatus = 'provisional' | 'validated';
export type AcquisitionSource = 'mining' | 'ai' | 'manual' | 'competitor' | 'mixed';
export type ClusterStatus = 'proposed' | 'validated' | 'merged' | 'archived';
export type EvidenceSource = 'paste' | 'import' | 'competitor' | 'synthetic' | 'unknown';

export type PipelineIntent =
  | 'analyze_corpus'
  | 'propose_clusters'
  | 'propose_clusters_delta'
  | 'materialize_avatars'
  | 'synthesize_avatar_offers'
  | 'synthesize_market_intel'
  | 'render_copy'
  | 'full_downstream_from_clusters'
  | 'incremental_message_add'
  | 'legacy_mining_run'
  | 'ingest_messages'
  | 'delta_cluster'
  | 'evolve_avatars'
  | 'generate_avatars_from_clusters';

export type ArtifactLayer =
  | 'corpus'
  | 'messages'
  | 'clusters'
  | 'avatars'
  | 'avatar_offers'
  | 'market_intel'
  | 'rendered_copy';

/** Canonical offer intelligence (L5/L7) */
export interface OfferFormula {
  audience: string;
  product: string;
  transformation: string;
  reasonToActNow: string;
  specificity: string;
}

export interface DerivedFrom {
  corpusVersion: number;
  messageIds?: string[];
  clusterId?: string;
  avatarId?: string;
  avatarOfferIds?: string[];
  runId?: string;
  marketIntelligenceVersion?: number;
}

export interface ConfidenceSnapshot {
  overall: number;
  dimensions: {
    evidenceVolume: number;
    clusterCohesion: number;
    offerEvidenceAlignment: number;
    crossSegmentAgreement: number;
  };
  status: ValidationStatus;
  reasons: string[];
  computedAt: string;
  corpusVersion: number;
}

export interface EvidenceMessage {
  id: string;
  rawText: string;
  source: EvidenceSource;
  originalLanguage?: string;   // ISO 639-1 code ('ar', 'es', 'fr', 'en')
  normalizedText?: string;     // English translation used for analysis; equals rawText if already English
  sourceLabel?: string;        // human label: 'Amazon Reviews', 'Reddit r/dogs', etc.
  addedAt?: string;            // ISO timestamp of when this message entered the corpus
  analyzed: boolean;
  analysis?: {
    topic: string;
    conversionFormulaAspect: ConversionFormulaAspect;
    // Psychological Core only — undefined for Friction/Incentive/Trust/Urgency
    subAspect?: PsychologicalSubAspect;
    // Only set when secondary is significantly present (AI judgement call)
    secondaryAspect?: ConversionFormulaAspect;
    secondarySubAspect?: PsychologicalSubAspect;
    // Flat signal tags — only set for the 4 Conversion Dynamics
    conversionSignalTags?: ConversionSignalTag[];
    messageType: MessageType;
    qualityScore: number;
    // Single specific emotion label — mid/core derived via resolveEmotion()
    emotion?: SpecificEmotion;
    // ── Phase 10 additions ────────────────────────────────────────────────
    phase10Emotion?: import('./phase10').EmotionAnalysisV2;
    conversionAspects?: import('./phase10').ConversionAspectAnalysis;
    emotionIntensity?: number;
  };
  clusterId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisRun {
  id: string;
  intent: PipelineIntent;
  fromCorpusVersion: number;
  toCorpusVersion: number;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  stats?: Record<string, number>;
}

export interface Cluster {
  id: string;
  companyId: string;
  corpusVersion: number;
  label: string;
  status: ClusterStatus;
  messageIds: string[];
  cohesionScore?: number;
  dominantAspects?: ConversionFormulaAspect[];
  dominantTypes?: MessageType[];
  avatarId?: string | null;
  source: AcquisitionSource;
  validationStatus: ValidationStatus;
  createdAt: string;
  updatedAt: string;
  messageCountHistory?: Array<{
    corpusVersion: number;
    count: number;
    recordedAt: string;
  }>;
  firstSeenAt?: string;
  lastGrowthAt?: string;
  trendDirection?: 'growing' | 'stable' | 'declining';
  trendDelta?: number;  // % change in message count vs previous version snapshot
  // ── Phase 10 additions ──────────────────────────────────────────────────
  confidence?: number;                                           // alias for cohesionScore (0-1)
  quality?: number;                                              // overall cluster quality (0-1)
  dominantProblems?: import('./phase10').ProblemStatement[];
  clusterEmotions?: import('./phase10').CoreEmotion[];
  jtbdFromCluster?: import('./phase10').JTBD;
  representativeCommentIds?: string[];
  // ── Phase 14.2 additions ─────────────────────────────────────────────────
  relevanceScore?: number;                                       // 0-1, from filterRelevantMessages
}

export interface MiningCorpus {
  companyId: string;
  version: number;
  mode: AcquisitionMode;
  messages: EvidenceMessage[];
  clusters: Cluster[];
  runs: AnalysisRun[];
  ingests?: CorpusIngest[];
  createdAt: string;
  updatedAt: string;
}

export type IngestSource =
  | 'amazon_reviews'
  | 'reddit'
  | 'support_chat'
  | 'customer_interview'
  | 'survey_response'
  | 'social_media'
  | 'manual_paste'
  | 'csv_import'
  | 'unknown';

export interface CorpusIngest {
  id: string;
  companyId: string;
  source: IngestSource;
  sourceLabel?: string;
  messageCount: number;
  addedAt: string;
  corpusVersionBefore: number;
  corpusVersionAfter: number;
  languagesDetected: string[];
  translatedCount: number;
}

export interface OfferRendered {
  hook?: string;
  offerName?: string;
  longCopy?: string;
  generatedOffer?: string;
}

export interface AvatarOfferRecord {
  id: string;
  companyId: string;
  avatarId: string;
  clusterId: string;
  formula: OfferFormula;
  validationStatus: ValidationStatus;
  confidence: ConfidenceSnapshot;
  derivedFrom: DerivedFrom;
  rendered?: OfferRendered;
  score?: OfferScore;
  stale?: boolean;
  updatedAt: string;
}


export interface ProvenanceLink {
  id: string;
  companyId: string;
  artifactType: 'cluster' | 'avatar' | 'avatar_offer' | 'market_intel';
  artifactId: string;
  fieldPath?: string;
  evidenceMessageIds: string[];
  clusterId?: string;
  runId: string;
  createdAt: string;
}

export interface StaleFlags {
  messages: boolean;
  clusters: boolean;
  avatars: boolean;
  avatarOffers: boolean;
  marketIntel: boolean;
  renderedCopy: boolean;
}

export interface PipelineRun {
  id: string;
  companyId: string;
  intent: PipelineIntent;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: { step: string; current: number; total: number };
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface CompanyPipelineState {
  companyId: string;
  phase: PipelinePhase;
  acquisitionMode: AcquisitionMode;
  stale: StaleFlags;
  activeRunId?: string | null;
  lastRunId?: string | null;
  updatedAt: string;
}

export interface IntelligenceStoreSnapshot {
  corpora: Record<string, MiningCorpus>;
  pipelineByCompany: Record<string, CompanyPipelineState>;
  avatarOffers: Record<string, AvatarOfferRecord>;  provenance: Record<string, ProvenanceLink[]>;
  marketIntelligence: Record<string, MarketIntelligenceData & { corpusVersion?: number; validationStatus?: ValidationStatus }>;
}

/** Re-export for market intel alignment */
export type { ProblemAwarenessLevel };
