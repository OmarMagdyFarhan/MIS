/**
 * SystemStateIndicator — persistent signal showing the analysis state.
 *
 * Three states:
 *  - up-to-date  : all analysis reflects current evidence
 *  - new-evidence: new evidence added since last analysis (action available)
 *  - analysing   : a named operation is currently running
 *
 * Rule: "No background analysis. No surprise re-generations. The user is always in control."
 *
 * @module src/components/SystemStateIndicator
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePipelineStore } from '../stores/pipelineStore';
import { useActiveCompanyId } from '../stores/companyStore';

export type SystemState = 'up-to-date' | 'new-evidence' | 'analysing';

interface SystemStateIndicatorProps {
  /** Override state (for controlled usage). Falls back to store state. */
  state?: SystemState;
  /** Name of the running operation — shown when state = 'analysing'. */
  operationLabel?: string;
  /** Called when user clicks "Update analysis" in new-evidence state. */
  onRequestUpdate?: () => void;
  className?: string;
}

export const SystemStateIndicator: React.FC<SystemStateIndicatorProps> = ({
  state: stateProp,
  operationLabel,
  onRequestUpdate,
  className,
}) => {
  const activeCompanyId = useActiveCompanyId();
  const storeState = usePipelineStore(s => {
    if (!activeCompanyId) return 'up-to-date' as SystemState;
    return (s.byCompany[activeCompanyId] as any)?.systemState as SystemState ?? 'up-to-date';
  });
  const activeRunLabel = usePipelineStore(s => {
    if (!activeCompanyId) return undefined;
    const state = s.byCompany[activeCompanyId];
    if (!state?.activeRunId) return undefined;
    const run = s.runs[state.activeRunId];
    return run?.progress?.step ?? undefined;
  });

  const state = stateProp ?? storeState;
  const runLabel = operationLabel ?? activeRunLabel;

  const config = {
    'up-to-date': {
      icon: CheckCircle2,
      label: 'Up to date',
      sublabel: 'All analysis reflects current evidence',
      containerClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      iconClass: 'text-emerald-400',
    },
    'new-evidence': {
      icon: RefreshCw,
      label: 'New evidence',
      sublabel: 'Analysis can be updated',
      containerClass: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      iconClass: 'text-amber-400',
    },
    'analysing': {
      icon: Loader2,
      label: runLabel ? `Analysing — ${runLabel}` : 'Analysing…',
      sublabel: null,
      containerClass: 'bg-[#0A84FF]/10 border-[#0A84FF]/20 text-[#0A84FF]',
      iconClass: 'text-[#0A84FF] animate-spin',
    },
  } as const;

  const { icon: Icon, label, sublabel, containerClass, iconClass } = config[state];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-full)] border text-[var(--text-xs)] font-medium',
          containerClass,
          className
        )}
      >
        <Icon size={13} strokeWidth={2.5} className={iconClass} />
        <span>{label}</span>
        {sublabel && state !== 'analysing' && (
          <span className="opacity-60 font-normal hidden sm:inline">— {sublabel}</span>
        )}
        {state === 'new-evidence' && onRequestUpdate && (
          <button
            onClick={onRequestUpdate}
            className="ml-1 px-2 py-0.5 rounded-[var(--radius-full)] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[var(--text-xs)] font-medium transition-colors"
          >
            Update
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default SystemStateIndicator;
