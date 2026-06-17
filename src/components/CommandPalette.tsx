/**
 * CommandPalette — global search (⌘K / Ctrl+K), Linear/Notion style.
 * Searches companies, avatars, segments, and insights via
 * globalSearchService, reading directly from Zustand stores.
 *
 * @module src/components/CommandPalette
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Building2, UserCircle2, Layers, Sparkles, CornerDownLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCommandPalette, useWorkspaceTabActions } from '../stores/uiStore';
import { useCompanies, useCompanyActions } from '../stores/companyStore';
import { useProgress } from '../stores/offerStore';
import { useCorpusStore } from '../features/corpus/store';
import { searchWorkspace, type SearchResult, type SearchResultKind } from '../services/globalSearchService';
import { useWorkflowOrchestration } from '../hooks/useWorkflowOrchestration';

const KIND_ICON: Record<SearchResultKind, React.ElementType> = {
  company: Building2,
  avatar: UserCircle2,
  segment: Layers,
  insight: Sparkles,
};

export const CommandPalette: React.FC = () => {
  const { isOpen, close, toggle } = useCommandPalette();
  const companies = useCompanies();
  const progress = useProgress();
  const { setActiveCompanyId } = useCompanyActions();
  const { setActiveTab } = useWorkspaceTabActions();
  const corpora = useCorpusStore(s => s.corpora);
  const { handleSelectCompany, handleNavigateToStage: onNavigateToStage } = useWorkflowOrchestration();

  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K shortcut
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, close, isOpen]);

  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const clustersByCompany = React.useMemo(() => {
    const out: Record<string, ReturnType<typeof useCorpusStore.getState>['corpora'][string]['clusters']> = {};
    for (const company of companies) {
      out[company.id] = corpora[company.id]?.clusters ?? [];
    }
    return out;
  }, [companies, corpora]);

  const results: SearchResult[] = React.useMemo(() => {
    return searchWorkspace(query, { companies, progress, clustersByCompany });
  }, [query, companies, progress, clustersByCompany]);

  const handleSelect = (result: SearchResult) => {
    // Map tab names to stage names
    const tabToStageMap: Record<string, string> = {
      'overview': 'stage1',
      'evidence': 'stage2',
      'segments': 'stage3',
      'intelligence': 'stage4',
      'strategy': 'stage4'
    };
    
    // Route through orchestration layer to sync ALL state atomically
    handleSelectCompany(result.companyId);
    onNavigateToStage((tabToStageMap[result.targetTab] || 'stage1') as 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'foundation');
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = results[activeIndex];
      if (result) handleSelect(result);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/40 z-[1300]"
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-label="Global search"
            className="fixed top-[14vh] left-1/2 -translate-x-1/2 w-full max-w-[560px] z-[1301] bg-[var(--color-card-bg)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-default)]">
              <Search size={16} className="text-[var(--color-text-tertiary)] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                onKeyDown={onKeyDown}
                placeholder="Search companies, profiles, segments, insights…"
                className="flex-1 bg-transparent outline-none text-[var(--text-base)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-md text-[var(--text-xs)] font-bold border border-[var(--color-border-default)] text-[var(--color-text-tertiary)]">
                Esc
              </kbd>
            </div>

            <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
              {query.trim() === '' ? (
                <div className="px-4 py-8 text-center text-[var(--text-sm)] text-[var(--color-text-tertiary)]">
                  Type to search across your workspace.
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-8 text-center text-[var(--text-sm)] text-[var(--color-text-tertiary)]">
                  No results for "{query}".
                </div>
              ) : (
                <ul className="p-2">
                  {results.map((result, i) => {
                    const Icon = KIND_ICON[result.kind];
                    const isActive = i === activeIndex;
                    return (
                      <li key={result.id}>
                        <button
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-left transition-colors',
                            isActive ? 'bg-[#0A84FF]/10' : 'hover:bg-[var(--color-slate-elevated)]'
                          )}
                        >
                          <div className={cn(
                            'w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0',
                            isActive ? 'bg-[#0A84FF]/15 text-[#0A84FF]' : 'bg-[var(--color-slate-elevated)] text-[var(--color-text-secondary)]'
                          )}>
                            <Icon size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)] truncate">{result.title}</div>
                            {result.subtitle && (
                              <div className="text-[var(--text-xs)] text-[var(--color-text-tertiary)] truncate">{result.subtitle}</div>
                            )}
                          </div>
                          {isActive && <CornerDownLeft size={12} className="text-[var(--color-text-tertiary)] shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
