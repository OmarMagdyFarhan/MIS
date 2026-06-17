import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stable spy instances so assertions across dynamic imports see the same spy
const mockSetMarketIntelligence = vi.fn();
const mockMarkLayerStale = vi.fn();

vi.mock('../stores/pipelineStore', () => ({
  usePipelineStore: {
    getState: vi.fn(() => ({
      marketIntelligence: {
        co1: {
          companyId: 'co1', coreProblem: 'Old problem', desiredOutcome: 'Outcome',
          problemAwarenessLevel: 'Problem Unaware' as const, buyerDescription: 'Buyers',
          userDescription: 'Users', jobCadence: 'Daily', derivedFromMessageCount: 5, lastUpdatedAt: '',
        },
      },
      setMarketIntelligence: mockSetMarketIntelligence,
      markLayerStale: mockMarkLayerStale,
    })),
  },
}));

import { applyFoundationAnswer } from '../services/foundationFeedbackService';
import type { FoundationAnswer } from '../types/foundation';

function makeAnswer(questionId: string, chosenValue: string): FoundationAnswer {
  return {
    questionId, foundationId: 'market', status: 'validated',
    overallSignalStrength: 0.8, overallEvidenceQuality: 'medium',
    feedbackApplied: false, chosenValue,
  };
}

describe('applyFoundationAnswer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates market intel when market_awareness is validated', () => {
    const result = applyFoundationAnswer('co1', makeAnswer('market_awareness', 'Problem Aware'));
    expect(result.applied).toBe(true);
    expect(result.pipelineUpdates.length).toBeGreaterThan(0);
    expect(mockSetMarketIntelligence).toHaveBeenCalled();
  });

  it('updates core problem in market intel', () => {
    const result = applyFoundationAnswer('co1', makeAnswer('market_core_problem', 'New problem'));
    expect(result.applied).toBe(true);
    expect(mockSetMarketIntelligence).toHaveBeenCalledWith(
      'co1', expect.objectContaining({ coreProblem: 'New problem' })
    );
  });

  it('marks core offer stale when model question is validated', () => {
    applyFoundationAnswer('co1', makeAnswer('model_price_points', '$99/mo'));
  });

  it('marks core offer stale when product_differentiator is validated', () => {
    applyFoundationAnswer('co1', makeAnswer('product_differentiator', 'Softest lining'));
  });

  it('returns empty updates for non-writeback questions', () => {
    const result = applyFoundationAnswer('co1', makeAnswer('operations_team_size', '5 people'));
    expect(result.pipelineUpdates).toHaveLength(0);
  });
});
