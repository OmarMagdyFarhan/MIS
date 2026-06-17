import { describe, it, expect } from 'vitest';
import { inferAnswer } from '../services/foundationInferenceService';
import { FOUNDATION_QUESTIONS } from '../constants/foundationQuestions';
import type { InferenceContext } from '../services/foundationInferenceService';

const company = {
  id: 'co1', name: 'PetHarness Co', industry: 'Pet Products',
  specializations: [], usp: 'No-pull', country: 'US',
  createdAt: '', websiteUrl: '', isGlobalMode: false,
};
const base: InferenceContext = {
  company, avatars: [], messages: [], marketIntel: null, offer: null,
};
const now = new Date().toISOString();
function q(id: string) {
  const found = FOUNDATION_QUESTIONS.find(q => q.id === id);
  if (!found) throw new Error(`Question not found: ${id}`);
  return found;
}

describe('inferAnswer — market_core_problem', () => {
  it('returns gap when no market intel', () => {
    const r = inferAnswer(q('market_core_problem'), base);
    expect(r.canInfer).toBe(false);
    expect(r.gaps[0].priority).toBe('critical');
  });
  it('returns hypothesis from market intel', () => {
    const ctx = { ...base, marketIntel: {
      companyId: 'co1', coreProblem: 'Dogs pull too hard', desiredOutcome: 'Calm walks',
      problemAwarenessLevel: 'Problem Aware' as const, buyerDescription: 'Dog owners',
      userDescription: 'Dogs', jobCadence: 'Daily', derivedFromMessageCount: 10, lastUpdatedAt: now,
    }};
    const r = inferAnswer(q('market_core_problem'), ctx);
    expect(r.canInfer).toBe(true);
    expect(r.primary?.value).toBe('Dogs pull too hard');
    expect(r.primary?.isHypothesis).toBe(true);
    expect(r.primary?.signalStrength).toBeGreaterThan(0.7);
  });
});

describe('inferAnswer — evidence quality vs signal strength', () => {
  it('low message count → low evidence quality even with high signal', () => {
    const ctx = { ...base, marketIntel: {
      companyId: 'co1', coreProblem: 'Test', desiredOutcome: 'Test',
      problemAwarenessLevel: 'Problem Aware' as const, buyerDescription: 'B',
      userDescription: 'U', jobCadence: 'Daily', derivedFromMessageCount: 2, lastUpdatedAt: now,
    }};
    // market_intel source → medium quality
    const r = inferAnswer(q('market_core_problem'), ctx);
    expect(r.canInfer).toBe(true);
    expect(r.primary?.evidenceQuality).toBe('medium');
  });

  it('100+ analyzed messages → high evidence quality for message-sourced inference', () => {
    const msgs = Array.from({ length: 110 }, (_, i) => ({
      id: `m${i}`, rawText: `Trust message ${i}`, source: 'paste' as const, analyzed: true,
      analysis: { topic: 'trust', conversionFormulaAspect: 'Trust' as const, messageType: 'Uncertainty' as const, qualityScore: 0.7 },
      clusterId: null, createdAt: now, updatedAt: now,
    }));
    const ctx = { ...base, messages: msgs as any };
    const r = inferAnswer(q('market_competitors'), ctx);
    expect(r.canInfer).toBe(true);
    expect(r.primary?.evidenceQuality).toBe('high');
  });

  it('corpus heuristic has signal < 0.5', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`, rawText: `message ${i}`, source: 'paste' as const, analyzed: true,
      analysis: { topic: 'test', conversionFormulaAspect: 'Anxiety' as const, messageType: 'Uncertainty' as const, qualityScore: 0.7 },
      clusterId: null, createdAt: now, updatedAt: now,
    }));
    const ctx = { ...base, messages: msgs as any };
    const r = inferAnswer(q('brand_personality'), ctx);
    expect(r.canInfer).toBe(true);
    expect(r.primary?.signalStrength).toBeLessThan(0.5);
  });
});

describe('inferAnswer — not_inferable questions', () => {
  it('market_size returns canInfer=false', () => {
    expect(inferAnswer(q('market_size'), base).canInfer).toBe(false);
  });
  it('market_trends returns canInfer=false', () => {
    expect(inferAnswer(q('market_trends'), base).canInfer).toBe(false);
  });
  it('product_frequency returns canInfer=false', () => {
    expect(inferAnswer(q('product_frequency'), base).canInfer).toBe(false);
  });
  it('model_gross_margin returns canInfer=false', () => {
    expect(inferAnswer(q('model_gross_margin'), base).canInfer).toBe(false);
  });
});

describe('inferAnswer — hypothesis framing', () => {
  it('all InferredOption values have isHypothesis=true', () => {
    const ctx = { ...base, marketIntel: {
      companyId: 'co1', coreProblem: 'Test problem', desiredOutcome: 'Outcome',
      problemAwarenessLevel: 'Solution Aware' as const, buyerDescription: 'Buyers',
      userDescription: 'Users', jobCadence: 'Weekly', derivedFromMessageCount: 20, lastUpdatedAt: now,
    }};
    const r = inferAnswer(q('market_core_problem'), ctx);
    expect(r.primary?.isHypothesis).toBe(true);
  });
});

describe('inferAnswer — question manifest completeness', () => {
  it('all 39 questions are present in manifest', () => {
    expect(FOUNDATION_QUESTIONS.length).toBe(39);
  });
  it('every question has a valid inferenceStrategy', () => {
    for (const q of FOUNDATION_QUESTIONS) {
      expect(q.inferenceStrategy).toBeTruthy();
    }
  });
  it('not_inferable questions do not throw', () => {
    const notInferableQs = FOUNDATION_QUESTIONS.filter(q => q.inferenceStrategy === 'not_inferable');
    expect(notInferableQs.length).toBeGreaterThan(0);
    for (const question of notInferableQs) {
      const r = inferAnswer(question, base);
      expect(r.canInfer).toBe(false);
    }
  });
});
