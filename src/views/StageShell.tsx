/**
 * StageShell — Guided Workspace canvas (Phase 15).
 *
 * Replaces the previous gated wizard shell (ModuleHeader + JourneyIndicator
 * stepper + per-stage page swap) with a workspace canvas rendered inside
 * WorkspaceShell's sidebar layout. The active section is driven by
 * `uiStore.activeTab` (Overview / Evidence / Segments / Intelligence /
 * Strategy) rather than `currentView`'s wizard steps — though `currentView`
 * is still kept in sync so existing orchestration logic (synthesis, offer
 * generation, etc.) continues to work unchanged.
 *
 * Business logic, stores, and stage route components are reused as-is.
 */
import React, { Suspense, lazy } from 'react';
import { AnimatePresence } from 'motion/react';
import { Avatar } from '../types';
import { NextBestAction } from '../components/NextBestAction';
import { SystemStateIndicator } from '../components/SystemStateIndicator';
import { TransitionWrapper } from '../components/TransitionWrapper';
import { ConsultantReport } from '../components/ConsultantReport';
import { SectionFallback } from '../components/SectionFallback';
import { IntelligenceTab } from './IntelligenceTab';
import { Stage1Routes } from './Stage1Routes';
const Stage2Routes = lazy(() =>
  import('./Stage2Routes').then(m => ({ default: m.Stage2Routes }))
);
const Stage3Routes = lazy(() =>
  import('./Stage3Routes').then(m => ({ default: m.Stage3Routes }))
);
const Stage4View = lazy(() =>
  import('./Stage4View').then(m => ({ default: m.Stage4View }))
);
const FoundationView = lazy(() =>
  import('./FoundationView').then(m => ({ default: m.FoundationView }))
);
import { useCompanies, useActiveCompanyId } from '../stores/companyStore';
import { useProgress } from '../stores/offerStore';
import {
  useCurrentView,
  useStageStep,
} from '../stores/workflowStore';
import {
  useIsSynthesizing,
  useSynthesisReport,
  useSynthesisStage,
  useSynthesisActions,
} from '../stores/synthesisStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { runPipelineIntent } from '../services/pipelineOrchestrator';
import { useActiveTab, useWorkspaceTabActions, type WorkspaceTab } from '../stores/uiStore';

interface Props {
  onStartStage1: () => void;
  onSelectCompany: (id: string, phase?: 'company' | 'offer' | 'avatar') => void;
  onNavigateToStage: (
    view: 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'foundation',
    phase?: 'company' | 'offer' | 'avatar'
  ) => void;
  onProceedAfterSynthesis: () => void;
  onFinishStage1: () => void;
  onStartStage2: () => void;
  onGenerateOffer: (forceOverwrite?: boolean) => void;
  onCompleteAvatars: (avatars: Avatar[]) => void;
  onUpdateAvatars: (avatars: Avatar[]) => void;
}

/** Maps a workspace tab to the underlying `currentView` wizard step the
 * orchestration hook understands, so existing synthesis/offer flows keep
 * working without modification. */
const TAB_TO_VIEW: Record<WorkspaceTab, 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'foundation'> = {
  overview: 'stage1',
  evidence: 'stage2',
  segments: 'stage3',
  intelligence: 'stage3', // intelligence has no dedicated wizard step; keep pipeline context from segments
  strategy: 'stage4',
};

