import React, { useState } from 'react';
import { Avatar } from '../types';
import { AvatarMethodSelector } from '../components/stage3/AvatarMethodSelector';
import { AIGeneratedAvatarWizard } from '../components/stage3/AIGeneratedAvatarWizard';
import { AvatarDashboard } from '../components/stage3/AvatarDashboard'; // FIX HIDDEN-01: Added
import { CompanyMiningWorkspace } from '../features/corpus/components/CompanyMiningWorkspace';
import { useCompanies, useActiveCompanyId, useCompanyActions } from '../stores/companyStore';
import { useOffers, useProgress } from '../stores/offerStore';
import { useAvatarMethod, useWorkflowActions } from '../stores/workflowStore';
import { useStageInsights, useIsInsightsLoading, useInsightsActions } from '../stores/insightsStore';
import { ProgressRewardModal } from '../components/ProgressRewardModal';
import { useCorpusStore } from '../features/corpus/store';
import { IntelligenceCompletenessBar } from '../components/IntelligenceCompletenessBar';

interface Props {
  onCompleteAvatars: (avatars: Avatar[]) => void;
  onUpdateAvatars: (avatars: Avatar[]) => void;
}

export function Stage3Routes({ onCompleteAvatars, onUpdateAvatars }: Props) {
  const companies = useCompanies();
  const activeCompanyId = useActiveCompanyId();
  const activeCompany = companies.find(c => c.id === activeCompanyId);
  const { setCompanies } = useCompanyActions();
  const offers = useOffers();
  const progress = useProgress();
  const avatarMethod = useAvatarMethod();
  const { setAvatarMethod } = useWorkflowActions();
  const stageInsights = useStageInsights();
  const isInsightsLoading = useIsInsightsLoading();
  const { loadStageInsights } = useInsightsActions();

  // FIX #3: track whether user wants to start a brand-new wizard from the dashboard
  const [showNewWizard, setShowNewWizard] = useState(false);

  const avatars = progress[activeCompanyId!]?.avatars || [];
  const corpus = useCorpusStore(s => activeCompanyId ? s.corpora[activeCompanyId] : null);

  // Reset showNewWizard when company changes
  const prevCompanyIdRef = React.useRef(activeCompanyId);
  React.useEffect(() => {
    if (prevCompanyIdRef.current !== activeCompanyId) {
      prevCompanyIdRef.current = activeCompanyId;
      setShowNewWizard(false);
      setAvatarMethod(null);
    }
  }, [activeCompanyId]);

  // Progress reward: show once when first Customer Profile is created (Addendum A §2.6 Rule 7)
  const [rewardAvatar, setRewardAvatar] = React.useState<import('../types').Avatar | null>(null);
  const [showReward, setShowReward] = React.useState(false);
  const rewardShownRef = React.useRef(false);

  React.useEffect(() => {
    if (!rewardShownRef.current && avatars.length > 0 && !showReward) {
      rewardShownRef.current = true;
      setRewardAvatar(avatars[0]);
      setShowReward(true);
    }
  }, [avatars.length]);
  const offer = activeCompanyId ? offers[activeCompanyId] : undefined;

  if (!activeCompany || !activeCompanyId) return null;

  const wrapUpdate = (updated: Avatar[]) => {
    onUpdateAvatars(updated);
  };

  // FIX #3: Determine display mode
  // hasExistingAvatars + not in wizard flow → show dashboard
  // showNewWizard or avatarMethod set → show wizard
  const hasExistingAvatars = avatars.length > 0;
  const isInWizardFlow = showNewWizard || (avatarMethod !== null && avatarMethod !== undefined);

  return (
    <>
    {/* Progress Reward Modal — first Customer Profile milestone (Addendum A §2.6 Rule 7) */}
    {rewardAvatar && (
      <ProgressRewardModal
        isOpen={showReward}
        onClose={() => setShowReward(false)}
        onViewIntelligence={() => {
          setShowReward(false);
          setAvatarMethod(null);
        }}
        avatar={rewardAvatar}
        evidenceCount={corpus?.messages.length ?? 0}
        patternCount={corpus?.clusters.filter(c => c.status !== 'merged').length ?? 0}
        topInsight={(rewardAvatar as any).generation?.dominantProblems?.[0]?.problem}
      />
    )}
    <div className="pt-4">
      {/* FIX HIDDEN-01: If avatars exist and we are NOT in an active wizard, show full AvatarDashboard */}
      {hasExistingAvatars && !isInWizardFlow ? (
        <>
          {/* FRICTION-02: Show completeness bar so user knows coverage status */}
          <div className="mb-6">
            <IntelligenceCompletenessBar />
          </div>
        <AvatarDashboard
          company={activeCompany}
          offer={
            offer || {
              companyId: activeCompanyId,
              product: '',
              relevance: '',
              reason: '',
              audience: '',
              transformation: '',
              generatedOffer: '',
              generatedAt: new Date().toISOString(),
            }
          }
          avatars={avatars}
          onAvatarsEvolved={wrapUpdate}
          onSelectAvatar={() => {}}
          onAddEvidenceToProfile={() => {}}
          onViewBuyingTriggers={() => {}}
          onViewSourcePatterns={() => {}}
        />
        </>
      ) : !isInWizardFlow && !avatarMethod ? (
        /* No avatars yet and no wizard active: show method selector */
        <AvatarMethodSelector onSelect={m => setAvatarMethod(m)} />
      ) : avatarMethod === 'ai' || showNewWizard ? (
        <AIGeneratedAvatarWizard
          company={activeCompany}
          offer={
            offer || {
              companyId: activeCompanyId,
              product: '',
              relevance: '',
              reason: '',
              audience: '',
              transformation: '',
              generatedOffer: '',
              generatedAt: new Date().toISOString(),
            }
          }
          strategicReport={progress[activeCompanyId]?.synthesisReports?.['Strategy']}
          onComplete={completed => {
            setShowNewWizard(false);
            setAvatarMethod(null);
            onCompleteAvatars(completed);
          }}
          onBack={() => {
            setShowNewWizard(false);
            setAvatarMethod(null);
          }}
          onUpdateCompany={updated => {
            setCompanies(prev => prev.map(c => (c.id === updated.id ? updated : c)));
          }}
          onAvatarsGenerated={avs => {
            const tagged = avs.map(a => ({
              ...a,
              acquisitionSource: a.acquisitionSource || ('ai' as const),
              validationStatus: a.validationStatus || ('provisional' as const),
            }));
            loadStageInsights('avatars', { avatars: tagged }, activeCompany);
            wrapUpdate(tagged);
          }}
          onDeepDiveComplete={avatar => {
            loadStageInsights('deepdive', { avatar }, activeCompany);
          }}
          insights={
            stageInsights[`${activeCompanyId}-avatars`] ||
            stageInsights[`${activeCompanyId}-deepdive`] ||
            []
          }
          isInsightsLoading={isInsightsLoading}
        />
      ) : avatarMethod === 'mining' ? (
        <div className="space-y-6">
          <p className="text-center text-[var(--text-sm)] text-[#86868B] max-w-[560px] mx-auto">
            Primary path: evidence is managed in Stage 2. Refine clusters here or return to
            Evidence to add quotes.
          </p>
          <CompanyMiningWorkspace
            company={activeCompany}
            avatars={avatars}
            onAvatarsUpdated={wrapUpdate}
          />
          <div className="flex justify-center gap-4 pb-12">
            <button
              type="button"
              onClick={() => setAvatarMethod(null)}
              className="px-6 py-3 rounded-[var(--radius-sm)] text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-[#86868B]"
            >
              Change method
            </button>
            <button
              type="button"
              onClick={() => onCompleteAvatars(avatars)}
              className="px-8 py-3 rounded-[var(--radius-sm)] bg-[#1D1D1F] text-white text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em]"
            >
              Save segments
            </button>
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
}
