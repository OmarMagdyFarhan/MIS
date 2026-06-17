import React from 'react';
import { GeneratingScreen } from '../components/stage2/GeneratingScreen';
import { CompanyMiningWorkspace } from '../features/corpus/components/CompanyMiningWorkspace';
import { IntelligenceCompletenessBar } from '../components/IntelligenceCompletenessBar';
import { useCompanies, useActiveCompanyId } from '../stores/companyStore';
import {
  useProgress,
  useIsGenerating,
  useOfferActions,
} from '../stores/offerStore';
import { useStageStep, useWorkflowActions } from '../stores/workflowStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { syncProgressWithPipeline } from '../lib/pipelineMigration';

interface Props {
  onGenerateOffer: (forceOverwrite?: boolean) => void;
  onUpdateAvatars: (avatars: import('../types').Avatar[]) => void;
}

export function Stage2Routes({ onUpdateAvatars }: Props) {
  const companies = useCompanies();
  const activeCompanyId = useActiveCompanyId();
  const activeCompany = companies.find(c => c.id === activeCompanyId);
  const progress = useProgress();
  const isGenerating = useIsGenerating();
  const { setProgress } = useOfferActions();
  const stageStep = useStageStep();
  const { setCurrentView, setStageStep } = useWorkflowActions();

  const avatars = progress[activeCompanyId || '']?.avatars || [];

  const handleAvatarsFromMining = (updated: import('../types').Avatar[]) => {
    if (!activeCompanyId) return;
    setProgress(prev => ({
      ...prev,
      [activeCompanyId]: syncProgressWithPipeline(
        {
          ...prev[activeCompanyId],
          avatars: updated,
          stage1Complete: true,
          stage2Complete: prev[activeCompanyId]?.stage2Complete ?? false,
          stage3Complete: prev[activeCompanyId]?.stage3Complete ?? false,
        },
        activeCompanyId
      ),
    }));
    onUpdateAvatars(updated);
    usePipelineStore.getState().setPhase(activeCompanyId, 'segments_materialized');
  };

  if (!activeCompany) return null;

  return (
    <div className="pt-4 space-y-4">
      <div className="max-w-7xl mx-auto px-4">
        <IntelligenceCompletenessBar />
      </div>
      {isGenerating ? (
        <GeneratingScreen />
      ) : (
        <CompanyMiningWorkspace
          company={activeCompany}
          avatars={avatars}
          onAvatarsUpdated={handleAvatarsFromMining}
          onContinue={() => {
            setCurrentView('stage3');
            setStageStep(1);
          }}
        />
      )}
    </div>
  );
}
