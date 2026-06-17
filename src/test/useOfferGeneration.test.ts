import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/aiService', () => ({
  generateAIContent: vi.fn(),
}));

vi.mock('../services/offerService', () => ({
  consolidateOffer: vi.fn(),
  computeOfferScore: vi.fn(),
}));

vi.mock('../services/historyService', () => ({
  addToEditHistory: vi.fn(),
  buildFewShotContext: vi.fn(() => ''),
}));

vi.mock('../services/intelligenceService', () => ({
  generateScoreDelta: vi.fn(),
  rankAvatarsForDisplay: vi.fn(),
}));

vi.mock('../stores/pipelineStore', () => ({
  usePipelineStore: {
    getState: vi.fn(() => ({    })),
  },
}));

vi.mock('../lib/pipelineMigration', () => ({
  syncProgressWithPipeline: vi.fn((p: any) => p),
}));

vi.mock('../lib/offerAdapters', () => ({
  legacyOfferToCoreRecord: vi.fn(),
  coreRecordToLegacyOffer: vi.fn(),
}));

const mockSetOffers = vi.fn();
const mockSetProgress = vi.fn();
const mockSetTransientResultOffer = vi.fn();
const mockSetIsGenerating = vi.fn();
const mockSetGenerationError = vi.fn();
const mockSetCompanies = vi.fn();
const mockSetActiveCompanyId = vi.fn();
const mockCloseConflictModal = vi.fn();
const mockDismissSuccess = vi.fn();
const mockLoadStageInsights = vi.fn();

vi.mock('../stores/offerStore', () => ({
  useOfferActions: vi.fn(() => ({
    setOffers: mockSetOffers,
    setProgress: mockSetProgress,
    setTransientResultOffer: mockSetTransientResultOffer,
    setIsGenerating: mockSetIsGenerating,
    setGenerationError: mockSetGenerationError,
    removeCompanyData: vi.fn(),
  })),
}));

vi.mock('../stores/companyStore', () => ({
  useCompanyActions: vi.fn(() => ({
    setCompanies: mockSetCompanies,
    setActiveCompanyId: mockSetActiveCompanyId,
    markNeedsOfferUpdate: vi.fn(),
    clearNeedsOfferUpdate: vi.fn(),
  })),
  useCompanyStore: { getState: vi.fn(() => ({ companies: [], setCompanies: mockSetCompanies, setActiveCompanyId: mockSetActiveCompanyId })) },
}));

vi.mock('../stores/uiStore', () => ({
  useConflictModal: vi.fn(() => ({ close: mockCloseConflictModal })),
  useToasts: vi.fn(() => ({ dismissSuccess: mockDismissSuccess })),
  useToastActions: vi.fn(() => ({ showSuccess: vi.fn(), showError: vi.fn() })),
}));

vi.mock('../stores/insightsStore', () => ({
  useInsightsActions: vi.fn(() => ({ loadStageInsights: mockLoadStageInsights })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useOfferGeneration hook contract', () => {
  it('returns the expected function names', async () => {
    const { useOfferGeneration } = await import('../hooks/useOfferGeneration');
    const result = useOfferGeneration({
      activeCompanyId: null,
      companies: [],
      offers: {},
      progress: {},
      draftOffer: {},
      handleStartSynthesis: vi.fn(),
      showErrorToastMsg: vi.fn(),
      showSuccessToastMsg: vi.fn(),
      openConflictModal: vi.fn(),
    });
    expect(typeof result.handleGenerateOffer).toBe('function');
    expect(typeof result.handleConsolidateOffer).toBe('function');
    expect(typeof result.handleDuplicateProjectFromOffer).toBe('function');
    expect(typeof result.checkOfferChanges).toBe('function');
  });

  it('checkOfferChanges returns false when no existing offer', async () => {
    const { useOfferGeneration } = await import('../hooks/useOfferGeneration');
    const result = useOfferGeneration({
      activeCompanyId: 'c1',
      companies: [],
      offers: {},
      progress: {},
      draftOffer: { product: 'Widget' },
      handleStartSynthesis: vi.fn(),
      showErrorToastMsg: vi.fn(),
      showSuccessToastMsg: vi.fn(),
      openConflictModal: vi.fn(),
    });
    expect(result.checkOfferChanges()).toBe(false);
  });

  it('checkOfferChanges returns true when offer differs', async () => {
    const { useOfferGeneration } = await import('../hooks/useOfferGeneration');
    const existing = {
      companyId: 'c1', product: 'OldWidget', relevance: 'r', reason: 'r2',
      audience: 'a', transformation: 't', generatedOffer: 'old', generatedAt: '',
    };
    const result = useOfferGeneration({
      activeCompanyId: 'c1',
      companies: [],
      offers: { c1: existing },
      progress: {},
      draftOffer: { product: 'NewWidget' },
      handleStartSynthesis: vi.fn(),
      showErrorToastMsg: vi.fn(),
      showSuccessToastMsg: vi.fn(),
      openConflictModal: vi.fn(),
    });
    expect(result.checkOfferChanges()).toBe(true);
  });

  it('handleGenerateOffer calls showErrorToastMsg on RATE_LIMIT error', async () => {
    const { generateAIContent } = await import('../services/aiService');
    const rateLimitErr = Object.assign(new Error('rate limit'), { code: 'RATE_LIMIT' });
    (generateAIContent as any).mockRejectedValue(rateLimitErr);

    const showErrorToastMsg = vi.fn();
    const { useOfferGeneration } = await import('../hooks/useOfferGeneration');
    const company = {
      id: 'c1', name: 'Acme', industry: 'SaaS', specializations: [],
      usp: 'fast', country: 'Global', websiteUrl: '', isGlobalMode: true, createdAt: '',
    };
    const result = useOfferGeneration({
      activeCompanyId: 'c1',
      companies: [company],
      offers: {},
      progress: {},
      draftOffer: { product: 'Widget', relevance: 'r', reason: 'r2', audience: 'a', transformation: 't' },
      handleStartSynthesis: vi.fn(),
      showErrorToastMsg,
      showSuccessToastMsg: vi.fn(),
      openConflictModal: vi.fn(),
    });
    await result.handleGenerateOffer();
    expect(showErrorToastMsg).toHaveBeenCalledWith(expect.stringContaining('quota'));
  });

  it('handleGenerateOffer calls openConflictModal when offer exists and changed', async () => {
    const { useOfferGeneration } = await import('../hooks/useOfferGeneration');
    const openConflictModal = vi.fn();
    const existing = {
      companyId: 'c1', product: 'OldWidget', relevance: 'r', reason: 'r2',
      audience: 'a', transformation: 't', generatedOffer: 'old', generatedAt: '',
    };
    const company = {
      id: 'c1', name: 'Acme', industry: 'SaaS', specializations: [],
      usp: 'fast', country: 'Global', websiteUrl: '', isGlobalMode: true, createdAt: '',
    };
    const result = useOfferGeneration({
      activeCompanyId: 'c1',
      companies: [company],
      offers: { c1: existing },
      progress: {},
      draftOffer: { product: 'NewWidget', relevance: 'r', reason: 'r2', audience: 'a', transformation: 't' },
      handleStartSynthesis: vi.fn(),
      showErrorToastMsg: vi.fn(),
      showSuccessToastMsg: vi.fn(),
      openConflictModal,
    });
    await result.handleGenerateOffer(false);
    expect(openConflictModal).toHaveBeenCalledWith('offer');
  });
});
