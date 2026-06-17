import React, { Suspense, lazy } from 'react';
import { Company } from './types';
import { WelcomeView } from './views/WelcomeView';
import { ReturningView } from './views/ReturningView';
import { StageShell } from './views/StageShell';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { CommandPalette } from './components/CommandPalette';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { Check, AlertCircle, X } from 'lucide-react';
// Modals are mounted in the tree but only render content when open. Lazy
// loading keeps their (large) form/editor code out of the initial bundle.
const ConflictModal = lazy(() =>
  import('./components/ConflictModal').then(m => ({ default: m.ConflictModal }))
);
const FormulaEditorModal = lazy(() =>
  import('./components/FormulaEditorModal').then(m => ({ default: m.FormulaEditorModal }))
);
const CompanyEditorModal = lazy(() =>
  import('./components/CompanyEditorModal').then(m => ({ default: m.CompanyEditorModal }))
);
import { ErrorBoundary } from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'motion/react';
import {
  useFormulaModal,
  useCompanyModal,
  useConflictModal,
  useToasts,
} from './stores/uiStore';
import {
  useCompanies,
  useActiveCompanyId,
  useDraftCompany,
  useCompanyActions,
} from './stores/companyStore';
import {
  useProgress,
  useDraftOffer,
  useTransientResultOffer,
  useIsGenerating,
  useOfferActions,
} from './stores/offerStore';
import { useCurrentView, useWorkflowActions } from './stores/workflowStore';
import { useIsSynthesizing } from './stores/synthesisStore';
import { useActiveTab, useWorkspaceTabActions, type WorkspaceTab } from './stores/uiStore';
import { useMessageMiningStore } from './stores/messageMiningStore';
import { useCorpusStore } from './features/corpus/store';
import { usePipelineStore } from './stores/pipelineStore';
import { migrateAllCompaniesIntelligence } from './lib/runPipelineMigration';
import { useWorkflowOrchestration } from './hooks/useWorkflowOrchestration';
// ── Phase 10: Event Bus ────────────────────────────────────────────────────
import { createEventBus } from './services/eventBus';
import type { EventBus } from './types/phase10';
import {
  messageMiningServiceAdapter,
  clusterServiceAdapter,
  problemAnalysisServiceAdapter,
  emotionServiceAdapter,
  avatarServiceAdapter,
  offerServiceAdapter,
} from './services/eventBusAdapters';

// Event bus is initialised lazily on first use — services are injected when
// the bus is wired in the component that owns them. Export so any service can
// publish without prop-drilling.
let _eventBus: EventBus | null = null;
export function getEventBus(): EventBus | null { return _eventBus; }
export function initEventBus(
  messageService: any, clusterService: any, problemService: any,
  emotionService: any, avatarService: any, offerService: any
): EventBus {
  if (!_eventBus) {
    _eventBus = createEventBus(
      messageService, clusterService, problemService,
      emotionService, avatarService, offerService
    );
  }
  return _eventBus;
}
// ── end Phase 10 ──────────────────────────────────────────────────────────

/**
 * App
 *
 * Slim top-level component. Responsibilities:
 *   1. Hydrate persistent stores on first mount.
 *   2. Compose the chrome shell (Intelligence Hub trigger, toasts, modals).
 *   3. Route to the active view (Welcome / Returning / Stage4 / StageShell).
 *
 * All cross-store orchestration lives in {@link useWorkflowOrchestration}.
 */
