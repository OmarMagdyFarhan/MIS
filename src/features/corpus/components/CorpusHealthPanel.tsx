import React from 'react';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, CheckCircle2, BarChart2, Layers } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { computeCorpusHealth } from '../../../lib/corpusHealth';
import type { MiningCorpus } from '../../../types/pipeline';

interface CorpusHealthPanelProps {
  corpus: MiningCorpus;
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function CorpusHealthPanel({ corpus }: CorpusHealthPanelProps) {
  const health = React.useMemo(
    () => computeCorpusHealth(corpus.messages, corpus.clusters, corpus.ingests ?? []),
    [corpus.messages, corpus.clusters, corpus.ingests, corpus.version]
  );

  const coveragePct = health.coverage.pct;
  const coverageColor = coveragePct >= 0.8 ? 'emerald' : coveragePct >= 0.5 ? 'amber' : 'rose';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity size={15} className="text-[var(--color-text-secondary)]" />
        <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Corpus Health</span>
        {health.thinClusterCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[var(--text-xs)] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
            <AlertTriangle size={10} /> {health.thinClusterCount} thin cluster{health.thinClusterCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Coverage */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[var(--text-xs)] font-bold text-[var(--color-text-secondary)] uppercase tracking-[0.06em]">Analysis Coverage</span>
          <span className={cn(
            'text-[var(--text-xs)] font-semibold',
            coverageColor === 'emerald' ? 'text-emerald-600' : coverageColor === 'amber' ? 'text-amber-600' : 'text-rose-600'
          )}>
            {pct(coveragePct)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-background-tertiary)] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: pct(coveragePct) }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full',
              coverageColor === 'emerald' ? 'bg-emerald-500' : coverageColor === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
            )}
          />
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">{health.coverage.analyzed} analyzed</span>
          <span className="text-[var(--color-border-default)]">·</span>
          <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">{health.coverage.raw} raw</span>
          <span className="text-[var(--color-border-default)]">·</span>
          <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">{health.coverage.total} total</span>
        </div>
      </div>

      {/* Source Strength */}
      {health.sourceStrength.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart2 size={11} className="text-[var(--color-text-secondary)]" />
            <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Source Strength</span>
          </div>
          <div className="space-y-1.5">
            {health.sourceStrength.map((src, i) => {
              const maxDensity = Math.max(...health.sourceStrength.map(s => s.density), 0.1);
              const barWidth = (src.density / maxDensity) * 100;
              return (
                <div key={src.source} className="flex items-center gap-2">
                  <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)] w-28 shrink-0 truncate">{src.label}</span>
                  <div className="flex-1 h-1.5 bg-[var(--color-background-tertiary)] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      className="h-full bg-[#0A84FF] rounded-full"
                    />
                  </div>
                  <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)] w-12 text-right shrink-0">{src.messageCount} msgs</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cluster Health */}
      {health.clusterHealth.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={11} className="text-[var(--color-text-secondary)]" />
            <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Cluster Health</span>
          </div>
          <div className="space-y-1.5">
            {health.clusterHealth.slice(0, 4).map(c => (
              <div key={c.clusterId} className="flex items-center gap-2">
                {c.isThin
                  ? <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                  : <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                }
                <span className="text-[var(--text-xs)] text-[var(--color-text-primary)] flex-1 truncate">{c.label}</span>
                <span className={cn(
                  'text-[var(--text-xs)] font-bold ml-auto shrink-0',
                  c.isThin ? 'text-amber-600' : 'text-emerald-600'
                )}>{c.messageCount} msgs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
