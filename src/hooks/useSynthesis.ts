import { Company, Offer, Avatar } from '../types';
import { Progress } from '../types';
import {
  generateStage1Synthesis,
  generateStage2Synthesis,
  generateStage3Synthesis,
  SynthesisReport,
  type Stage2EvidenceContext,
} from '../services/synthesisService';
import { useCorpusStore } from '../features/corpus/store';
import { useSynthesisActions, useSynthesisReport, useSynthesisStage } from '../stores/synthesisStore';
import { useProgress, useOfferActions } from '../stores/offerStore';
import { useWorkflowActions } from '../stores/workflowStore';
import { useToasts, useToastActions } from '../stores/uiStore';
import { usePipelineStore } from '../stores/pipelineStore';

export function useSynthesis(params: {
  activeCompanyId: string | null;
  companies: Company[];
  progress: Record<string, Progress>;
  draftCompany: Partial<Company> | null;
  showErrorToastMsg: (msg: string) => void;
}): {
  handleStartSynthesis: (
    stage: string,
    overrideCompany?: Company,
    _overrideOffer?: Offer,
    overrideAvatars?: Avatar[]
  ) => Promise<void>;
  handleProceedAfterSynthesis: () => void;
} {
  const { activeCompanyId, companies, progress, draftCompany, showErrorToastMsg } = params;

  const synthesisReport = useSynthesisReport();
  const synthesisStage = useSynthesisStage();
  const {
    beginRequest: beginSynthesisRequest,
    setIsSynthesizing,
    setSynthesisReport,
  } = useSynthesisActions();

  const { setProgress } = useOfferActions();
  const { setCurrentView, setStageStep } = useWorkflowActions();
  const { dismissSuccess } = useToasts();
  const { showSuccess: showSuccessToastMsg } = useToastActions();

  const handleStartSynthesis = async (
    stage: string,
    overrideCompany?: Company,
    _overrideOffer?: Offer,
    overrideAvatars?: Avatar[]
  ) => {
    const request = beginSynthesisRequest(stage);

    try {
      let report: SynthesisReport;
      const targetCompany = overrideCompany || companies.find(c => c.id === activeCompanyId) || draftCompany;
      if (!targetCompany) throw new Error('No target company found for synthesis');
      const companyData = targetCompany as Company;

      if (stage === 'Identity') {
        report = await generateStage1Synthesis(companyData, request.signal);
      } else if (stage === 'Strategy' && activeCompanyId) {
        const corpusStore = useCorpusStore.getState();
        const pStore = usePipelineStore.getState();
        const corpus = corpusStore.corpora[activeCompanyId];
        const evidenceContext: Stage2EvidenceContext = {
          messages: corpus?.messages ?? [],
          clusters: corpus?.clusters ?? [],
          avatarOffers: pStore.getAvatarOffersForCompany(activeCompanyId),          marketIntel: pStore.marketIntelligence[activeCompanyId] ?? null,
        };
        report = await generateStage2Synthesis(companyData, evidenceContext, request.signal);
      } else if (stage === 'Modeling' && activeCompanyId) {
        const targetAvatars = overrideAvatars || progress[activeCompanyId]?.avatars || [];
        report = await generateStage3Synthesis(companyData, targetAvatars, request.signal);
      } else {
        throw new Error('Invalid stage for synthesis or missing data');
      }

      if (!request.isLatest()) {
        console.log('Strategic synthesis request discarded (stale or aborted).');
        return;
      }

      setSynthesisReport(report);
    } catch (err: any) {
      const isAbort =
        err.name === 'AbortError' ||
        err.name === 'CanceledError' ||
        err.message?.toLowerCase().includes('aborted') ||
        err.message?.toLowerCase().includes('canceled') ||
        request.signal.aborted;

      if (isAbort) return;

      const errorMessage = err.message || 'An unexpected strategic error occurred.';
      const isQuota = err.code === 'RATE_LIMIT' || err.status === 429;
      const isOverloaded = err.code === 'SATURATION' || err.code === 'BACKPRESSURE' || err.status === 503;

      if (isQuota) {
        showErrorToastMsg('Intelligence quota reached. Please pause for 60 seconds before re-engaging.');
      } else if (isOverloaded) {
        showErrorToastMsg('Intelligence server is heavily loaded. Attempting automatic recovery...');
      } else {
        showErrorToastMsg(`Analysis failed: ${errorMessage}. Please try again or check your connection.`);
      }

      if (request.isLatest()) {
        setIsSynthesizing(false);
      }
    }
  };

  const handleProceedAfterSynthesis = () => {
    setIsSynthesizing(false);
    if (activeCompanyId && synthesisReport) {
      setProgress(prev => ({
        ...prev,
        [activeCompanyId]: {
          ...prev[activeCompanyId],
          synthesisReports: {
            ...prev[activeCompanyId]?.synthesisReports,
            [synthesisStage]: synthesisReport,
          },
        },
      }));
    }

    if (synthesisStage === 'Identity') {
      setCurrentView('stage2');
      setStageStep(0);
    } else if (synthesisStage === 'Strategy') {
      setStageStep(6);
    } else if (synthesisStage === 'Modeling') {
      setCurrentView('returning');
      showSuccessToastMsg('Customer Avatars saved to Intelligence Hub!');
      setTimeout(() => dismissSuccess(), 3500);
    }
    setSynthesisReport(null);
  };

  return { handleStartSynthesis, handleProceedAfterSynthesis };
}
