/**
 * Determinism architecture — Three Locks
 * Every AI call must pass all three locks before execution.
 * @module src/types/determinism
 */

import type { PipelineIntent } from './pipeline';

// ─── Lock 1 — Intent Lock ────────────────────────────────────────────────────

/** Task types that control temperature. classification/structure = 0.0, generation = 0.3 */
export type AITaskType = 'classification' | 'structure' | 'generation';

/**
 * Context attached to every AI call. All three fields are mandatory.
 * An AI call without a declared context MUST NOT execute.
 */
export interface AICallContext {
  /** Unique ID for this pipeline run (from PipelineStore.startRun). */
  runId: string;
  /** The declared user intent that triggered this call. */
  intent: PipelineIntent;
  /** Corpus version at the start of this run — used for Lock 2. */
  corpusVersion: number;
  /**
   * Task type — determines temperature:
   * - 'classification' → 0.0
   * - 'structure' → 0.0
   * - 'generation' → 0.3
   */
  taskType: AITaskType;
}

// ─── Lock 2 — Corpus Version Lock ────────────────────────────────────────────

/**
 * Thrown when the corpus is modified during an in-flight pipeline run.
 * Callers must surface this to the user and require explicit restart.
 */
export class CorpusModifiedDuringRunError extends Error {
  readonly runId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(runId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Corpus was modified during run "${runId}". ` +
        `Expected version ${expectedVersion}, found ${actualVersion}. ` +
        `Please restart the analysis.`
    );
    this.name = 'CorpusModifiedDuringRunError';
    this.runId = runId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Asserts the corpus version has not changed since the run started.
 * Call this before every AI request inside a pipeline run.
 */
export function assertCorpusVersion(
  runId: string,
  lockedVersion: number,
  currentVersion: number
): void {
  if (currentVersion !== lockedVersion) {
    throw new CorpusModifiedDuringRunError(runId, lockedVersion, currentVersion);
  }
}

// ─── Lock 3 — Schema Lock ────────────────────────────────────────────────────

/** Thrown when an AI response does not match the expected schema. */
export class SchemaValidationError extends Error {
  readonly field: string;
  readonly raw: unknown;

  constructor(field: string, raw: unknown) {
    super(`AI response failed schema validation at "${field}".`);
    this.name = 'SchemaValidationError';
    this.field = field;
    this.raw = raw;
  }
}

// ─── Schema Validators ───────────────────────────────────────────────────────

/** Cluster AI response shape — validated before use. */
export interface ClusterAIResponse {
  clusters: Array<{
    label: string;
    messageIds: string[];
    dominantAspects?: string[];
    dominantTypes?: string[];
  }>;
}

export function validateClusterResponse(raw: unknown): ClusterAIResponse {
  if (!raw || typeof raw !== 'object') {
    throw new SchemaValidationError('clusters', raw);
  }
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.clusters)) {
    throw new SchemaValidationError('clusters.clusters', raw);
  }
  for (const c of r.clusters as unknown[]) {
    if (!c || typeof c !== 'object') throw new SchemaValidationError('clusters[].item', c);
    const cluster = c as Record<string, unknown>;
    if (typeof cluster.label !== 'string') {
      throw new SchemaValidationError('clusters[].label', cluster);
    }
    if (!Array.isArray(cluster.messageIds)) {
      throw new SchemaValidationError('clusters[].messageIds', cluster);
    }
  }
  return raw as ClusterAIResponse;
}

/** Avatar offer formula response — validated before use. */
export interface OfferFormulaAIResponse {
  formula: {
    audience: string;
    product: string;
    transformation: string;
    reasonToActNow: string;
    specificity: string;
  };
  rendered: {
    hook?: string;
    offerName?: string;
    longCopy?: string;
  };
}

export function validateOfferFormulaResponse(raw: unknown): OfferFormulaAIResponse {
  if (!raw || typeof raw !== 'object') {
    throw new SchemaValidationError('offerFormula', raw);
  }
  const r = raw as Record<string, unknown>;
  if (!r.formula || typeof r.formula !== 'object') {
    throw new SchemaValidationError('offerFormula.formula', raw);
  }
  const f = r.formula as Record<string, unknown>;
  const requiredFormulaFields = ['audience', 'product', 'transformation', 'reasonToActNow', 'specificity'];
  for (const field of requiredFormulaFields) {
    if (typeof f[field] !== 'string') {
      throw new SchemaValidationError(`offerFormula.formula.${field}`, f);
    }
  }
  if (!r.rendered || typeof r.rendered !== 'object') {
    throw new SchemaValidationError('offerFormula.rendered', raw);
  }
  return raw as OfferFormulaAIResponse;
}

/** Message analysis response — validated before use. */
export interface MessageAnalysisAIResponse {
  analyses: Array<{
    topic: string;
    conversionFormulaAspect: string;
    messageType: string;
  }>;
}

export function validateMessageAnalysisResponse(raw: unknown): MessageAnalysisAIResponse {
  if (!raw || typeof raw !== 'object') {
    throw new SchemaValidationError('messageAnalysis', raw);
  }
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.analyses)) {
    throw new SchemaValidationError('messageAnalysis.analyses', raw);
  }
  for (const a of r.analyses as unknown[]) {
    if (!a || typeof a !== 'object') throw new SchemaValidationError('messageAnalysis[].item', a);
    const analysis = a as Record<string, unknown>;
    if (typeof analysis.topic !== 'string') {
      throw new SchemaValidationError('messageAnalysis[].topic', analysis);
    }
    if (typeof analysis.conversionFormulaAspect !== 'string') {
      throw new SchemaValidationError('messageAnalysis[].conversionFormulaAspect', analysis);
    }
    if (typeof analysis.messageType !== 'string') {
      throw new SchemaValidationError('messageAnalysis[].messageType', analysis);
    }
  }
  return raw as MessageAnalysisAIResponse;
}

// ─── Problem Taxonomy ────────────────────────────────────────────────────────

/**
 * Predefined taxonomy of problem types.
 * AI must assign clusters to a taxonomy entry — never invent free-text labels.
 * The human-readable label is derived from the taxonomy entry.
 *
 * Rule: "ID is identity. Label is display. Never compare by label."
 */
export const PROBLEM_TAXONOMY = [
  { id: 'TAX_01', label: 'Pricing & Value Perception',     description: 'Cost concerns, price sensitivity, ROI doubts' },
  { id: 'TAX_02', label: 'Trust & Credibility',             description: 'Brand trust, social proof, reviews, authority' },
  { id: 'TAX_03', label: 'Complexity & Ease of Use',        description: 'Steep learning curve, complexity fears, setup friction' },
  { id: 'TAX_04', label: 'Time & Speed',                    description: 'Time investment, speed of results, patience limits' },
  { id: 'TAX_05', label: 'Risk & Safety',                   description: 'Perceived risk, safety concerns, fear of failure' },
  { id: 'TAX_06', label: 'Relevance & Fit',                 description: 'Does this apply to me, is this for my situation' },
  { id: 'TAX_07', label: 'Results & Outcomes',              description: 'Effectiveness doubts, outcome uncertainty, proof demands' },
  { id: 'TAX_08', label: 'Support & Service',               description: 'Post-purchase support quality, helpdesk, responsiveness' },
  { id: 'TAX_09', label: 'Comparison & Alternatives',       description: 'Competitive comparison, switching costs, alternatives' },
  { id: 'TAX_10', label: 'Implementation & Onboarding',     description: 'Getting started difficulty, integration concerns' },
  { id: 'TAX_11', label: 'Commitment & Lock-in',            description: 'Contract length, cancellation, flexibility concerns' },
  { id: 'TAX_12', label: 'Desire for Transformation',       description: 'Core motivation, desired life change, end goal' },
  { id: 'TAX_13', label: 'Social Proof & Community',        description: 'Need for peer validation, community belonging' },
  { id: 'TAX_14', label: 'Immediacy & Urgency',             description: 'Why buy now, time-sensitive decisions, delays' },
  { id: 'TAX_15', label: 'Identity & Self-Image',           description: 'Who this makes them, status, belonging, identity fit' },
  { id: 'TAX_16', label: 'Financial Anxiety',               description: 'Budget constraints, financial risk, payment friction' },
  { id: 'TAX_17', label: 'Information & Education',         description: 'Need for clarity, overwhelm with options, knowledge gaps' },
  { id: 'TAX_18', label: 'Delivery & Logistics',            description: 'Shipping, availability, access, fulfilment concerns' },
  { id: 'TAX_19', label: 'Customisation & Flexibility',     description: 'One-size-fits-all problems, personalisation needs' },
  { id: 'TAX_20', label: 'Performance & Quality',           description: 'Product quality standards, durability, reliability' },
  { id: 'TAX_21', label: 'Privacy & Data Concerns',         description: 'Data usage, privacy, GDPR, surveillance worries' },
  { id: 'TAX_22', label: 'Compatibility & Integration',     description: 'Works with existing stack/workflow, API concerns' },
  { id: 'TAX_23', label: 'Scalability & Growth',            description: 'Will it scale with me, team size, usage limits' },
  { id: 'TAX_24', label: 'Emotional & Psychological Need',  description: 'Stress relief, peace of mind, confidence boost' },
  { id: 'TAX_25', label: 'Authority & Expertise',           description: 'Qualification of provider, credentials, track record' },
] as const;

export type ProblemTaxonomyId = typeof PROBLEM_TAXONOMY[number]['id'];

export function getTaxonomyEntry(id: ProblemTaxonomyId) {
  return PROBLEM_TAXONOMY.find(t => t.id === id);
}

export function getTaxonomyLabel(id: ProblemTaxonomyId): string {
  return getTaxonomyEntry(id)?.label ?? id;
}