export function StageShell({
  onStartStage1,
  onSelectCompany,
  onNavigateToStage,
  onProceedAfterSynthesis,
  onFinishStage1,
  onStartStage2,
  onGenerateOffer,
  onCompleteAvatars,
  onUpdateAvatars,
}: Props) {
  const companies = useCompanies();
  const activeCompanyId = useActiveCompanyId();
  const activeCompany = companies.find(c => c.id === activeCompanyId);
  const progress = useProgress();
  const stageStep = useStageStep();
  const isSynthesizing = useIsSynthesizing();
  const synthesisReport = useSynthesisReport();
  const synthesisStage = useSynthesisStage();
  const { reset: resetSynthesis } = useSynthesisActions();

  const activeTab = useActiveTab();
  const { setActiveTab } = useWorkspaceTabActions();
  const currentView = useCurrentView();

  const systemState = usePipelineStore(s =>
    activeCompanyId ? (s.getSystemState(activeCompanyId) as 'up-to-date' | 'new-evidence' | 'analysing') : 'up-to-date'
  );

  /** User-triggered update — only runs when explicitly requested (Rule 4: no background analysis) */
  const handleRequestUpdate = () => {
    if (!activeCompany) return;
    runPipelineIntent(activeCompany, 'analyze_corpus', {});
  };

  /** Switching tabs keeps orchestration's `currentView`/`stageStep` in sync
   * via the existing navigation handler. Skipped when synthesis is running
   * to prevent the tab-sync from resetting stageStep mid-render and causing
   * an infinite update loop ("Maximum update depth exceeded"). */
  const handleTabSelect = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    // Do not call navigation handlers while synthesis is active — those calls
    // mutate currentView/stageStep and can collide with the in-progress
    // synthesis state updates, causing React to exceed its nested-update limit.
    if (isSynthesizing) return;
    const view = TAB_TO_VIEW[tab];
    if (view === 'stage1') onNavigateToStage('stage1');
    else if (view === 'stage2') onNavigateToStage('stage2');
    else if (view === 'stage3') onNavigateToStage('stage3');
    else if (view === 'stage4') onNavigateToStage('stage4');
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Persistent Next Best Action banner (Shopify Setup Guide style) */}
      <div className="px-6 pt-4">
        <NextBestAction />
      </div>

      {/* System state — visible when state is stale or in Evidence/Segments tabs (FIX FRICTION-05) */}
      {activeCompany && (systemState !== 'up-to-date' || activeTab === 'evidence' || activeTab === 'segments') && (
        <div className="px-6 mt-3 flex items-center justify-end">
          <SystemStateIndicator
            state={systemState}
            onRequestUpdate={systemState === 'new-evidence' ? handleRequestUpdate : undefined}
          />
        </div>
      )}

      <main className="flex-1 overflow-y-auto relative flex flex-col px-6 pt-4 pb-10">
        <AnimatePresence mode="wait">
          {isSynthesizing ? (
            <TransitionWrapper id="synthesis" key="synthesis">
              <ConsultantReport
                report={synthesisReport}
                isLoading={!synthesisReport}
                stageName={synthesisStage}
                onProceed={onProceedAfterSynthesis}
                onBack={() => {
                  resetSynthesis();
                }}
              />
            </TransitionWrapper>
          ) : (
            <TransitionWrapper id={`${activeTab}-${stageStep}-${currentView}`} key={`${activeTab}-${stageStep}-${currentView}`}>
              {currentView === 'foundation' ? (
                <Suspense fallback={<SectionFallback label="Loading your foundation…" />}>
                  <div className="space-y-4">
                    <button
                      onClick={() => handleTabSelect('strategy')}
                      className="text-[var(--text-sm)] font-medium text-[#0A84FF] hover:underline"
                    >
                      ← Back to Strategy
                    </button>
                    <FoundationView />
                  </div>
                </Suspense>
              ) : activeTab === 'overview' && (
                <Stage1Routes
                  onFinishStage1={onFinishStage1}
                  onStartStage1={onStartStage1}
                  onStartStage2={onStartStage2}
                />
              )}
              {currentView !== 'foundation' && activeTab === 'evidence' && (
                <Suspense fallback={<SectionFallback label="Loading your evidence workspace…" />}>
                  <Stage2Routes onGenerateOffer={onGenerateOffer} onUpdateAvatars={onUpdateAvatars} />
                </Suspense>
              )}
              {currentView !== 'foundation' && activeTab === 'segments' && (
                <Suspense fallback={<SectionFallback label="Loading your segments…" />}>
                  <Stage3Routes
                    onCompleteAvatars={onCompleteAvatars}
                    onUpdateAvatars={onUpdateAvatars}
                  />
                </Suspense>
              )}
              {currentView !== 'foundation' && activeTab === 'intelligence' && (
                <IntelligenceTab />
              )}
              {currentView !== 'foundation' && activeTab === 'strategy' && (
                <Suspense fallback={<SectionFallback label="Loading your strategy…" />}>
                  <div className="space-y-8">
                    <button
                      onClick={() => onNavigateToStage('foundation')}
                      className="text-[var(--text-sm)] font-medium text-[#0A84FF] hover:underline"
                    >
                      Answer foundation questions →
                    </button>
                    <Stage4View />
                  </div>
                </Suspense>
              )}
            </TransitionWrapper>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
