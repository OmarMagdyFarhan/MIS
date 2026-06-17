/**
 * WorkspaceSidebar — persistent left navigation for the Guided Workspace
 * (Phase 15). Replaces the gated JourneyIndicator stepper with a Linear/
 * Notion-style sidebar: companies list up top, workspace tabs below.
 *
 * Tabs are always visible/clickable — "locked" steps are shown with a
 * subtle hint rather than being hidden, per the Next Best Action system
 * which explains what to do next instead of blocking navigation.
 *
 * @module src/components/WorkspaceSidebar
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Building2, Plus, Home, Search, Compass, FileSearch,
  Layers, Sparkles, TrendingUp, ChevronDown, Lock,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Company } from '../types';
import type { WorkspaceTab } from '../stores/uiStore';
import { useCommandPalette, useToastActions } from '../stores/uiStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { getJourneyStep } from './JourneyIndicator';

interface TabConfig {
  id: WorkspaceTab;
  label: string;
  icon: React.ElementType;
  /** Minimum journey step (1-5) required to consider this tab "ready" */
  readyAtStep: number;
}

const TABS: TabConfig[] = [
  { id: 'overview',     label: 'Overview',     icon: Compass,    readyAtStep: 1 },
  { id: 'evidence',     label: 'Evidence',     icon: FileSearch, readyAtStep: 1 },
  { id: 'segments',     label: 'Segments',     icon: Layers,     readyAtStep: 2 },
  { id: 'intelligence', label: 'Intelligence', icon: Sparkles,   readyAtStep: 3 },
  { id: 'strategy',     label: 'Strategy',     icon: TrendingUp, readyAtStep: 5 },
];

