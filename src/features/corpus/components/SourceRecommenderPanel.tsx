import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Telescope, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { buildRecommendations, buildSummaryLine, detectGaps } from '../../../lib/sourceRecommender';
import { computeCorpusHealth } from '../../../lib/corpusHealth';
import type { MiningCorpus } from '../../../types/pipeline';

interface SourceRecommenderPanelProps {
  corpus: MiningCorpus;
}

const PRIORITY_ICON = {
  critical: <AlertTriangle size={12} className="text-rose-500 shrink-0" />,
  high: <AlertCircle size={12} className="text-amber-500 shrink-0" />,
  medium: <Info size={12} className="text-blue-500 shrink-0" />,
};

const PRIORITY_LABEL_COLOR = {
  critical: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
  high: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  medium: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
};

export function SourceRecommenderPanel({ corpus }: SourceRecommenderPanelProps) {
  const [expandedSource, setExpandedSource] = React.useState<string | null>(null);

  const { health, gaps, recs, summaryLine, shouldShow } = React.useMemo(() => {
    const h = computeCorpusHealth(corpus.messages, corpus.clusters, corpus.ingests ?? []);
    const g = detectGaps(corpus.messages, corpus.clusters);
    const r = buildRecommendations(g);
    const s = buildSummaryLine(g);
    const show = h.coverage.analyzed < 40 || h.thinClusterCount > 0 || g.conversionGaps.hasMissingDimension;
    return { health: h, gaps: g, recs: r, summaryLine: s, shouldShow: show };
  }, [corpus.messages, corpus.clusters, corpus.ingests, corpus.version]);

  if (!shouldShow) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Telescope size={15} className="text-[var(--color-text-secondary)]" />
        <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
          Evidence Gaps
        </span>
        {gaps.overallSeverity === 'critical' && (
          <span className="ml-auto flex items-center gap-1 text-[var(--text-xs)] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
            <AlertTriangle size={10} /> Critical
          </span>
        )}
      </div>

      {/* Summary */}
      <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed">{summaryLine}</p>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="space-y-2">
          {recs.map((rec) => {
            const isExpanded = expandedSource === rec.source;
            return (
              <motion.div
                key={rec.source}
                layout
                className={cn(
                  'rounded-[var(--radius-md)] border transition-colors cursor-pointer',
                  isExpanded
                    ? 'border-[#0A84FF]/30 bg-[#0A84FF]/3'
                    : 'border-[var(--color-border-default)] bg-[var(--color-background-tertiary)] hover:border-[var(--color-border-secondary)]'
                )}
              >
                <button
                  onClick={() => setExpandedSource(isExpanded ? null : rec.source)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                >
                  {PRIORITY_ICON[rec.priority]}
                  <span className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)] flex-1">{rec.label}</span>
                  <span className={cn(
                    'text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border',
                    PRIORITY_LABEL_COLOR[rec.priority]
                  )}>
                    {rec.priority}
                  </span>
                  {isExpanded
                    ? <ChevronUp size={13} className="text-[var(--color-text-secondary)] shrink-0" />
                    : <ChevronDown size={13} className="text-[var(--color-text-secondary)] shrink-0" />
                  }
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 space-y-3 border-t border-[var(--color-border-default)]">
                        <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-3 leading-relaxed">{rec.reason}</p>

                        {rec.fills.length > 0 && (
                          <div>
                            <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Fills</span>
                            <ul className="mt-1 space-y-0.5">
                              {rec.fills.map((f, i) => (
                                <li key={i} className="text-[var(--text-xs)] text-[var(--color-text-secondary)] flex items-start gap-1">
                                  <span className="text-emerald-500 mt-0.5">·</span> {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--color-background-tertiary)] border border-[var(--color-border-default)]">
                          <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)] block mb-1">Search Hint</span>
                          <p className="text-[var(--text-xs)] text-[var(--color-text-primary)] leading-relaxed font-mono">{rec.searchHint}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
