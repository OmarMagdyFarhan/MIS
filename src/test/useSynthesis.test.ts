import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/synthesisService', () => ({
  generateStage1Synthesis: vi.fn(),
  generateStage2Synthesis: vi.fn(),
  generateStage3Synthesis: vi.fn(),
}));

vi.mock('../features/corpus/store', () => ({
  useCorpusStore: { getState: vi.fn(() => ({ corpora: {} })) },
}));

vi.mock('../stores/pipelineStore', () => ({
  usePipelineStore: {
    getState: vi.fn(() => ({      getAvatarOffersForCompany: vi.fn(() => []),      marketIntelligence: {},
    })),
  },
}));

const mockBeginRequest = vi.fn();
const mockSetIsSynthesizing = vi.fn();
const mockSetSynthesisReport = vi.fn();
const mockSetProgress = vi.fn();
const mockSetCurrentView = vi.fn();
const mockSetStageStep = vi.fn();
const mockDismissSuccess = vi.fn();
const mockShowSuccess = vi.fn();

vi.mock('../stores/synthesisStore', () => ({
  useSynthesisReport: vi.fn(() => null),
  useSynthesisStage: vi.fn(() => ''),
  useSynthesisActions: vi.fn(() => ({
    beginRequest: mockBeginRequest,
    setIsSynthesizing: mockSetIsSynthesizing,
    setSynthesisReport: mockSetSynthesisReport,
  })),
}));

vi.mock('../stores/offerStore', () => ({
  useOfferActions: vi.fn(() => ({
    setProgress: mockSetProgress,
    setOffers: vi.fn(),
    setDraftOffer: vi.fn(),
    setTransientResultOffer: vi.fn(),
    setIsGenerating: vi.fn(),
    setGenerationError: vi.fn(),
    removeCompanyData: vi.fn(),
  })),
}));

vi.mock('../stores/workflowStore', () => ({
  useWorkflowActions: vi.fn(() => ({
    setCurrentView: mockSetCurrentView,
    setStageStep: mockSetStageStep,
    setAvatarMethod: vi.fn(),
  })),
}));

vi.mock('../stores/uiStore', () => ({
  useToasts: vi.fn(() => ({ dismissSuccess: mockDismissSuccess })),
  useToastActions: vi.fn(() => ({
    showSuccess: mockShowSuccess,
    showError: vi.fn(),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockBeginRequest.mockReturnValue({
    signal: new AbortController().signal,
    timestamp: Date.now(),
    isLatest: () => true,
  });
});

describe('useSynthesis hook contract', () => {
  it('returns handleStartSynthesis and handleProceedAfterSynthesis', async () => {
    const { useSynthesis } = await import('../hooks/useSynthesis');
    const result = useSynthesis({
      activeCompanyId: null,
      companies: [],
      progress: {},
      draftCompany: null,
      showErrorToastMsg: vi.fn(),
    });
    expect(typeof result.handleStartSynthesis).toBe('function');
    expect(typeof result.handleProceedAfterSynthesis).toBe('function');
  });

  it('handleStartSynthesis calls generateStage1Synthesis for Identity stage', async () => {
    const { generateStage1Synthesis } = await import('../services/synthesisService');
    const mockReport = { strengths: [], weaknesses: [], recommendations: [], stage: 'Identity' };
    (generateStage1Synthesis as any).mockResolvedValue(mockReport);

    const { useSynthesis } = await import('../hooks/useSynthesis');
    const mockCompany = {
      id: 'c1', name: 'Acme', industry: 'SaaS', specializations: [],
      usp: 'fast', country: 'Global', websiteUrl: '', isGlobalMode: true, createdAt: '',
    };

    const result = useSynthesis({
      activeCompanyId: 'c1',
      companies: [mockCompany],
      progress: {},
      draftCompany: mockCompany,
      showErrorToastMsg: vi.fn(),
    });

    await result.handleStartSynthesis('Identity', mockCompany);
    expect(generateStage1Synthesis).toHaveBeenCalledWith(mockCompany, expect.any(AbortSignal));
    expect(mockSetSynthesisReport).toHaveBeenCalledWith(mockReport);
  });

  it('handleStartSynthesis calls showErrorToastMsg on non-abort error', async () => {
    const { generateStage1Synthesis } = await import('../services/synthesisService');
    (generateStage1Synthesis as any).mockRejectedValue(new Error('network error'));

    const showErrorToastMsg = vi.fn();
    const { useSynthesis } = await import('../hooks/useSynthesis');
    const mockCompany = {
      id: 'c1', name: 'Acme', industry: 'SaaS', specializations: [],
      usp: 'fast', country: 'Global', websiteUrl: '', isGlobalMode: true, createdAt: '',
    };

    const result = useSynthesis({
      activeCompanyId: 'c1',
      companies: [mockCompany],
      progress: {},
      draftCompany: mockCompany,
      showErrorToastMsg,
    });

    await result.handleStartSynthesis('Identity', mockCompany);
    expect(showErrorToastMsg).toHaveBeenCalled();
  });

  it('handleStartSynthesis shows error when no company found', async () => {
    const showErrorToastMsg = vi.fn();
    const { useSynthesis } = await import('../hooks/useSynthesis');

    const result = useSynthesis({
      activeCompanyId: null,
      companies: [],
      progress: {},
      draftCompany: null,
      showErrorToastMsg,
    });

    await result.handleStartSynthesis('Identity');
    expect(showErrorToastMsg).toHaveBeenCalled();
  });

  it('handleProceedAfterSynthesis is a callable function', async () => {
    const { useSynthesis } = await import('../hooks/useSynthesis');
    const result = useSynthesis({
      activeCompanyId: 'c1',
      companies: [],
      progress: {},
      draftCompany: null,
      showErrorToastMsg: vi.fn(),
    });
    expect(() => result.handleProceedAfterSynthesis()).not.toThrow();
    expect(mockSetIsSynthesizing).toHaveBeenCalledWith(false);
  });
});
