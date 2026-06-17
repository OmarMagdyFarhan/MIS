import React from 'react';
import { motion } from 'motion/react';
import { Building2, Sparkles, UserCircle2, BarChart3, Megaphone, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { Progress } from '../types';
import { usePipelineStore } from '../stores/pipelineStore';
import { isStageUnlockedForPipeline } from '../lib/pipelineGraph';

interface PhaseNavProps {
  currentView: 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5' | 'foundation';
  currentStep?: number;
  progress?: Progress;
  companyId?: string;
  onNavigate: (view: any, step?: number) => void;
}

export const PhaseNav: React.FC<PhaseNavProps> = ({
  currentView,
  progress,
  companyId,
  onNavigate,
}) => {
  const pipelineState = usePipelineStore(s =>
    companyId ? s.byCompany[companyId] : undefined
  );
  const pipelinePhase = pipelineState?.phase;
  const stale = pipelineState?.stale;
  const acquisitionMode = pipelineState?.acquisitionMode;

  const stages = [
    { id: 'stage1',     label: 'Company',      icon: Building2,   required: true },
    { id: 'stage2',     label: 'Evidence',     icon: Sparkles,    required: true },
    { id: 'stage3',     label: 'Segments',     icon: UserCircle2, required: true },
    { id: 'foundation', label: 'Foundations',  icon: Layers,      required: true },
    { id: 'stage4',     label: 'Intelligence', icon: BarChart3,   required: false },
    { id: 'stage5',     label: 'Strategy',     icon: Megaphone,   required: false },
  ];

  const isUnlocked = (stageId: string, index: number) => {
    if (index === 0) return true;
    if (!progress?.stage1Complete) return false;
    if (stageId === 'stage2') return progress.stage1Complete;
    if (stageId === 'stage3') return progress.stage1Complete;
    if (stageId === 'foundation') {
      return (
        progress.stage1Complete &&
        (pipelinePhase === 'clusters_validated' ||
         pipelinePhase === 'segments_materialized' ||
         pipelinePhase === 'avatar_offers_ready' ||
         pipelinePhase === 'pipeline_complete' ||
         !!progress.stage3Complete)
      );
    }
    if (stageId === 'stage4') {
      return (
        pipelinePhase === 'avatar_offers_ready' ||
        pipelinePhase === 'pipeline_complete'
      );
    }
    if (stageId === 'stage5') {
      return (
        pipelinePhase === 'pipeline_complete'
      );
    }
    if (pipelinePhase) return isStageUnlockedForPipeline(stageId, pipelinePhase);
    return false;
  };

  const hasStale =
    stale &&
    (stale.avatarOffers || stale.clusters || stale.avatars);

  return (
    <div className="w-full bg-[var(--color-card-bg)]/80 backdrop-blur-2xl border-b border-[var(--color-border-default)] sticky top-[80px] z-[40]">
      {pipelinePhase && companyId && (
        <div className="max-w-[860px] mx-auto px-4 pt-2 flex flex-wrap items-center gap-2 text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]">
          <span className="text-[#86868B]">Pipeline: {pipelinePhase.replace(/_/g, ' ')}</span>
          {acquisitionMode && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-background-tertiary)] text-[var(--color-text-tertiary)]">
              {acquisitionMode.replace(/_/g, ' ')}
            </span>
          )}
          {hasStale && (
            <span className="px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-500/30">
              Stale — recalculate
            </span>
          )}
        </div>
      )}
      <div className="max-w-[860px] mx-auto flex items-center justify-between px-4">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const unlocked = isUnlocked(stage.id, index);
          const active = currentView === stage.id;

          return (
            <button
              key={stage.id}
              onClick={() => {
                if (unlocked) {
                  onNavigate(stage.id);
                }
              }}
              disabled={!unlocked}
              className={cn(
                "flex flex-col items-center gap-3 py-4 px-1 flex-1 relative transition-all group",
                active
                  ? "text-[#0A84FF]"
                  : "text-[var(--color-text-secondary)]",
                !unlocked && "opacity-20 cursor-not-allowed grayscale",
                unlocked && !active && "hover:text-[var(--color-text-primary)] cursor-pointer"
              )}
            >
              <div className={cn(
                "w-11 h-11 rounded-[var(--radius-md)] flex items-center justify-center transition-all duration-500",
                active
                  ? "bg-[#0A84FF]/10 shadow-inner"
                  : "bg-transparent group-hover:bg-[var(--color-slate-elevated)]"
              )}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.5} className={cn("transition-transform duration-500", active && "scale-110")} />
              </div>
              <span className={cn(
                "text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] transition-opacity",
                active ? "opacity-100" : "opacity-30 group-hover:opacity-60"
              )}>
                {stage.label}
              </span>

              {/* Active Indicator Bar */}
              {active && (
                <motion.div
                  layoutId="phaseIndicator"
                  className="absolute bottom-0 left-3 right-3 h-[4px] bg-[#0A84FF] rounded-t-full shadow-[0_-4px_15px_rgba(10,132,255,0.4)]"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
