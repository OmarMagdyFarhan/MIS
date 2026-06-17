import { Company, Offer, Avatar } from '../types';
import { updateIndustryIntelligence } from '../services/historyService';
import { rankAvatarsForDisplay } from '../services/intelligenceService';
import { useOfferActions } from '../stores/offerStore';
import { syncProgressWithPipeline } from '../lib/pipelineMigration';

export function useAvatarManagement(params: {
  activeCompanyId: string | null;
  companies: Company[];
  offers: Record<string, Offer>;
  handleStartSynthesis: (...args: any[]) => Promise<void>;
  showErrorToastMsg: (msg: string) => void;
}): {
  handleUpdateAvatar: (companyId: string, avatar: Avatar) => void;
  handleUpdateAvatarsFromPipeline: (avatars: Avatar[]) => void;
  handleDeleteAvatar: (companyId: string, avatarId: string) => void;
  handleCompleteAvatars: (avatars: Avatar[]) => Promise<void>;
} {
  const { activeCompanyId, companies, offers, handleStartSynthesis } = params;

  const { setProgress, setIsGenerating } = useOfferActions();

  const handleUpdateAvatar = (companyId: string, updatedAvatar: Avatar) => {
    setProgress(prev => {
      const p = prev[companyId];
      if (!p || !p.avatars) return prev;
      const exists = p.avatars.some((a: Avatar) => a.id === updatedAvatar.id);
      const updatedAvatars = exists
        ? p.avatars.map((a: Avatar) => a.id === updatedAvatar.id ? updatedAvatar : a)
        : [...p.avatars, updatedAvatar];
      return {
        ...prev,
        [companyId]: syncProgressWithPipeline({ ...p, avatars: updatedAvatars }, companyId),
      };
    });
  };

  const handleUpdateAvatarsFromPipeline = (avatars: Avatar[]) => {
    if (!activeCompanyId) return;
    setProgress(prev => ({
      ...prev,
      [activeCompanyId]: syncProgressWithPipeline(
        {
          ...(prev[activeCompanyId] || {
            stage1Complete: true,
            stage2Complete: false,
            stage3Complete: false,
          }),
          avatars,
        },
        activeCompanyId
      ),
    }));
  };

  const handleDeleteAvatar = (companyId: string, avatarId: string) => {
    setProgress(prev => {
      const companyProgress = prev[companyId];
      if (!companyProgress) return prev;
      const avatars = companyProgress.avatars || [];
      const getDescendantIds = (parentId: string): string[] => {
        const children = avatars.filter((a: Avatar) => a.parentId === parentId);
        let ids = children.map((c: Avatar) => c.id);
        children.forEach((c: Avatar) => {
          ids = [...ids, ...getDescendantIds(c.id)];
        });
        return ids;
      };
      const idsToDelete = [avatarId, ...getDescendantIds(avatarId)];
      return {
        ...prev,
        [companyId]: {
          ...companyProgress,
          avatars: avatars.filter((a: Avatar) => !idsToDelete.includes(a.id)),
        },
      };
    });
  };

  const handleCompleteAvatars = async (avatars: Avatar[]) => {
    if (!activeCompanyId) return;
    const comp = companies.find(c => c.id === activeCompanyId);
    if (!comp) return;

    updateIndustryIntelligence(comp, avatars, offers[activeCompanyId]);

    setIsGenerating(true);
    // FIX #6: Rank avatars first, then pass the ranked list to synthesis so
    // Modeling receives the correctly ordered profiles — not the unranked originals.
    try {
      const rankedAvatars = await rankAvatarsForDisplay(avatars, comp);
      setProgress(prev => ({
        ...prev,
        [activeCompanyId]: { ...prev[activeCompanyId], stage3Complete: true, avatars: rankedAvatars },
      }));
      setIsGenerating(false);
      // Pass ranked avatars to synthesis
      handleStartSynthesis('Modeling', comp, undefined, rankedAvatars);
    } catch (err) {
      console.error('Failed to rank avatars:', err);
      setProgress(prev => ({
        ...prev,
        [activeCompanyId]: { ...prev[activeCompanyId], stage3Complete: true, avatars },
      }));
      setIsGenerating(false);
      // Fallback: pass unranked avatars to synthesis
      handleStartSynthesis('Modeling', comp, undefined, avatars);
    }
  };

  return { handleUpdateAvatar, handleUpdateAvatarsFromPipeline, handleDeleteAvatar, handleCompleteAvatars };
}
