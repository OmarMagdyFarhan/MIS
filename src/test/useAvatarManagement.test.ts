import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/historyService', () => ({
  updateIndustryIntelligence: vi.fn(),
  addToEditHistory: vi.fn(),
}));

vi.mock('../services/intelligenceService', () => ({
  rankAvatarsForDisplay: vi.fn(),
  generateScoreDelta: vi.fn(),
}));

vi.mock('../lib/pipelineMigration', () => ({
  syncProgressWithPipeline: vi.fn((p: any) => p),
}));

const mockSetProgress = vi.fn();
const mockSetIsGenerating = vi.fn();

vi.mock('../stores/offerStore', () => ({
  useOfferActions: vi.fn(() => ({
    setProgress: mockSetProgress,
    setIsGenerating: mockSetIsGenerating,
    setOffers: vi.fn(),
    setDraftOffer: vi.fn(),
    setTransientResultOffer: vi.fn(),
    setGenerationError: vi.fn(),
    removeCompanyData: vi.fn(),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAvatarManagement hook contract', () => {
  it('returns the expected function names', async () => {
    const { useAvatarManagement } = await import('../hooks/useAvatarManagement');
    const result = useAvatarManagement({
      activeCompanyId: null,
      companies: [],
      offers: {},
      handleStartSynthesis: vi.fn(),
      showErrorToastMsg: vi.fn(),
    });
    expect(typeof result.handleUpdateAvatar).toBe('function');
    expect(typeof result.handleUpdateAvatarsFromPipeline).toBe('function');
    expect(typeof result.handleDeleteAvatar).toBe('function');
    expect(typeof result.handleCompleteAvatars).toBe('function');
  });

  it('handleCompleteAvatars calls handleStartSynthesis with Modeling stage', async () => {
    const { rankAvatarsForDisplay } = await import('../services/intelligenceService');
    const mockAvatar = {
      id: 'av1', name: 'Bob', companyId: 'c1', description: 'd',
      definingCharacteristic: 'dc', visualDescriptor: 'vd',
      category: 'Goals and Challenges' as const, canHaveSubAvatars: false,
    };
    (rankAvatarsForDisplay as any).mockResolvedValue([mockAvatar]);

    const handleStartSynthesis = vi.fn().mockResolvedValue(undefined);
    const { useAvatarManagement } = await import('../hooks/useAvatarManagement');
    const company = {
      id: 'c1', name: 'Acme', industry: 'SaaS', specializations: [],
      usp: 'fast', country: 'Global', websiteUrl: '', isGlobalMode: true, createdAt: '',
    };
    const result = useAvatarManagement({
      activeCompanyId: 'c1',
      companies: [company],
      offers: {},
      handleStartSynthesis,
      showErrorToastMsg: vi.fn(),
    });

    await result.handleCompleteAvatars([mockAvatar]);
    expect(handleStartSynthesis).toHaveBeenCalledWith('Modeling', company, undefined, [mockAvatar]);
  });

  it('handleCompleteAvatars falls back if ranking throws', async () => {
    const { rankAvatarsForDisplay } = await import('../services/intelligenceService');
    (rankAvatarsForDisplay as any).mockRejectedValue(new Error('rank failed'));

    const handleStartSynthesis = vi.fn().mockResolvedValue(undefined);
    const { useAvatarManagement } = await import('../hooks/useAvatarManagement');
    const company = {
      id: 'c1', name: 'Acme', industry: 'SaaS', specializations: [],
      usp: 'fast', country: 'Global', websiteUrl: '', isGlobalMode: true, createdAt: '',
    };
    const mockAvatar = {
      id: 'av1', name: 'Bob', companyId: 'c1', description: 'd',
      definingCharacteristic: 'dc', visualDescriptor: 'vd',
      category: 'Goals and Challenges' as const, canHaveSubAvatars: false,
    };
    const result = useAvatarManagement({
      activeCompanyId: 'c1',
      companies: [company],
      offers: {},
      handleStartSynthesis,
      showErrorToastMsg: vi.fn(),
    });

    await expect(result.handleCompleteAvatars([mockAvatar])).resolves.toBeUndefined();
    expect(handleStartSynthesis).toHaveBeenCalled();
  });

  it('handleDeleteAvatar removes avatar from progress', async () => {
    const { useAvatarManagement } = await import('../hooks/useAvatarManagement');
    const mockAvatar = {
      id: 'av1', name: 'Bob', companyId: 'c1', description: 'd',
      definingCharacteristic: 'dc', visualDescriptor: 'vd',
      category: 'Goals and Challenges' as const, canHaveSubAvatars: false,
    };
    const result = useAvatarManagement({
      activeCompanyId: 'c1',
      companies: [],
      offers: {},
      handleStartSynthesis: vi.fn(),
      showErrorToastMsg: vi.fn(),
    });

    result.handleDeleteAvatar('c1', 'av1');
    expect(mockSetProgress).toHaveBeenCalled();
    // Verify the setter function filters out the avatar
    const setterFn = mockSetProgress.mock.calls[0][0];
    const prev = { c1: { stage1Complete: true, stage2Complete: false, stage3Complete: false, avatars: [mockAvatar] } };
    const next = setterFn(prev);
    expect(next.c1.avatars).toHaveLength(0);
  });
});
