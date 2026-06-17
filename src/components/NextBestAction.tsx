/**
 * NextBestAction — persistent, single-suggestion banner (Shopify Setup
 * Guide style) shown in the workspace shell. Reads from existing stores
 * via nextBestActionService; never auto-triggers pipeline runs.
 *
 * @module src/components/NextBestAction
 */

import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useActiveCompanyId } from '../stores/companyStore';
import { useProgress } from '../stores/offerStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { useCorpusStore } from '../features/corpus/store';
import { useWorkspaceTabActions } from '../stores/uiStore';
import { getNextBestAction } from '../services/nextBestActionService';
import { useWorkflowOrchestration } from '../hooks/useWorkflowOrchestration';

export const NextBestAction: React.FC<{ className?: string }> = ({ className }) => {
  const activeCompanyId = useActiveCompanyId();
  const progress = useProgress();
  const { setActiveTab } = useWorkspaceTabActions();
  const { handleSelectCompany, handleNavigateToStage: onNavigateToStage } = useWorkflowOrchestration();

  const pipelineState = usePipelineStore(s =>
    activeCompanyId ? s.byCompany[activeCompanyId] : undefined
  );

  const corpus = useCorpusStore(s =>
    activeCompanyId ? s.corpora[activeCompanyId] : undefined
  );

  if (!activeCompanyId) return null;

  const companyProgress = progress[activeCompanyId];
  const avatars = companyProgress?.avatars ?? [];
  const messages = corpus?.messages ?? [];
  const clusters = corpus?.clusters ?? [];

  const action = getNextBestAction({
    pipelineState,
    progress: companyProgress,
    avatars,
    messageCount: messages.length,
    analyzedMessageCount: messages.filter(m => m.analyzed).length,
    validatedClusterCount: clusters.filter(c => c.validationStatus === 'validated').length,
    proposedClusterCount: clusters.filter(c => c.status === 'proposed').length,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      aria-live="polite"
      className={cn(
        'w-full flex items-center justify-between gap-4 px-5 py-3.5 rounded-[var(--radius-md)] border',
        action.isComplete
          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-700/30'
          : 'bg-[#0A84FF]/5 border-[#0A84FF]/20',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0',
            action.isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[#0A84FF]/10 text-[#0A84FF]'
          )}
        >
          {action.isComplete ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
        </div>
        <div className="min-w-0">
          <p className="text-[var(--text-sm)] font-bold text-[var(--color-text-primary)] truncate">
            {action.title}
          </p>
          {action.detail && (
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] truncate">
              {action.detail}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          // FIX NAV-01: Corrected tabToStageMap - Intelligence should map to stage3, not stage4
          const tabToStageMap: Record<string, string> = {
            'overview': 'stage1',
            'evidence': 'stage2',
            'segments': 'stage3',
            'intelligence': 'stage3',  // ✅ FIXED: Intelligence is stage3, not stage4
            'strategy': 'stage4'
          };
          handleSelectCompany(activeCompanyId);
          onNavigateToStage((tabToStageMap[action.targetTab] || 'stage1') as 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'foundation');
        }}
        className={cn(
          'shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-full)] text-[var(--text-sm)] font-medium transition-all active:scale-95',
          action.isComplete
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-[#0A84FF] text-white hover:opacity-90'
        )}
      >
        {action.actionLabel}
        <ArrowRight size={12} />
      </button>
    </motion.div>
  );
};
