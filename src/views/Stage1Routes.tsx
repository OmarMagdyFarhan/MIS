import React from 'react';
import { Step1Name } from '../components/stage1/Step1Name';
import { Step2Industry } from '../components/stage1/Step2Industry';
import { Step3Specialization } from '../components/stage1/Step3Specialization';
import { Step4USP } from '../components/stage1/Step4USP';
import { SuccessScreen } from '../components/stage1/SuccessScreen';
import { ActionableInsightsCard } from '../components/intel/ActionableInsightsCard';
import { useDraftCompany, useCompanyActions, useCompanies, useActiveCompanyId } from '../stores/companyStore';
import { useProgress } from '../stores/offerStore';
import { useStageStep, useWorkflowActions } from '../stores/workflowStore';
import { useStageInsights, useIsInsightsLoading } from '../stores/insightsStore';

interface Props {
  onFinishStage1: () => void;
  onStartStage1: () => void;
  onStartStage2: () => void;
}

export function Stage1Routes({ onFinishStage1, onStartStage1, onStartStage2 }: Props) {
  const draftCompany = useDraftCompany();
  const { setDraftCompany } = useCompanyActions();
  const companies = useCompanies();
  const activeCompanyId = useActiveCompanyId();
  const activeCompany = companies.find(c => c.id === activeCompanyId);
  const progress = useProgress();
  const stageStep = useStageStep();
  const { setStageStep } = useWorkflowActions();
  const stageInsights = useStageInsights();
  const isInsightsLoading = useIsInsightsLoading();

  const isStageComplete = progress[activeCompany?.id || '']?.stage1Complete;

  return (
    <div className="pt-4">
      {stageStep === 1 && (
        <Step1Name
          name={draftCompany.name || ''}
          logoUrl={draftCompany.logoUrl || ''}
          country={draftCompany.country || 'Global'}
          websiteUrl={draftCompany.websiteUrl || ''}
          onNameChange={(name) => setDraftCompany({ ...draftCompany, name })}
          onLogoChange={(logoUrl) => setDraftCompany({ ...draftCompany, logoUrl })}
          onCountryChange={(country) => setDraftCompany({ ...draftCompany, country, isGlobalMode: country === 'Global' })}
          onWebsiteChange={(websiteUrl) => setDraftCompany({ ...draftCompany, websiteUrl })}
          onContinue={() => setStageStep(2)}
          onStepNav={(s) => setStageStep(s)}
          isStageComplete={isStageComplete}
        />
      )}
      {stageStep === 2 && (
        <Step2Industry
          value={draftCompany.industry || ''}
          logoUrl={draftCompany.logoUrl}
          onChange={(industry) => setDraftCompany({ ...draftCompany, industry, specializations: [] })}
          onContinue={() => setStageStep(3)}
          onBack={() => setStageStep(1)}
          onStepNav={(s) => setStageStep(s)}
          isStageComplete={isStageComplete}
        />
      )}
      {stageStep === 3 && (
        <Step3Specialization
          industry={draftCompany.industry || ''}
          logoUrl={draftCompany.logoUrl}
          values={draftCompany.specializations || []}
          onChange={(specializations) => setDraftCompany({ ...draftCompany, specializations })}
          onContinue={() => setStageStep(4)}
          onBack={() => setStageStep(2)}
          onStepNav={(s) => setStageStep(s)}
          isStageComplete={isStageComplete}
        />
      )}
      {stageStep === 4 && (
        <Step4USP
          companyName={draftCompany.name || ''}
          industry={draftCompany.industry || ''}
          logoUrl={draftCompany.logoUrl}
          specializations={(draftCompany.specializations || []).map(s => s.name)}
          value={draftCompany.usp || ''}
          onChange={(usp) => setDraftCompany({ ...draftCompany, usp })}
          onSave={onFinishStage1}
          onBack={() => setStageStep(3)}
          onStepNav={(s) => setStageStep(s)}
          isStageComplete={isStageComplete}
        />
      )}
      {stageStep === 5 && (
        <div className="space-y-0">
          <SuccessScreen
            companyName={draftCompany.name || ''}
            onAddAnother={onStartStage1}
            onBuildOffer={onStartStage2}
            onStepNav={(s) => setStageStep(s)}
          />
          <ActionableInsightsCard
            insights={stageInsights[`${activeCompanyId}-company`] || []}
            isLoading={isInsightsLoading}
            onAction={(ins) => {
              if (ins.action.toLowerCase().includes('pick one specialization')) {
                setStageStep(3);
              } else if (ins.action.toLowerCase().includes('country')) {
                setStageStep(1);
              } else {
                setStageStep(4);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
