import type { Company, Avatar, Offer, MarketIntelligenceData } from '../types';
import type { EvidenceMessage } from '../types/pipeline';
import type {
  FoundationQuestion, InferredOption, GapSignal,
  InferenceSource, EvidenceQuality,
} from '../types/foundation';

export interface InferenceContext {
  company: Company;
  avatars: Avatar[];
  messages: EvidenceMessage[];
  marketIntel: MarketIntelligenceData | null;  offer: Offer | null;
}

export interface InferenceResult {
  questionId: string;
  primary?: InferredOption;
  alternatives: InferredOption[];
  gaps: GapSignal[];
  overallSignalStrength: number;
  overallEvidenceQuality: EvidenceQuality;
  canInfer: boolean;
}

export function inferAnswer(
  question: FoundationQuestion,
  ctx: InferenceContext
): InferenceResult {
  const handler = HANDLERS[question.inferenceStrategy];
  if (!handler) return notInferable(question.id);
  return handler(question.id, ctx);
}

// ─── Evidence quality thresholds ─────────────────────────────────────────────
// Quality is about dataset size and diversity, not signal direction.

function computeEvidenceQuality(ctx: InferenceContext, sources: InferenceSource[]): EvidenceQuality {
  const analyzedMsgs = ctx.messages.filter(m => m.analyzed).length;
  const avatarCount = ctx.avatars.length;

  if (sources.includes('messages')) {
    if (analyzedMsgs >= 100) return 'high';
    if (analyzedMsgs >= 20) return 'medium';
    return 'low';
  }
  if (sources.includes('avatars')) {
    if (avatarCount >= 5 && analyzedMsgs >= 50) return 'high';
    if (avatarCount >= 2 && analyzedMsgs >= 10) return 'medium';
    return 'low';
  }
  if (sources.includes('market_intel') || sources.includes('offer_formula')) {
    return 'medium';  // structural data — quality depends on how it was derived
  }
  return 'low';
}

function option(
  value: string,
  signalStrength: number,
  sources: InferenceSource[],
  reasoning: string,
  ctx: InferenceContext,
  supportingEvidenceIds?: string[]
): InferredOption {
  return {
    value,
    signalStrength,
    evidenceQuality: computeEvidenceQuality(ctx, sources),
    sources,
    reasoning,
    isHypothesis: true,
    supportingEvidenceIds,
  };
}

// ─── Result builders ──────────────────────────────────────────────────────────

function notInferable(id: string): InferenceResult {
  return {
    questionId: id, primary: undefined, alternatives: [],
    gaps: [], overallSignalStrength: 0, overallEvidenceQuality: 'low', canInfer: false,
  };
}

function withGap(id: string, description: string, researchQuestion: string, priority: GapSignal['priority']): InferenceResult {
  return {
    questionId: id, primary: undefined, alternatives: [],
    gaps: [{ description, researchQuestion, priority }],
    overallSignalStrength: 0, overallEvidenceQuality: 'low', canInfer: false,
  };
}

function single(id: string, opt: InferredOption, gaps: GapSignal[] = []): InferenceResult {
  return {
    questionId: id, primary: opt, alternatives: [], gaps,
    overallSignalStrength: opt.signalStrength,
    overallEvidenceQuality: opt.evidenceQuality, canInfer: true,
  };
}

