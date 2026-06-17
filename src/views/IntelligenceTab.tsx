/**
 * IntelligenceTab — workspace tab (Phase 16).
 * - Task 5: Fixed all empty states with meaningful copy.
 * - Task 3: "Launch Implementation" fires onAction with the first critical insight.
 * - FIX #9: Avatar quick-access panel — shows existing profiles and navigates to Segments.
 * - FIX (bug): was calling `onNavigateToStage` which doesn't exist; corrected to `handleNavigateToStage`.
 * FeelWheel promoted to hero section. Market intel, Buying insights, Actionable insights follow.
 */
import React from 'react';
import { Sparkles, BookOpen, AlertCircle, Users } from 'lucide-react';
import { FeelWheel } from '../components/intel/FeelWheel';
import { EmptyState } from '../components/EmptyState';
import { MarketIntelligencePanel } from '../components/intel/MarketIntelligencePanel';
import { BuyingInsightsPanel } from '../components/intel/BuyingInsightsPanel';
import { ActionableInsightsCard } from '../components/intel/ActionableInsightsCard';
import { useCompanyEmotionMessages } from '../hooks/useCompanyEmotionMessages';
import { useActiveCompany, useActiveCompanyId, useCompanies } from '../stores/companyStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { useStageInsights, useIsInsightsLoading } from '../stores/insightsStore';
import { useProgress } from '../stores/offerStore';
import { useWorkflowOrchestration } from '../hooks/useWorkflowOrchestration';
import type { ActionableInsight, Avatar } from '../types';

export function IntelligenceTab() {
  const activeCompany = useActiveCompany();
  const activeCompanyId = useActiveCompanyId();
  const companies = useCompanies();
  const marketIntelligence = usePipelineStore(s => s.marketIntelligence);
  const allStageInsights = useStageInsights();
  const isInsightsLoading = useIsInsightsLoading();
  const progress = useProgress();

  // FIX (bug): was destructured as `onNavigateToStage` which is not exported by
  // useWorkflowOrchestration — the correct name is `handleNavigateToStage`.
  const { handleNavigateToStage } = useWorkflowOrchestration();

  // FIX #9: get avatars for quick-access panel
  const avatars: Avatar[] = activeCompanyId ? (progress[activeCompanyId]?.avatars || []) : [];

  const stageInsights = React.useMemo(() => {
    if (!activeCompany) return [];
    return Object.entries(allStageInsights)
      .filter(([key]) => key.startsWith(`${activeCompany.id}-`))
      .flatMap(([, insights]) => insights);
  }, [allStageInsights, activeCompany]);

  const messages = useCompanyEmotionMessages(activeCompany?.id);
  const analyzedMessages = React.useMemo(
    () => messages.filter(m => m.analyzed && m.analysis?.emotion),
    [messages]
  );

  const hasMarketIntel = activeCompany && marketIntelligence[activeCompany.id];

  // FIX (bug): was calling onNavigateToStage (undefined) — now calls handleNavigateToStage
  function handleAction(insight: ActionableInsight) {
    if (insight.action === 'strategy') {
      handleNavigateToStage('stage4');
    } else if (insight.action === 'evidence') {
      handleNavigateToStage('stage2');
    } else if (insight.action === 'segments') {
      handleNavigateToStage('stage3');
    } else if (insight.action === 'foundation') {
      handleNavigateToStage('stage1');
    }
  }

  if (!activeCompany) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No project selected"
        description="Choose a project from the sidebar to see its customer intelligence."
      />
    );
  }

  return (
    <div className="space-y-10 pb-16">

      {/* FIX #9: Avatar quick-access panel — visible at top of Intelligence tab */}
      {avatars.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-[var(--color-text-secondary)]" />
              <h3 className="text-[var(--text-base)] font-bold text-[var(--color-text-primary)]">
                Customer profiles ({avatars.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleNavigateToStage('stage3')}
              className="text-[var(--text-sm)] font-semibold text-[var(--color-accent)] hover:underline"
            >
              View all →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {avatars.slice(0, 6).map(avatar => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => handleNavigateToStage('stage3')}
                className="text-left rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] px-4 py-3 hover:border-[var(--color-accent)] transition-colors"
              >
                <p className="text-[var(--text-sm)] font-bold text-[var(--color-text-primary)] truncate">
                  {avatar.name}
                </p>
                {avatar.transformation?.hook && (
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-0.5 line-clamp-1 italic">
                    "{avatar.transformation.hook}"
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Hero: FeelWheel */}
      <section>
        <div className="mb-4">
          <h2 className="text-[var(--text-lg)] font-extrabold text-[var(--color-text-primary)]">Emotional landscape</h2>
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            How {activeCompany.name}'s customers feel, drawn from {messages.length} analyzed quote{messages.length === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] overflow-hidden">
          {messages.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No evidence collected yet"
              description="Add customer quotes in the Evidence tab, then run the pipeline to map their emotional landscape here."
              className="!border-0 !rounded-none py-12"
            />
          ) : analyzedMessages.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title={`${messages.length} quote${messages.length > 1 ? 's' : ''} waiting for analysis`}
              description="Run the pipeline to extract emotional signals from your evidence. The wheel will populate once analysis completes."
              className="!border-0 !rounded-none py-12"
            />
          ) : (
            <FeelWheel messages={analyzedMessages} />
          )}
        </div>
      </section>

      {/* Market intelligence */}
      <section>
        <h3 className="text-[var(--text-base)] font-bold text-[var(--color-text-primary)] mb-3">Market intelligence</h3>
        {!hasMarketIntel ? (
          <EmptyState
            icon={Sparkles}
            title="Market intelligence isn't ready yet"
            description="Run the full pipeline with at least 10 analyzed quotes to generate market-level intelligence."
            className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] py-10"
          />
        ) : (
          <MarketIntelligencePanel companies={[activeCompany]} marketIntelligence={marketIntelligence} />
        )}
      </section>

      {/* Buying insights */}
      <section>
        <h3 className="text-[var(--text-base)] font-bold text-[var(--color-text-primary)] mb-3">Buying signals</h3>
        <BuyingInsightsPanel companyId={activeCompany.id} />
      </section>

      {/* Actionable insights with Task 3 wiring */}
      {stageInsights.length > 0 || isInsightsLoading ? (
        <section>
          <h3 className="text-[var(--text-base)] font-bold text-[var(--color-text-primary)] mb-3">Actionable insights</h3>
          <ActionableInsightsCard
            insights={stageInsights}
            isLoading={isInsightsLoading}
            onAction={handleAction}
          />
        </section>
      ) : null}

      {/* Reference to companies count for cross-company context */}
      {companies.length > 1 && (
        <p className="text-[var(--text-xs)] text-[var(--color-text-tertiary)]">
          Showing intelligence for {activeCompany.name}. Switch projects in the sidebar to compare.
        </p>
      )}
    </div>
  );
}