export default function App() {
  // UI chrome
  const { isOpen: showFormulaModal, close: closeFormulaModal } = useFormulaModal();
  const { isOpen: showCompanyModal, close: closeCompanyModal } = useCompanyModal();
  const { isOpen: showConflictModal, pendingSaveType, close: closeConflictModal } = useConflictModal();
  const { successToast: showSuccessToast, errorToast: showErrorToast, dismissError } = useToasts();

  // Company / offer state needed by the shell + modals
  const companies = useCompanies();
  const activeCompanyId = useActiveCompanyId();
  const draftCompany = useDraftCompany();
  const { setDraftCompany, hydrate: hydrateCompanyStore } = useCompanyActions();

  const progress = useProgress();
  const draftOffer = useDraftOffer();
  const transientResultOffer = useTransientResultOffer();
  const isGenerating = useIsGenerating();
  const {
    setDraftOffer,
    setTransientResultOffer,
    setProgress,
    hydrate: hydrateOfferStore,
  } = useOfferActions();

  const activeCompany = companies.find(c => c.id === activeCompanyId);

  // Phase 13: Global storage error state
  const [storageError, setStorageError] = React.useState<string | null>(null);
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string };
      setStorageError(detail.message);
    };
    window.addEventListener('mis:storage-error', handler);
    return () => window.removeEventListener('mis:storage-error', handler);
  }, []);

  // Workflow nav
  const currentView = useCurrentView();
  const { setCurrentView } = useWorkflowActions();
  const { setActiveTab } = useWorkspaceTabActions();
  const activeTab = useActiveTab();
  const isSynthesizing = useIsSynthesizing();

  // Phase 15: keep the workspace sidebar tab in sync when orchestration
  // (synthesis, offer generation, "select company", etc.) changes
  // `currentView` outside of a direct tab click. Skipped for `stage3`,
  // since both "Segments" and "Intelligence" tabs map to it — user tab
  // selection there takes precedence.
  // Phase 16.2 fix: also skip while synthesis is running — the synthesis
  // start triggers cascading Zustand updates that change `currentView`
  // mid-render; calling setActiveTab here would cause StageShell's
  // handleTabSelect to call onNavigateToStage, resetting stageStep and
  // triggering React's "Maximum update depth exceeded" infinite loop.
  const prevViewRef = React.useRef(currentView);
  React.useEffect(() => {
    if (prevViewRef.current === currentView) return;
    prevViewRef.current = currentView;
    // Do not sync the tab while synthesis is active — synthesis start already
    // moves the user to the ConsultantReport overlay; syncing the tab at that
    // moment causes a redundant navigation call that restarts the update cycle.
    if (isSynthesizing) return;
    const VIEW_TO_TAB: Partial<Record<typeof currentView, WorkspaceTab>> = {
      stage1: 'overview',
      stage2: 'evidence',
      stage3: 'segments',
      stage4: 'strategy',
      foundation: 'strategy',
    };
    const tab = VIEW_TO_TAB[currentView];
    if (tab) setActiveTab(tab);
  }, [currentView, setActiveTab, isSynthesizing]);

  // Cross-store orchestration handlers
  const {
    handleSelectCompany,
    handleStartStage1,
    handleFinishStage1,
    saveCompany,
    handleDeleteCompany,
    handleEditCompanyFromHome,
    handleStartStage2,
    handleGenerateOffer,
    handleDuplicateProjectFromOffer,
    handleUpdateAvatarsFromPipeline,
    handleCompleteAvatars,
    handleProceedAfterSynthesis,
    handleNavigateToStage,
  } = useWorkflowOrchestration();

  const loadMessageMining = useMessageMiningStore(s => s.loadFromStorage);
  const loadCorpus = useCorpusStore(s => s.loadFromStorage);
  const loadPipeline = usePipelineStore(s => s.loadFromStorage);

  // First-load hydration from IndexedDB. Stores own their persistence; App
  // only branches on first-run vs. returning visitor.
  React.useEffect(() => {
    const initStorage = async () => {
      const [{ companies: savedCompanies }, { offers: savedOffers, progress: savedProgress }] =
        await Promise.all([
          hydrateCompanyStore(),
          hydrateOfferStore(),
          loadMessageMining(),
          loadCorpus(),
          loadPipeline(),
        ]);
      const migrated = migrateAllCompaniesIntelligence(
        savedCompanies,
        savedProgress,
        savedOffers
      );
      setProgress(migrated);

      // ✅ Phase 10: Initialize Event Bus with all required service adapters
      initEventBus(
        messageMiningServiceAdapter,
        clusterServiceAdapter,
        problemAnalysisServiceAdapter,
        emotionServiceAdapter,
        avatarServiceAdapter,
        offerServiceAdapter,
      );
      console.log('[Phase 10] Event Bus initialized successfully');

      if (savedCompanies.length > 0 && currentView === 'welcome') {
        setCurrentView('returning');
      }
    };
    initStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderMainContent = () => {
    if (currentView === 'welcome' && companies.length === 0) {
      return <WelcomeView onStart={handleStartStage1} />;
    }

    if (currentView === 'returning') {
      return (
        <ReturningView
          onSelectCompany={(id) => handleSelectCompany(id)}
          onEditCompany={handleEditCompanyFromHome}
          onDeleteCompany={handleDeleteCompany}
          onAddNewCompany={handleStartStage1}
        />
      );
    }

    return (
      <StageShell
        onStartStage1={handleStartStage1}
        onSelectCompany={handleSelectCompany}
        onNavigateToStage={handleNavigateToStage}
        onProceedAfterSynthesis={handleProceedAfterSynthesis}
        onFinishStage1={handleFinishStage1}
        onStartStage2={() => handleStartStage2()}
        onGenerateOffer={handleGenerateOffer}
        onCompleteAvatars={handleCompleteAvatars}
        onUpdateAvatars={handleUpdateAvatarsFromPipeline}
      />
    );
  };

  return (
    <ErrorBoundary name="App">
        {storageError && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#FEF2F2', borderBottom: '2px solid #DC2626',
            padding: '10px 20px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', fontSize: '13px', fontWeight: 600,
            color: '#7F1D1D'
          }}>
            <span>⚠️ {storageError}</span>
            <button onClick={() => setStorageError(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '16px', color: '#DC2626', fontWeight: 700
            }}>✕</button>
          </div>
        )}
      <div className="h-screen bg-[var(--color-primary-bg)] flex overflow-hidden matrix-grid transition-all duration-700 dark">
        {/* Persistent workspace sidebar — only for in-project views (Phase 15) */}
        {['stage1', 'stage2', 'stage3', 'stage4', 'foundation'].includes(currentView) && (
          <WorkspaceSidebar
            companies={companies}
            activeCompany={activeCompany}
            activeTab={activeTab}
            onSelectCompany={(id) => handleSelectCompany(id)}
            onAddCompany={handleStartStage1}
            onGoHome={() => setCurrentView('returning')}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              const view: 'stage1' | 'stage2' | 'stage3' | 'stage4' =
                tab === 'overview' ? 'stage1'
                : tab === 'evidence' ? 'stage2'
                : tab === 'strategy' ? 'stage4'
                : 'stage3';
              handleNavigateToStage(view);
            }}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="flex-1 flex flex-col overflow-y-auto">
            {renderMainContent()}
          </div>

          <CommandPalette />
          <EvidenceDrawer />

          <AnimatePresence>
            {showSuccessToast && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] bg-[#1D1D1F] text-white px-6 py-3.5 rounded-[var(--radius-full)] shadow-lg flex items-center gap-3 border border-white/10"
              >
                <div className="w-6 h-6 rounded-[var(--radius-full)] bg-emerald-500 flex items-center justify-center">
                  <Check size={14} className="text-white" strokeWidth={3} />
                </div>
                <span className="text-[var(--text-base)] font-medium">{showSuccessToast}</span>
              </motion.div>
            )}
            {showErrorToast && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[3000] bg-rose-600 text-white p-5 rounded-[var(--radius-md)] shadow-lg flex items-center gap-4 border border-white/20 max-w-[90vw]"
              >
                <AlertCircle size={20} className="shrink-0" />
                <div className="space-y-0.5">
                  <div className="text-[var(--text-xs)] font-medium opacity-70 leading-none">Something went wrong</div>
                  <p className="text-[var(--text-base)] font-medium leading-tight line-clamp-3">{showErrorToast}</p>
                </div>
                <button
                  onClick={() => dismissError()}
                  className="p-2 hover:bg-white/10 rounded-[var(--radius-full)] transition-colors ml-2 shrink-0 border border-white/10"
                >
                  <X size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modals — only mount when open to defer their chunks */}
        {showConflictModal && (
          <Suspense fallback={null}>
            <ConflictModal
              isOpen={showConflictModal}
              onClose={() => closeConflictModal()}
              onOverwrite={() => {
                if (pendingSaveType === 'company') saveCompany(false);
                if (pendingSaveType === 'offer') handleGenerateOffer(true);
              }}
              onCreateNew={() => {
                if (pendingSaveType === 'company') saveCompany(true);
                if (pendingSaveType === 'offer') handleDuplicateProjectFromOffer();
              }}
              title={pendingSaveType === 'company' ? "Update Company Profile?" : "Update Offer Formula?"}
              description={pendingSaveType === 'company' ? "You've changed your company details. Overwrite the original profile or save as a new project?" : "You've changed your offer formula. Do you want to update the current offer or create a new project for this version?"}
            />
          </Suspense>
        )}

        {showFormulaModal && (
          <Suspense fallback={null}>
            <FormulaEditorModal
              isOpen={showFormulaModal}
              onClose={() => {
                closeFormulaModal();
                setTransientResultOffer(null);
              }}
              draftOffer={draftOffer}
              companyContext={activeCompany || undefined}
              onUpdateDraft={(k, v) => setDraftOffer(prev => ({ ...prev, [k]: v }))}
              onGenerate={() => { handleGenerateOffer(); }}
              isGenerating={isGenerating}
              resultOffer={transientResultOffer || undefined}
            />
          </Suspense>
        )}

        {showCompanyModal && (
          <Suspense fallback={null}>
            <CompanyEditorModal
              isOpen={showCompanyModal}
              onClose={() => closeCompanyModal()}
              draftCompany={draftCompany}
              isOfferComplete={activeCompanyId ? progress[activeCompanyId]?.stage2Complete : false}
              onUpdateDraft={(k, v) => setDraftCompany(prev => ({ ...prev, [k]: v }))}
              onSave={() => {
                closeCompanyModal();
                handleFinishStage1();
              }}
            />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
}