interface WorkspaceSidebarProps {
  companies: Company[];
  activeCompany?: Company;
  activeTab: WorkspaceTab;
  onSelectCompany: (id: string) => void;
  onAddCompany: () => void;
  onGoHome: () => void;
  onSelectTab: (tab: WorkspaceTab) => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  companies,
  activeCompany,
  activeTab,
  onSelectCompany,
  onAddCompany,
  onGoHome,
  onSelectTab,
}) => {
  const [companySwitcherOpen, setCompanySwitcherOpen] = React.useState(false);
  const { open: openCommandPalette } = useCommandPalette();
  const { showError } = useToastActions();

  // FRICTION-03: locked tab toast messages
  const LOCKED_MESSAGES: Partial<Record<WorkspaceTab, string>> = {
    segments:     'Finish adding evidence first to unlock Segments',
    intelligence: 'Confirm your segments first to unlock Intelligence',
    strategy:     'Finish the previous steps first to unlock Strategy',
  };

  const handleTabClick = (id: WorkspaceTab, isReady: boolean) => {
    if (!isReady) {
      const msg = LOCKED_MESSAGES[id] ?? `Finish previous steps to unlock ${id}`;
      showError(msg);
      return;
    }
    onSelectTab(id);
  };

  const pipelinePhase = usePipelineStore(s =>
    activeCompany ? s.byCompany[activeCompany.id]?.phase : undefined
  );
  const legacyStage1 = usePipelineStore(s =>
    activeCompany ? s.getLegacyProgressFlags(activeCompany.id).stage1Complete : false
  );
  const highestUnlocked = getJourneyStep(pipelinePhase, legacyStage1);

  return (
    <aside className="w-[260px] shrink-0 h-full bg-[var(--color-card-bg)] border-r border-[var(--color-border-default)] flex flex-col">
      {/* Brand / home */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <button
          onClick={onGoHome}
          className="flex items-center gap-2.5 group"
          title="Back to Home"
        >
          <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[#0A84FF] flex items-center justify-center text-white shrink-0">
            <Home size={16} strokeWidth={2.5} />
          </div>
          <span className="text-[var(--text-xs)] font-semibold tracking-[0.06em] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
            MATRIX
          </span>
        </button>
        <button
          onClick={openCommandPalette}
          title="Search (⌘K)"
          className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-slate-elevated)] transition-colors"
        >
          <Search size={15} />
        </button>
      </div>

      {/* Company switcher */}
      {activeCompany && (
        <div className="px-3 pb-3 relative">
          <button
            onClick={() => setCompanySwitcherOpen(o => !o)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-primary-bg)]/40 hover:bg-[var(--color-slate-elevated)] transition-colors"
          >
            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-card-bg)] border border-[var(--color-border-default)] flex items-center justify-center overflow-hidden shrink-0">
              {activeCompany.logoUrl ? (
                <img src={activeCompany.logoUrl} alt={activeCompany.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
              ) : (
                <Building2 size={14} className="text-[var(--color-text-secondary)]" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[var(--text-base)] font-medium text-[var(--color-text-primary)] truncate">{activeCompany.name}</div>
              <div className="text-[var(--text-xs)] text-[var(--color-text-tertiary)] truncate">{activeCompany.industry || 'Workspace'}</div>
            </div>
            <ChevronDown size={14} className={cn('text-[var(--color-text-tertiary)] transition-transform shrink-0', companySwitcherOpen && 'rotate-180')} />
          </button>

          {companySwitcherOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setCompanySwitcherOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-3 right-3 mt-2 z-20 bg-[var(--color-card-bg)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] shadow-2xl overflow-hidden"
              >
                <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-2">
                  {companies.map(c => {
                    const cPipelineState = usePipelineStore.getState().byCompany[c.id];
                    const cLegacy = usePipelineStore.getState().getLegacyProgressFlags(c.id);
                    const cStep = getJourneyStep(cPipelineState?.phase, cLegacy.stage1Complete);
                    const TOTAL_STEPS = 5;
                    return (
                    <button
                      key={c.id}
                      onClick={() => { onSelectCompany(c.id); setCompanySwitcherOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] flex items-center gap-3 transition-colors',
                        c.id === activeCompany.id ? 'bg-[#0A84FF]/10' : 'hover:bg-[var(--color-slate-elevated)]'
                      )}
                    >
                      <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-primary-bg)]/60 border border-[var(--color-border-default)] flex items-center justify-center overflow-hidden shrink-0">
                        {c.logoUrl ? (
                          <img src={c.logoUrl} alt={c.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                        ) : (
                          <Building2 size={12} className="text-[var(--color-text-secondary)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={cn('text-[var(--text-base)] font-medium truncate block', c.id === activeCompany.id ? 'text-[#0A84FF]' : 'text-[var(--color-text-primary)]')}>
                          {c.name}
                        </span>
                        {/* QW-01: Progress dots */}
                        <div className="flex gap-1 mt-0.5">
                          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${i < cStep ? 'bg-[#0A84FF]' : 'bg-[var(--color-border-default)]'}`}
                            />
                          ))}
                        </div>
                      </div>
                    </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => { onAddCompany(); setCompanySwitcherOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-3 border-t border-[var(--color-border-default)] text-[var(--text-sm)] font-medium text-[#0A84FF] hover:bg-[#0A84FF]/5 transition-colors"
                >
                  <Plus size={14} strokeWidth={3} /> Add company
                </button>
              </motion.div>
            </>
          )}
        </div>
      )}

      {/* Pipeline progress — single place this lives now (was duplicated
          across PhaseNav-style chrome and ad-hoc indicators in StageShell). */}
      {activeCompany && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const stepNum = i + 1;
              const done = stepNum < highestUnlocked;
              const current = stepNum === highestUnlocked;
              return (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    done ? 'bg-[#0A84FF]' : current ? 'bg-[#0A84FF]/40' : 'bg-[var(--color-border-default)]'
                  )}
                  title={`Step ${stepNum} of 5`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 text-[var(--text-xs)] text-[var(--color-text-tertiary)]">
            Step {highestUnlocked} of 5
          </div>
        </div>
      )}

      {/* Workspace tabs */}
      <nav className="flex-1 px-3 pt-1 overflow-y-auto custom-scrollbar" aria-label="Workspace sections">
        <div className="px-1 pb-2 text-[var(--text-xs)] font-medium uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
          Workspace
        </div>
        <div className="space-y-1">
          {TABS.map(({ id, label, icon: Icon, readyAtStep }) => {
            const isActive = activeTab === id;
            const isReady = highestUnlocked >= readyAtStep;
            return (
              <button
                key={id}
                onClick={() => handleTabClick(id, isReady)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-base)] font-medium transition-all relative',
                  isActive
                    ? 'bg-[#0A84FF]/10 text-[#0A84FF]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-slate-elevated)]'
                )}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                <span className="flex-1 text-left">{label}</span>
                {!isReady && !isActive && (
                  <Lock size={11} className="text-[var(--color-text-tertiary)] opacity-50" />
                )}
                {isActive && (
                  <motion.div
                    layoutId="workspaceTabIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#0A84FF] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
};
