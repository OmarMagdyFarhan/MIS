import React from 'react';
import { motion } from 'motion/react';
import { GitBranch, Quote, Layers, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import type { ProvenanceExplainability } from '../../lib/provenanceResolver';
import { cn } from '../../lib/utils';

interface Props {
  items: ProvenanceExplainability[];
  title?: string;
  defaultExpanded?: boolean;
}

export const ProvenancePanel: React.FC<Props> = ({
  items,
  title = 'Provenance & lineage',
  defaultExpanded = true,
}) => {
  const [open, setOpen] = React.useState(defaultExpanded);
  const [expandedField, setExpandedField] = React.useState<string | null>(
    items[0]?.field ?? null
  );

  if (!items.length) {
    return (
      <div className="p-6 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-default)] text-[var(--text-sm)] text-[#86868B]">
        No provenance linked yet. Add evidence in Stage 2 or run clustering.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border overflow-hidden',
        'border-white/10 bg-[#1D1D1F]'
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-[var(--color-card-bg)]/50 dark:hover:bg-white/5"
      >
        <GitBranch size={18} className="text-violet-600" />
        <span className="text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-[#1D1D1F] dark:text-white flex-1">
          {title}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-[var(--color-border-default)] dark:border-white/5">
          {items.map(item => {
            const expanded = expandedField === item.field;
            return (
              <motion.div
                key={item.field}
                layout
                className="rounded-[var(--radius-md)] bg-[var(--color-card-bg)]/60 dark:bg-white/5 p-4"
              >
                <button
                  type="button"
                  onClick={() => setExpandedField(expanded ? null : item.field)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">
                        {item.label}
                      </span>
                      <p className="text-[var(--text-base)] font-semibold text-[#1D1D1F] dark:text-white mt-1">
                        &ldquo;{item.value}&rdquo;
                      </p>
                    </div>
                    {item.confidence && (
                      <span className="shrink-0 px-2 py-1 rounded-full bg-[#0A84FF]/10 text-[#0A84FF] text-[var(--text-xs)] font-semibold">
                        {Math.round(item.confidence.overall * 100)}%
                      </span>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="mt-4 space-y-3 text-[var(--text-sm)]">
                    <div className="flex flex-wrap gap-2">
                      {item.acquisitionSource && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[var(--text-xs)] font-semibold uppercase">
                          Source: {item.acquisitionSource}
                        </span>
                      )}
                      {item.confidence?.status && (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[var(--text-xs)] font-semibold uppercase',
                            item.confidence.status === 'validated'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {item.confidence.status}
                        </span>
                      )}
                    </div>

                    {item.cluster && (
                      <div className="flex items-start gap-2 text-[#515154] dark:text-white/70">
                        <Layers size={14} className="shrink-0 mt-0.5" />
                        <span>
                          Cluster: <strong>{item.cluster.label}</strong>
                          {item.cluster.cohesionScore != null &&
                            ` · ${Math.round(item.cluster.cohesionScore * 100)}% cohesion`}
                        </span>
                      </div>
                    )}

                    {item.evidenceQuotes.length > 0 && (
                      <ul className="space-y-2">
                        {item.evidenceQuotes.map(q => (
                          <li
                            key={q.id}
                            className="flex gap-2 border-l-2 border-violet-300 pl-3 italic text-[#515154] dark:text-white/60"
                          >
                            <Quote size={12} className="shrink-0 mt-1 opacity-50" />
                            <span>
                              <span className="font-semibold not-italic text-[var(--text-xs)] text-[#86868B] mr-1">
                                Quote #{q.displayIndex}
                              </span>
                              {q.excerpt}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-start gap-2">
                      <Shield size={14} className="shrink-0 text-[#86868B]" />
                      <div>
                        <span className="text-[var(--text-xs)] font-semibold uppercase text-[#86868B] block mb-1">
                          Derivation path
                        </span>
                        <ol className="list-decimal list-inside space-y-0.5 text-[var(--text-sm)]">
                          {item.derivationPath.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    {item.confidence?.reasons?.length ? (
                      <p className="text-[var(--text-sm)] text-[#86868B]">
                        {item.confidence.reasons.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
