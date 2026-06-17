import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInsightsStore } from '../stores/insightsStore';
import type { ActionableInsight, Company } from '../types';

vi.mock('../services/insightService', async () => ({
  ...(await vi.importActual('../services/insightService') as any),
  generateStageInsights: vi.fn(),
}));

describe('insightsStore', () => {
  beforeEach(() => {
    useInsightsStore.setState({ stageInsights: {}, isInsightsLoading: false });
  });

  it('initialises with empty state', () => {
    const s = useInsightsStore.getState();
    expect(s.stageInsights).toEqual({});
    expect(s.isInsightsLoading).toBe(false);
  });

  it('setStageInsights updates state', () => {
    const insight: ActionableInsight = {
      type: 'action',
      title: 'Test',
      observation: 'obs',
      action: 'Test action',
      why: 'because',
      urgency: 'anytime',
    };
    useInsightsStore.getState().setStageInsights({ 'c1-company': [insight] });
    expect(useInsightsStore.getState().stageInsights['c1-company']).toEqual([insight]);
  });

  it('setStageInsights accepts updater function', () => {
    const insight: ActionableInsight = {
      type: 'action',
      title: 'A',
      observation: 'obs',
      action: 'Action A',
      why: 'why',
      urgency: 'anytime',
    };
    useInsightsStore.getState().setStageInsights({ 'c1-company': [insight] });
    const insight2: ActionableInsight = {
      type: 'opportunity',
      title: 'B',
      observation: 'obs',
      action: 'Action B',
      why: 'why',
      urgency: 'before_next_stage',
    };
    useInsightsStore.getState().setStageInsights((prev) => ({
      ...prev,
      'c1-offer': [insight2],
    }));
    const state = useInsightsStore.getState().stageInsights;
    expect(state['c1-company']).toEqual([insight]);
    expect(state['c1-offer']).toEqual([insight2]);
  });

  it('setIsInsightsLoading toggles flag', () => {
    useInsightsStore.getState().setIsInsightsLoading(true);
    expect(useInsightsStore.getState().isInsightsLoading).toBe(true);
    useInsightsStore.getState().setIsInsightsLoading(false);
    expect(useInsightsStore.getState().isInsightsLoading).toBe(false);
  });

  it('loadStageInsights fetches and stores insights', async () => {
    const { generateStageInsights } = await import('../services/insightService');
    const mockInsight: ActionableInsight = {
      type: 'action',
      title: 'Do something',
      observation: 'obs',
      action: 'Do something',
      why: 'because',
      urgency: 'anytime',
    };
    vi.mocked(generateStageInsights).mockResolvedValue([mockInsight]);

    const company: Company = {
      id: 'c1',
      name: 'TestCo',
      industry: 'Tech',
      specializations: [],
      usp: '',
      country: 'Global',
      websiteUrl: '',
      isGlobalMode: true,
      createdAt: new Date().toISOString(),
    };

    await useInsightsStore.getState().loadStageInsights('company', {}, company);

    const state = useInsightsStore.getState();
    expect(state.isInsightsLoading).toBe(false);
    expect(state.stageInsights['c1-company']).toEqual([mockInsight]);
  });

  it('loadStageInsights handles errors gracefully', async () => {
    const { generateStageInsights } = await import('../services/insightService');
    vi.mocked(generateStageInsights).mockRejectedValue(new Error('boom'));

    const company: Company = {
      id: 'c1',
      name: 'TestCo',
      industry: 'Tech',
      specializations: [],
      usp: '',
      country: 'Global',
      websiteUrl: '',
      isGlobalMode: true,
      createdAt: new Date().toISOString(),
    };

    await useInsightsStore.getState().loadStageInsights('company', {}, company);

    const state = useInsightsStore.getState();
    expect(state.isInsightsLoading).toBe(false);
    expect(state.stageInsights['c1-company']).toBeUndefined();
  });

  it('clearInsights resets everything', () => {
    useInsightsStore.setState({
      stageInsights: { 'c1-company': [] as ActionableInsight[] },
      isInsightsLoading: true,
    });
    useInsightsStore.getState().clearInsights();
    const state = useInsightsStore.getState();
    expect(state.stageInsights).toEqual({});
    expect(state.isInsightsLoading).toBe(false);
  });
});