function multi(id: string, options: InferredOption[]): InferenceResult {
  if (!options.length) return notInferable(id);
  const [primary, ...alternatives] = options;
  return {
    questionId: id, primary, alternatives: alternatives.slice(0, 2), gaps: [],
    overallSignalStrength: primary.signalStrength,
    overallEvidenceQuality: primary.evidenceQuality, canInfer: true,
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

type Handler = (id: string, ctx: InferenceContext) => InferenceResult;

const HANDLERS: Record<string, Handler> = {

  from_offer_audience: (id, ctx) => {
    const audience = ctx.offer?.audience;
    if (!audience) return withGap(id,
      'No offer formula audience defined yet.',
      'Who is the primary customer for ' + ctx.company.name + '?', 'critical');
    return single(id, option(audience, 0.55, ['offer_formula'],
      'Hypothesis from manual offer — audience field. Run offer synthesis for higher signal.',
      ctx));
  },

  from_avatars_demographics: (id, ctx) => {
    const withDemo = ctx.avatars.filter(a => a.demographics?.age || a.demographics?.location);
    if (!withDemo.length) return withGap(id,
      'Avatar demographics not yet populated.',
      'What age range and location defines your primary segment?', 'high');
    const options = withDemo.map(a =>
      option(
        [a.demographics?.age, a.demographics?.location].filter(Boolean).join(', '),
        0.58, ['avatars'],
        `Hypothesis from avatar "${a.name}" demographics.`,
        ctx
      )
    );
    return multi(id, options);
  },

  from_market_intel_core_problem: (id, ctx) => {
    if (!ctx.marketIntel?.coreProblem) return withGap(id,
      'Market intelligence not yet synthesised.',
      'Run market intelligence synthesis first (Stage 2).', 'critical');
    return single(id, option(ctx.marketIntel.coreProblem, 0.78, ['market_intel'],
      'Hypothesis from synthesised market intelligence — core problem field.',
      ctx));
  },

  from_market_intel_awareness: (id, ctx) => {
    const level = ctx.marketIntel?.problemAwarenessLevel;
    if (!level) return withGap(id,
      'Problem awareness level not derived yet.',
      'Run market intelligence synthesis to derive awareness level.', 'high');
    return single(id, option(level, 0.70, ['market_intel'],
      'Hypothesis from market intelligence awareness analysis.', ctx));
  },

  from_avatars_motivation: (id, ctx) => {
    const withSynthesis = ctx.avatars.filter(a => a.synthesis?.realPrimaryMotivation);
    if (!withSynthesis.length) return withGap(id,
      'Avatars not yet deep-dived.',
      'Run avatar deep dive to extract primary motivations.', 'critical');
    const options = withSynthesis.map(a => {
      const m = a.synthesis!.realPrimaryMotivation;
      const text = typeof m === 'object' && m !== null && 'claim' in m
        ? (m as { claim: string }).claim : String(m ?? '');
      return option(text, 0.70, ['avatars'],
        `Hypothesis from avatar "${a.name}" — primary motivation from synthesis.`, ctx);
    });
    return multi(id, options);
  },

  from_avatars_sources: (id, ctx) => {
    const allSources = ctx.avatars.flatMap(a => [
      ...(a.sources?.brands ?? []), ...(a.sources?.podcasts ?? []),
      ...(a.sources?.influencers ?? []),
    ]).filter(Boolean);
    if (!allSources.length) return withGap(id,
      'Avatar sources not yet populated.',
      'What platforms, communities, or media does your market use?', 'medium');
    const unique = [...new Set(allSources)].slice(0, 8);
    return single(id, option(unique.join(', '), 0.58, ['avatars'],
      `Hypothesis from avatar sources across ${ctx.avatars.length} segment(s).`, ctx));
  },

  from_messages_buyer_signal: (id, ctx) => {
    const team = ctx.messages.filter(m =>
      /\b(my boss|for my team|our company|we need|manager asked)\b/i.test(m.rawText)
    ).length;
    const personal = ctx.messages.filter(m =>
      /\b(I want|I need|for myself|my dog|my child|personally)\b/i.test(m.rawText)
    ).length;
    if (team + personal < 3) return withGap(id,
      'Insufficient messages to detect buyer vs user pattern.',
      'Are the people paying for your product the same ones using it?', 'medium');
    const isDelegated = team > personal;
    return single(id, option(
      isDelegated ? 'Different people (buyer ≠ user)' : 'Same person',
      Math.min(0.72, (team + personal) / 15),
      ['messages'],
      `Weak signal only: ${team} team/delegation mentions vs ${personal} personal mentions. Requires validation.`,
      ctx));
  },

  from_corpus_aspect_distribution: (id, ctx) => {
    const analyzed = ctx.messages.filter(m => m.analyzed && m.analysis);
    if (analyzed.length < 5) return withGap(id,
      'Not enough analyzed messages (need ≥5).',
      'Add more customer messages to corpus.', 'medium');
    const freq: Record<string, number> = {};
    for (const m of analyzed) {
      const a = m.analysis!.conversionFormulaAspect;
      freq[a] = (freq[a] ?? 0) + 1;
    }
    const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    const PERSONALITY_SIGNAL: Record<string, string> = {
      Anxiety:    'Trustworthy, Reassuring, Safety-focused',
      Motivation: 'Inspiring, Aspirational, Achievement-oriented',
      Value:      'Premium, Results-driven, Benefit-clear',
      Friction:   'Simplifying, Efficiency-focused',
      Trust:      'Authoritative, Credible, Expert',
      Urgency:    'Direct, Action-driven',
      Incentive:  'Rewarding, Generous',
    };
    const frictionRatio = (freq['Friction'] ?? 0) / analyzed.length;
    const complexitySignal = frictionRatio > 0.3 ? 'Complex' : frictionRatio > 0.15 ? 'Moderate' : 'Simple';
    const value = id === 'product_complexity' ? complexitySignal
      : (PERSONALITY_SIGNAL[dominant] ?? 'Authentic, Clear');
    return single(id, option(value, 0.42, ['messages'],
      `Weak heuristic — dominant corpus aspect is ${dominant} ` +
      `(${Math.round((freq[dominant] ?? 0) / analyzed.length * 100)}% of messages). ` +
      `Treat as initial hypothesis only.`, ctx));
  },

  from_offer_transformation: (id, ctx) => {
    const t = ctx.offer?.transformation;
    if (!t) return withGap(id,
      'No transformation defined in offer formula.',
      'What does life look like for customers after using your product?', 'high');
    return single(id, option(t, 0.55, ['offer_formula'],
      'Hypothesis from offer formula — transformation field.', ctx));
  },

  from_offer_product: (id, ctx) => {
    const product = ctx.offer?.product ?? ctx.company.name;
    return single(id, option(product, 0.55,
      ['offer_formula', 'company_profile'],
      'Hypothesis from offer formula — product field.', ctx));
  },

  from_offer_specificity: (id, ctx) => {
    const s = (ctx.offer as any)?.specificity;
    if (!s) return notInferable(id);
    return single(id, option(s, 0.68, ['offer_formula'],
      'Hypothesis from offer specificity field.', ctx));
  },

  from_avatars_transformation_hook: (id, ctx) => {
    const hooks = ctx.avatars.filter(a => a.transformation?.hook).map(a => a.transformation!.hook);
    if (!hooks.length) return withGap(id,
      'Avatar transformations not yet populated.',
      'How quickly does a customer get their first meaningful result?', 'medium');
    return single(id, option(hooks[0], 0.52, ['avatars'],
      'Hypothesis from avatar transformation hook.', ctx));
  },

  from_avatars_price_perception: (id, ctx) => {
    const perceptions = ctx.avatars
      .filter(a => a.marketIntelligence?.pricePerception)
      .map(a => option(
        a.marketIntelligence!.pricePerception,
        0.58, ['avatars'],
        `Hypothesis from avatar "${a.name}" price perception.`, ctx
      ));
    if (!perceptions.length) return withGap(id,
      'Avatar price perception not yet populated.',
      'What do customers say about your current or expected pricing?', 'high');
    return multi(id, perceptions);
  },

  from_avatars_risk: (id, ctx) => {
    const risks = ctx.avatars
      .filter(a => a.questionnaire?.risk)
      .map(a => a.questionnaire!.risk);
    if (!risks.length) return withGap(id,
      'Avatar risk questionnaire not populated.',
      'What risk or commitment concerns stop customers from buying?', 'low');
    return single(id, option(risks[0], 0.50, ['avatars'],
      'Hypothesis from avatar questionnaire — risk field.', ctx));
  },

  from_corpus_trust_messages: (id, ctx) => {
    const trustMsgs = ctx.messages
      .filter(m => m.analysis?.conversionFormulaAspect === 'Trust' && m.analyzed)
      .sort((a, b) => (b.analysis?.qualityScore ?? 0) - (a.analysis?.qualityScore ?? 0))
      .slice(0, 3);
    if (!trustMsgs.length) return withGap(id,
      'No Trust-aspect messages in corpus yet.',
      'What do customers say about trust, proof, or credibility?', 'medium');
    return single(id, option(
      trustMsgs.map(m => m.rawText.slice(0, 80)).join('; '),
      0.48, ['messages'],
      `Hypothesis from ${trustMsgs.length} Trust-aspect message(s).`,
      ctx, trustMsgs.map(m => m.id)));
  },

  from_avatars_values_traits: (id, ctx) => {
    const values = ctx.avatars.filter(a => a.traits?.values).map(a => a.traits!.values);
    if (!values.length) return withGap(id,
      'Avatar values/traits not yet populated.',
      'What does your market deeply believe in or care about?', 'medium');
    return single(id, option(values.join('; '), 0.55, ['avatars'],
      `Hypothesis from avatar traits across ${values.length} avatar(s).`, ctx));
  },

  from_avatars_emotional_pattern: (id, ctx) => {
    const beforeProblems = ctx.avatars
      .filter(a => a.transformation?.beforeProblem)
      .map(a => a.transformation!.beforeProblem);
    const hooks = ctx.avatars
      .filter(a => a.transformation?.hook)
      .map(a => a.transformation!.hook);
    if (!beforeProblems.length && !hooks.length) return withGap(id,
      'Avatar transformation not yet populated.',
      'What is the emotional journey your brand takes customers through?', 'medium');
    const story = [
      beforeProblems[0] && `Before: "${beforeProblems[0]}"`,
      hooks[0] && `Hook: "${hooks[0]}"`,
    ].filter(Boolean).join(' → ');
    return single(id, option(story, 0.58, ['avatars'],
      'Hypothesis from avatar transformation before/after and hook.', ctx));
  },

  not_inferable: (id) => notInferable(id),
};
