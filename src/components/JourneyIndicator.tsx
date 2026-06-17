/**
 * JourneyIndicator — 5-step journey progress indicator.
 * Replaces the technical stage/view navigation with a user-facing journey map.
 *
 * The five moments: Setup → Research → Patterns → Profiles → Intelligence
 *
 * @module src/components/JourneyIndicator
 */

import React from 'react';
import { motion } from 'motion/react';
import { Check, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePipelineStore } from '../stores/pipelineStore';
import { useActiveCompanyId } from '../stores/companyStore';

export type JourneyStep = 1 | 2 | 3 | 4 | 5;

export interface JourneyStepConfig {
  step: JourneyStep;
  id: string;
  label: string;
  sublabel: string;
}

export const JOURNEY_STEPS: JourneyStepConfig[] = [
  { step: 1, id: 'setup',        label: 'Setup',        sublabel: 'Company profile'         },
  { step: 2, id: 'research',     label: 'Research',     sublabel: 'Add evidence'             },
  { step: 3, id: 'patterns',     label: 'Patterns',     sublabel: 'Confirm themes'           },
  { step: 4, id: 'profiles',     label: 'Profiles',     sublabel: 'Customer profiles'        },
  { step: 5, id: 'intelligence', label: 'Intelligence', sublabel: 'Buying insights'          },
];

/** Maps pipeline phases to the highest unlocked journey step. */
export function getJourneyStep(phase?: string, stage1Complete?: boolean): JourneyStep {
  if (!stage1Complete) return 1;
  if (!phase || phase === 'company_complete') return 2;
  if (phase === 'corpus_analyzed' || phase === 'clusters_proposed') return 3;
  if (phase === 'clusters_validated' || phase === 'segments_materialized') return 4;
  if (phase === 'avatar_offers_ready' || phase === 'pipeline_complete') return 5;
  return 2;
}

interface JourneyIndicatorProps {
  currentView: string;
  onNavigate?: (stepId: string) => void;
  className?: string;
}

export const JourneyIndicator: React.FC<JourneyIndicatorProps> = ({
  currentView,
  onNavigate,
  className,
}) => {
  const activeCompanyId = useActiveCompanyId();
  const pipelineState = usePipelineStore(s =>
    activeCompanyId ? s.byCompany[activeCompanyId] : undefined
  );
  const legacyStage1 = usePipelineStore(s =>
    activeCompanyId ? s.getLegacyProgressFlags(activeCompanyId).stage1Complete : false
  );

  const highestUnlocked = getJourneyStep(pipelineState?.phase, legacyStage1);

  /** Map currentView to a journey step number for active highlighting */
  const activeStepNum: JourneyStep = (() => {
    if (currentView === 'stage1') return 1;
    if (currentView === 'stage2') return 2;
    if (currentView === 'stage3') return 3;
    if (currentView === 'foundation') return 4;
    if (currentView === 'stage4') return 5;
    return 1;
  })();

  /** Map journey step id back to a view for navigation */
  const stepIdToView: Record<string, string> = {
    setup:        'stage1',
    research:     'stage2',
    patterns:     'stage3',
    profiles:     'foundation',
    intelligence: 'stage4',
  };

  return (
    <nav
      className={cn(
        'w-full bg-[var(--color-card-bg)]/90 backdrop-blur-2xl border-b border-[var(--color-border-default)]',
        'sticky top-0 z-[50]',
        className
      )}
      aria-label="Journey progress"
    >
      <div className="max-w-[860px] mx-auto px-4">
        <div className="flex items-center relative">
          {/* Connecting line */}
          <div className="absolute left-[calc(10%)] right-[calc(10%)] top-[32px] h-px bg-[var(--color-border-default)]" />

          {JOURNEY_STEPS.map(({ step, id, label, sublabel }) => {
            const isCompleted   = step < highestUnlocked || (step === highestUnlocked && step < activeStepNum);
            const isActive      = step === activeStepNum;
            const isUnlocked    = step <= highestUnlocked;
            const isLocked      = !isUnlocked;

            return (
              <button
                key={id}
                onClick={() => {
                  if (isUnlocked && onNavigate) onNavigate(stepIdToView[id]);
                }}
                disabled={isLocked}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex flex-col items-center gap-2 py-4 flex-1 relative transition-all group',
                  isActive  && 'text-[#0A84FF]',
                  !isActive && isUnlocked  && 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer',
                  isLocked  && 'text-[var(--color-text-secondary)] opacity-30 cursor-not-allowed'
                )}
              >
                {/* Step bubble */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-sm)] font-semibold z-10 border-2 transition-all duration-300',
                    isCompleted && 'bg-[#0A84FF] border-[#0A84FF] text-white shadow-[0_0_12px_rgba(10,132,255,0.4)]',
                    isActive    && !isCompleted && 'bg-[#0A84FF]/10 border-[#0A84FF] text-[#0A84FF] shadow-[0_0_20px_rgba(10,132,255,0.25)]',
                    !isActive   && isUnlocked && !isCompleted && 'bg-[var(--color-card-bg)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] group-hover:border-[var(--color-text-primary)]',
                    isLocked    && 'bg-[var(--color-card-bg)] border-[var(--color-border-default)] text-[var(--color-text-tertiary)]'
                  )}
                >
                  {isCompleted ? (
                    <Check size={16} strokeWidth={3} />
                  ) : isLocked ? (
                    <Lock size={12} strokeWidth={2.5} />
                  ) : (
                    <span>{step}</span>
                  )}
                </div>

                {/* Labels */}
                <div className="text-center leading-tight">
                  <div className={cn(
                    'text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'
                  )}>
                    {label}
                  </div>
                  {isActive && (
                    <div className="text-[var(--text-xs)] text-[var(--color-text-secondary)] font-medium mt-0.5 whitespace-nowrap">
                      {sublabel}
                    </div>
                  )}
                </div>

                {/* Active underline */}
                {isActive && (
                  <motion.div
                    layoutId="journeyIndicator"
                    className="absolute bottom-0 left-4 right-4 h-[3px] bg-[#0A84FF] rounded-t-full shadow-[0_-4px_12px_rgba(10,132,255,0.35)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
