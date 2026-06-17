import { Company } from '../types';
import {
  useFormulaModal, useCompanyModal, useConflictModal, useToasts, useToastActions,
} from '../stores/uiStore';
import {
  useCompanies, useActiveCompanyId, useDraftCompany, useCompanyActions,
} from '../stores/companyStore';
import {
  useOffers, useProgress, useDraftOffer, useOfferActions,
} from '../stores/offerStore';
import { useCurrentView, useWorkflowActions } from '../stores/workflowStore';
import { useInsightsActions } from '../stores/insightsStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { useSynthesis } from './useSynthesis';
import { useOfferGeneration } from './useOfferGeneration';
import { useAvatarManagement } from './useAvatarManagement';

export function useWorkflowOrchestration() {
  /**
   * CRITICAL: Navigation state is coordinated across multiple stores.
   * currentView + activeTab + activeCompanyId + stageStep are interdependent.
   * 
   * ANY UI that navigates MUST use:
   *   - handleNavigateToStage(stage), OR
   *   - handleSelectCompany(id) + handleNavigateToStage(stage)
   * 
   * DO NOT call setActiveTab/setCurrentView/setActiveCompanyId directly.
   * Those are PRIVATE to this orchestration layer.
   */
  const { open: openFormulaModal, close: closeFormulaModal } = useFormulaModal();
  const { open: openCompanyModal, close: closeCompanyModal } = useCompanyModal();
  const { open: openConflictModal, close: closeConflictModal } = useConflictModal();
  const { dismissSuccess } = useToasts();
  const { showSuccess: showSuccessToastMsg, showError: showErrorToastMsg } = useToastActions();

  const companies = useCompanies();
  const activeCompanyId = useActiveCompanyId();
  const draftCompany = useDraftCompany();
  const { setCompanies, setActiveCompanyId, setDraftCompany, markNeedsOfferUpdate } = useCompanyActions();

  const offers = useOffers();
  const progress = useProgress();
  const draftOffer = useDraftOffer();
  const { setOffers, setProgress, setDraftOffer, setTransientResultOffer, removeCompanyData } = useOfferActions();

  const activeCompany = companies.find(c => c.id === activeCompanyId);
  const currentView = useCurrentView();
  const { setCurrentView, setStageStep, setAvatarMethod } = useWorkflowActions();
  const { loadStageInsights } = useInsightsActions();

  const { handleStartSynthesis, handleProceedAfterSynthesis } = useSynthesis({
    activeCompanyId, companies, progress, draftCompany, showErrorToastMsg,
  });

  const { handleGenerateOffer, handleConsolidateOffer,
          handleDuplicateProjectFromOffer, checkOfferChanges } = useOfferGeneration({
    activeCompanyId, companies, offers, progress, draftOffer,
    handleStartSynthesis, showErrorToastMsg, showSuccessToastMsg, openConflictModal,
  });

  const { handleUpdateAvatar, handleUpdateAvatarsFromPipeline,
          handleDeleteAvatar, handleCompleteAvatars } = useAvatarManagement({
    activeCompanyId, companies, offers, handleStartSynthesis, showErrorToastMsg,
  });

  const handleSelectCompany = (id: string, phase?: 'company' | 'offer' | 'avatar') => {
    const comp = companies.find(c => c.id === id);
    if (!comp) { console.error('Attempted to select non-existent company:', id); setCurrentView('welcome'); return; }
    setActiveCompanyId(id);
    setDraftCompany(comp);
    if (phase === 'company') { setCurrentView('stage1'); setStageStep(1); }
    else if (phase === 'offer') {
      setDraftOffer(offers[id] || { product: '', relevance: '', reason: '', audience: '', transformation: '' } as any);
      const phase63 = usePipelineStore.getState().byCompany[id]?.phase ?? '';
      const isComplete63 = ['avatar_offers_ready', 'pipeline_complete'].includes(phase63);
      setCurrentView(isComplete63 ? 'stage4' : 'stage2');
      setStageStep(isComplete63 ? 6 : 0);
    } else if (phase === 'avatar') { setCurrentView('stage3'); setStageStep(1); }
    else if (progress[id]?.stage1Complete) {
      setDraftOffer(offers[id] || { product: '', relevance: '', reason: '', audience: '', transformation: '' } as any);
      const phase63 = usePipelineStore.getState().byCompany[id]?.phase ?? '';
      const isComplete63 = ['avatar_offers_ready', 'pipeline_complete'].includes(phase63);
      setCurrentView(isComplete63 ? 'stage4' : 'stage2');
      setStageStep(isComplete63 ? 6 : 0);
    } else { setCurrentView('stage1'); setStageStep(1); }
  };

  const handleStartStage1 = () => {
    setActiveCompanyId(null);
    setDraftCompany({ name: '', industry: '', specializations: [], usp: '', country: 'Global', websiteUrl: '', isGlobalMode: true });
    setStageStep(1);
    setCurrentView('stage1');
  };

  const saveCompany = (asNew: boolean) => {
    const cid = asNew ? crypto.randomUUID() : (activeCompanyId || crypto.randomUUID());
    if (!asNew && activeCompanyId && activeCompany) {
      if ((draftCompany.name !== activeCompany.name || draftCompany.industry !== activeCompany.industry)
          && progress[activeCompanyId]?.stage2Complete) {
        markNeedsOfferUpdate(activeCompanyId);
      }
    }
    const newCompany: Company = {
      id: cid, name: draftCompany.name || 'Unnamed', industry: draftCompany.industry || '',
      logoUrl: draftCompany.logoUrl || '', specializations: draftCompany.specializations || [],
      usp: draftCompany.usp || '', country: draftCompany.country || 'Global',
      websiteUrl: draftCompany.websiteUrl || '', isGlobalMode: draftCompany.country === 'Global',
      createdAt: asNew ? new Date().toISOString() : (activeCompany?.createdAt || new Date().toISOString()),
    };
    if (asNew || !activeCompanyId) {
      setCompanies(prev => [...prev, newCompany]);
      setActiveCompanyId(newCompany.id);
      setProgress(prev => ({ ...prev, [newCompany.id]: { stage1Complete: true, stage2Complete: false, stage3Complete: false } }));
      if (currentView === 'returning') { showSuccessToastMsg('Project duplicated successfully!'); setTimeout(() => dismissSuccess(), 3000); }
      else {
        // Defer synthesis start so all synchronous state updates above are
        // committed and React has finished its current render pass before
        // `isSynthesizing` flips to true. Without this deferral the cascading
        // store updates cause the StageShell tab-sync effect to fire mid-render
        // and reset stageStep/currentView, triggering the infinite loop.
        setTimeout(() => {
          handleStartSynthesis('Identity', newCompany);
          loadStageInsights('company', newCompany, newCompany);
        }, 0);
      }
    } else {
      setCompanies(prev => prev.map(c => c.id === activeCompanyId ? newCompany : c));
      if (currentView === 'stage1') {
        // Same deferral — avoids render-cycle collision when updating an
        // existing company from the Identity phase.
        setTimeout(() => { handleStartSynthesis('Identity', newCompany); }, 0);
      } else { showSuccessToastMsg('Project updated successfully!'); setTimeout(() => dismissSuccess(), 3000); }
    }
    closeConflictModal();
  };

  const handleFinishStage1 = () => {
    if (activeCompanyId && (draftCompany.name !== activeCompany?.name || draftCompany.industry !== activeCompany?.industry ||
        JSON.stringify(draftCompany.specializations) !== JSON.stringify(activeCompany?.specializations) ||
        draftCompany.usp !== activeCompany?.usp)) {
      openConflictModal('company'); return;
    }
    saveCompany(false);
  };

  const handleStartStage2 = (id?: string) => {
    const targetId = id || activeCompanyId;
    if (!targetId) return;
    setActiveCompanyId(targetId);
    setDraftOffer(offers[targetId] || ({ product: '', relevance: '', reason: '', audience: '', transformation: '' } as any));
    const phase123 = usePipelineStore.getState().byCompany[targetId]?.phase ?? '';
    const isComplete123 = ['avatar_offers_ready', 'pipeline_complete'].includes(phase123);
    setCurrentView(isComplete123 ? 'stage4' : 'stage2');
    setStageStep(isComplete123 ? 6 : 0);
    usePipelineStore.getState().ensureCompany(targetId);
    if (!usePipelineStore.getState().byCompany[targetId]?.phase) usePipelineStore.getState().setPhase(targetId, 'company_complete');
  };

  const handleNavigateToStage = (view: 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'foundation', phase?: 'company' | 'offer' | 'avatar') => {
    if (view === 'foundation') {
      setCurrentView('foundation');
      return;
    }
    if (view === 'stage1' || phase === 'company') {
      if (activeCompany) { setDraftCompany(activeCompany); setStageStep(1); }
      setCurrentView('stage1');
    } else if (view === 'stage2' || phase === 'offer') {
      if (activeCompanyId) {
        setDraftOffer(offers[activeCompanyId] || ({ product: '', relevance: '', reason: '', audience: '', transformation: '' } as any));
        setStageStep(view === 'stage2' && phase !== 'offer' ? 0 : ((['avatar_offers_ready', 'pipeline_complete'].includes(usePipelineStore.getState().byCompany[activeCompanyId]?.phase ?? '') ? 6 : 0)));
        setCurrentView('stage2');
      }
    } else if (view === 'stage3' || phase === 'avatar') {
      if (activeCompanyId) {
        // FIX #8: Only reset wizard state on FIRST entry from a different view.
        // Stage3Routes itself handles the dashboard-vs-wizard decision based on
        // whether avatars already exist. Resetting avatarMethod here on every
        // tab switch was wiping the user's progress and forcing the method
        // selector to reappear even after avatars had been created.
        if (currentView !== 'stage3') {
          setStageStep(1);
          setAvatarMethod(null);
        }
        setCurrentView('stage3');
      }
    } else if (view === 'stage4') {
      if (activeCompanyId) { setCurrentView('stage4'); }
    }
  };

  const handleDeleteCompany = (id: string) => {
    const nextCompanies = companies.filter(c => c.id !== id);
    setCompanies(nextCompanies);
    removeCompanyData(id);
    if (nextCompanies.length === 0) { setCurrentView('welcome'); setActiveCompanyId(null); }
    else if (activeCompanyId === id) { setActiveCompanyId(null); setCurrentView('returning'); }
  };

  const handleEditCompanyFromHome = (id: string, phase: 'company' | 'offer' | 'avatar') => {
    const company = companies.find(c => c.id === id);
    if (!company) return;
    setActiveCompanyId(id);
    if (phase === 'company') { closeFormulaModal(); setDraftCompany(company); openCompanyModal(); }
    else if (phase === 'offer') {
      closeCompanyModal();
      setDraftOffer(offers[id] || ({ product: '', relevance: '', reason: '', audience: '', transformation: '' } as any));
      setTransientResultOffer(null);
      openFormulaModal();
    }
  };

  return {
    handleSelectCompany, handleStartStage1, handleFinishStage1, saveCompany,
    handleDeleteCompany, handleEditCompanyFromHome, handleStartStage2,
    handleGenerateOffer, handleConsolidateOffer, handleDuplicateProjectFromOffer,
    handleUpdateAvatar, handleUpdateAvatarsFromPipeline, handleDeleteAvatar, handleCompleteAvatars,
    handleStartSynthesis, handleProceedAfterSynthesis, handleNavigateToStage,
  };
}
