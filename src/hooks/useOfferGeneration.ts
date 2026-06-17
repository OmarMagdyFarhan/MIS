import { sanitizeForPrompt } from '../lib/sanitizePrompt';
import { Company, Offer, Avatar } from '../types';
import { Progress } from '../types';
import { generateAIContent } from '../services/aiService';
import { consolidateOffer, computeOfferScore } from '../services/offerService';
import { addToEditHistory } from '../services/historyService';
import { generateScoreDelta } from '../services/intelligenceService';
import { useOfferActions } from '../stores/offerStore';
import { useCompanyActions, useCompanyStore } from '../stores/companyStore';
import { useConflictModal, useToasts } from '../stores/uiStore';
import { useInsightsActions } from '../stores/insightsStore';
import { syncProgressWithPipeline } from '../lib/pipelineMigration';
import { usePipelineStore } from '../stores/pipelineStore';

export function useOfferGeneration(params: {
  activeCompanyId: string | null;
  companies: Company[];
  offers: Record<string, Offer>;
  progress: Record<string, Progress>;
  draftOffer: Partial<Offer>;
  handleStartSynthesis: (...args: any[]) => Promise<void>;
  showErrorToastMsg: (msg: string) => void;
  showSuccessToastMsg: (msg: string) => void;
  openConflictModal: (type: string) => void;
}): {
  handleGenerateOffer: (forceOverwrite?: boolean, overrideId?: string) => Promise<void>;
  handleConsolidateOffer: (companyId: string) => Promise<void>;
  handleDuplicateProjectFromOffer: () => void;
  checkOfferChanges: () => boolean;
} {
  const {
    activeCompanyId, companies, offers, progress, draftOffer,
    handleStartSynthesis, showErrorToastMsg, showSuccessToastMsg, openConflictModal,
  } = params;

  const {
    setOffers,
    setProgress,
    setTransientResultOffer,
    setIsGenerating,
    setGenerationError,
  } = useOfferActions();

  const { setCompanies, setActiveCompanyId } = useCompanyActions();
  const { close: closeConflictModal } = useConflictModal();
  const { dismissSuccess } = useToasts();
  const { loadStageInsights } = useInsightsActions();

  const activeCompany = companies.find(c => c.id === activeCompanyId);

  const checkOfferChanges = () => {
    const existingOffer = offers[activeCompanyId || ''];
    if (!existingOffer) return false;
    return (
      draftOffer.product !== existingOffer.product ||
      draftOffer.relevance !== existingOffer.relevance ||
      draftOffer.reason !== existingOffer.reason ||
      draftOffer.audience !== existingOffer.audience ||
      draftOffer.transformation !== existingOffer.transformation
    );
  };

  const handleGenerateOffer = async (forceOverwrite = false, overrideId?: string) => {
    const targetCompId = overrideId || activeCompanyId;
    const targetComp = companies.find(c => c.id === targetCompId);

    if (!targetComp) {
      console.error('No target company found for generation');
      return;
    }

    if (!forceOverwrite && offers[targetComp.id] && checkOfferChanges()) {
      openConflictModal('offer');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const promptContent = `
        Company: ${sanitizeForPrompt(targetComp.name)}
        Industry: ${targetComp.industry}
        Specializations: ${targetComp.specializations.map(s => s.name).join(', ')}
        USP: ${targetComp.usp || 'not specified'}

        Offer Formula:
        - Product/Service: ${sanitizeForPrompt(draftOffer.product || '')}
        - Relevance:       ${sanitizeForPrompt(draftOffer.relevance || '')}
        - Reason to Act:   ${sanitizeForPrompt(draftOffer.reason || '')}
        - Target Audience: ${sanitizeForPrompt(draftOffer.audience || '')}
        - Transformation:  ${sanitizeForPrompt(draftOffer.transformation || '')}

        Write a powerful, persuasive marketing offer (3–5 sentences). Requirements:
        1. State clearly what the product/service is
        2. Connect to the audience's current situation or pain point
        3. Include urgency or reason to act now
        4. Paint the transformation — before and after
        5. Sound confident and natural — not salesy or generic
      `;

      const resultText = await generateAIContent({
        systemPrompt: `You are an expert direct-response marketing copywriter. Return ONLY the offer copy. No labels. No explanation. No markdown.${
          progress[targetComp.id]?.synthesisReports?.['Identity']
            ? `\n\nCONSULTANT FEEDBACK ON BRAND IDENTITY:\n- Strengths: ${progress[targetComp.id]?.synthesisReports?.['Identity']?.strengths.join(', ')}\n- Critical Gaps: ${progress[targetComp.id]?.synthesisReports?.['Identity']?.weaknesses.join(', ')}\n- Strategic Advice: ${progress[targetComp.id]?.synthesisReports?.['Identity']?.recommendations.join(', ')}`
            : ''
        }`,
        userMessage: promptContent,
      });

      if (!resultText) {
        throw new Error('The AI returned an empty response. Please try adjusting your formula inputs.');
      }

      const newOffer: Offer = {
        companyId: targetComp.id,
        product: draftOffer.product || '',
        relevance: draftOffer.relevance || '',
        reason: draftOffer.reason || '',
        audience: draftOffer.audience || '',
        transformation: draftOffer.transformation || '',
        generatedOffer: resultText,
        generatedAt: new Date().toISOString(),
      };

      const scoredOffer = await computeOfferScore(targetComp, newOffer);

      const existingOffer = offers[targetComp.id];
      if (existingOffer && existingOffer.score && scoredOffer.score && scoredOffer.score.total > existingOffer.score.total) {
        addToEditHistory({
          field: 'generatedOffer',
          before: existingOffer.generatedOffer,
          after: scoredOffer.generatedOffer,
          industry: targetComp.industry,
          timestamp: new Date().toISOString(),
          type: 'score_improvement',
          deltaScore: scoredOffer.score.total - existingOffer.score.total,
        });
      }

      setOffers(prev => ({ ...prev, [targetComp.id]: scoredOffer }));
      setTransientResultOffer(resultText);
      setProgress(prev => ({
        ...prev,
        [targetComp.id]: { ...prev[targetComp.id], stage1Complete: true, stage2Complete: true },
      }));

      handleStartSynthesis('Strategy', targetComp, scoredOffer);
      loadStageInsights('offer', scoredOffer, targetComp);
    } catch (err: any) {
      console.error('Offer Generation Error:', err);
      if (err?.code === 'RATE_LIMIT' || err?.status === 429) {
        showErrorToastMsg('Model quota exceeded. Please wait a moment before trying again.');
      } else if (err?.code === 'SATURATION' || err?.code === 'BACKPRESSURE' || err?.status === 503) {
        showErrorToastMsg('Intelligence server is overloaded. Retrying once...');
      }
      setGenerationError(err.message || 'Failed to generate offer. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConsolidateOffer = async (companyId: string) => {
    const comp = companies.find(c => c.id === companyId);
    const currentOffer = offers[companyId];
    const compAvatars = progress[companyId]?.avatars || [];
    if (!comp || !currentOffer || compAvatars.length === 0) return;

    setIsGenerating(true);
    try {
      const improvedOffer = await consolidateOffer(comp, currentOffer, compAvatars);
      const deltaInsight = await generateScoreDelta(currentOffer, improvedOffer);

      setOffers(prev => ({ ...prev, [companyId]: improvedOffer }));
      setProgress(prev => ({
        ...prev,
        [companyId]: syncProgressWithPipeline(
          { ...prev[companyId], scoreDelta: deltaInsight },
          companyId
        ),
      }));

      loadStageInsights('consolidated', {
        beforeScore: currentOffer.score?.total || 0,
        afterScore: improvedOffer.score?.total || 0,
        biggestGain: deltaInsight.biggestGain,
        weakestLink: deltaInsight.nextWeakLink,
        avatarsCount: compAvatars.length,
        unprocessedCount: 0,
        topAvatarDrilled: true,
      }, comp);

      showSuccessToastMsg('Global offer improved using collective empathy intelligence!');
      setTimeout(() => dismissSuccess(), 4000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to consolidate: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDuplicateProjectFromOffer = () => {
    if (!activeCompany) return;
    const newCid = crypto.randomUUID();
    const duplicatedCompany: Company = {
      ...activeCompany,
      id: newCid,
      createdAt: new Date().toISOString(),
    };
    setCompanies(prev => [...prev, duplicatedCompany]);
    setActiveCompanyId(newCid);
    setProgress({ ...progress, [newCid]: { stage1Complete: true, stage2Complete: false, stage3Complete: false } });
    closeConflictModal();
    showSuccessToastMsg('Offer duplicated to new project!');
    setTimeout(() => dismissSuccess(), 3500);
    setTimeout(() => {
      handleGenerateOffer(true, newCid);
    }, 100);
  };

  return { handleGenerateOffer, handleConsolidateOffer, handleDuplicateProjectFromOffer, checkOfferChanges };
}
