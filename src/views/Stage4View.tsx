import React from 'react';
import { BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import { StrategicScaling } from '../components/stage4/StrategicScaling';
import { TransitionWrapper } from '../components/TransitionWrapper';
import { useCompanies, useActiveCompanyId } from '../stores/companyStore';
import { useOffers, useProgress } from '../stores/offerStore';
import { useWorkflowActions } from '../stores/workflowStore';
import { useToastActions, useToasts } from '../stores/uiStore';
import { useWorkflowOrchestration } from '../hooks/useWorkflowOrchestration';
import { useWorkspaceTabActions as useUITabActions } from '../stores/uiStore';
import { useCorpusStore } from '../features/corpus/store';

export function Stage4View() {
  const companies = useCompanies();
  const activeCompanyId = useActiveCompanyId();
  const offers = useOffers();
  const progress = useProgress();
  const { setCurrentView } = useWorkflowActions();
  const { showSuccess: showSuccessToastMsg } = useToastActions();
  const { dismissSuccess } = useToasts();
  const { handleNavigateToStage: onNavigateToStage } = useWorkflowOrchestration();
  const { setActiveTab } = useUITabActions(); // FIX NAV-02: Added to sync sidebar

  const activeCompany = companies.find(c => c.id === activeCompanyId);
  const currentOffer = activeCompanyId ? offers[activeCompanyId] : null;
  const currentAvatars = activeCompanyId ? (progress[activeCompanyId]?.avatars || []) : [];
  const corpus = useCorpusStore(s => activeCompanyId ? s.corpora[activeCompanyId] : null);

  React.useEffect(() => {
    if (!activeCompany) {
      setCurrentView('returning');
    }
  }, [activeCompany, setCurrentView]);

  if (!activeCompany) return null;

  // Show a prompt to generate the offer if not yet done
  if (!currentOffer) {
    // NEW-01: checklist of what's missing
    const hasEvidence = (corpus?.messages?.length ?? 0) >= 5;
    const hasClusters = corpus?.clusters?.some(c => c.validationStatus === 'validated') ?? false;
    const hasAvatars = currentAvatars.length > 0;

    const CheckItem = ({ done, label }: { done: boolean; label: string }) => (
      <div className="flex items-center gap-2 text-sm">
        {done
          ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          : <XCircle size={16} className="text-red-400 shrink-0" />}
        <span className={done ? 'text-[var(--color-text-secondary)] line-through' : 'text-[var(--color-text-primary)] font-medium'}>
          {label}
        </span>
      </div>
    );

    return (
      <TransitionWrapper id="stage4-empty">
        <div className="bg-[var(--color-primary-bg)] flex items-center justify-center py-12">
          <div className="max-w-md text-center space-y-6 p-8">
            <div className="w-16 h-16 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] border border-[var(--color-border-default)] flex items-center justify-center mx-auto">
              <BarChart3 size={28} className="text-[var(--color-accent-blue)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Insights Not Ready Yet</h2>
            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
              Complete these steps to unlock buying insights:
            </p>
            <div className="text-left space-y-3 bg-[var(--color-card-bg)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] p-4">
              <CheckItem done={hasEvidence} label="Evidence Added (5+ messages)" />
              <CheckItem done={hasClusters} label="Clusters Validated" />
              <CheckItem done={hasAvatars} label="Customer Profiles Built" />
            </div>
            <button
              onClick={() => {
                // FIX NAV-02: Also update active tab so sidebar syncs
                onNavigateToStage('stage2');
                setActiveTab('evidence');
              }}
              className="px-6 py-3 rounded-[var(--radius-sm)] bg-[var(--color-accent-blue)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Go to Evidence Mining →
            </button>
          </div>
        </div>
      </TransitionWrapper>
    );
  }

  return (
    <TransitionWrapper id="stage4">
      <StrategicScaling
        company={activeCompany}
        offer={currentOffer}
        avatars={currentAvatars}
        onComplete={() => {
          showSuccessToastMsg('Strategic Blueprints Ready in Hub!');
          setTimeout(() => dismissSuccess(), 3500);
          setCurrentView('returning');
        }}
      />
    </TransitionWrapper>
  );
}
