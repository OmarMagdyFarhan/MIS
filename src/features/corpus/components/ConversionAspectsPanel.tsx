import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, ChevronDown, ChevronUp, Target, Shield, Zap } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { EvidenceMessage } from '../../../types/pipeline';

interface ConversionAspectsPanelProps {
  messages: EvidenceMessage[];
}

interface AggregatedAspects {
  motivation: {
    desiredOutcomes: Array<{ text: string; sources: string[] }>;
    painPoints: Array<{ text: string; sources: string[] }>;
    purchasePrompts: Array<{ text: string; sources: string[] }>;
  };
  value: {
    uniqueBenefits: Array<{ text: string; sources: string[] }>;
    delightfulFeatures: Array<{ text: string; sources: string[] }>;
    dealreakerNeeds: Array<{ text: string; sources: string[] }>;
  };
  anxiety: {
    uncertainties: Array<{ text: string; sources: string[] }>;
    objections: Array<{ text: string; sources: string[] }>;
    perceivedRisks: Array<{ text: string; sources: string[] }>;
  };
}

function aggregateAspects(messages: EvidenceMessage[]): AggregatedAspects {
  const analyzed = messages.filter(m => m.analyzed && m.analysis);
  const merge = (texts: string[], msgId: string, acc: Record<string, string[]>) => {
    for (const t of texts) {
      if (!t || t.trim().length < 3) continue;
      const key = t.trim().toLowerCase().slice(0, 80);
      if (!acc[key]) acc[key] = [];
      if (!acc[key].includes(msgId)) acc[key].push(msgId);
    }
  };

  const motivation = {
    desiredOutcomes: {} as Record<string, string[]>,
    painPoints: {} as Record<string, string[]>,
    purchasePrompts: {} as Record<string, string[]>,
  };
  const value = {
    uniqueBenefits: {} as Record<string, string[]>,
    delightfulFeatures: {} as Record<string, string[]>,
    dealreakerNeeds: {} as Record<string, string[]>,
  };
  const anxiety = {
    uncertainties: {} as Record<string, string[]>,
    objections: {} as Record<string, string[]>,
    perceivedRisks: {} as Record<string, string[]>,
  };

  for (const m of analyzed) {
    const ca = (m.analysis as any)?.conversionAspects;
    if (!ca) continue;
    merge(ca.motivation?.desiredOutcomes ?? [], m.id, motivation.desiredOutcomes);
    merge(ca.motivation?.painPoints ?? [], m.id, motivation.painPoints);
    merge(ca.motivation?.purchasePrompts ?? [], m.id, motivation.purchasePrompts);
    merge(ca.value?.uniqueBenefits ?? [], m.id, value.uniqueBenefits);
    merge(ca.value?.delightfulFeatures ?? [], m.id, value.delightfulFeatures);
    merge(ca.value?.dealreakerNeeds ?? [], m.id, value.dealreakerNeeds);
    merge(ca.anxiety?.uncertainties ?? [], m.id, anxiety.uncertainties);
    merge(ca.anxiety?.objections ?? [], m.id, anxiety.objections);
    merge(ca.anxiety?.perceivedRisks ?? [], m.id, anxiety.perceivedRisks);
  }

  const toList = (acc: Record<string, string[]>) =>
    Object.entries(acc)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 6)
      .map(([text, sources]) => ({ text, sources }));

  return {
    motivation: {
      desiredOutcomes: toList(motivation.desiredOutcomes),
      painPoints: toList(motivation.painPoints),
      purchasePrompts: toList(motivation.purchasePrompts),
    },
    value: {
      uniqueBenefits: toList(value.uniqueBenefits),
      delightfulFeatures: toList(value.delightfulFeatures),
      dealreakerNeeds: toList(value.dealreakerNeeds),
    },
    anxiety: {
      uncertainties: toList(anxiety.uncertainties),
      objections: toList(anxiety.objections),
      perceivedRisks: toList(anxiety.perceivedRisks),
    },
  };
}

interface DimensionConfig {
  key: 'motivation' | 'value' | 'anxiety';
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  subs: { key: string; label: string }[];
}

const DIMENSIONS: DimensionConfig[] = [
  {
    key: 'motivation',
    label: 'Motivation',
    icon: <Zap size={13} />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    subs: [
      { key: 'desiredOutcomes', label: 'Desired Outcomes' },
      { key: 'painPoints', label: 'Pain Points' },
      { key: 'purchasePrompts', label: 'Purchase Prompts' },
    ],
  },
  {
    key: 'value',
    label: 'Value',
    icon: <Target size={13} />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    subs: [
      { key: 'uniqueBenefits', label: 'Unique Benefits' },
      { key: 'delightfulFeatures', label: 'Delightful Features' },
      { key: 'dealreakerNeeds', label: 'Dealbreaker Needs' },
    ],
  },
  {
    key: 'anxiety',
    label: 'Anxiety',
    icon: <Shield size={13} />,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-200 dark:border-rose-800',
    subs: [
      { key: 'uncertainties', label: 'Uncertainties' },
      { key: 'objections', label: 'Objections' },
      { key: 'perceivedRisks', label: 'Perceived Risks' },
    ],
  },
];

export function ConversionAspectsPanel({ messages }: ConversionAspectsPanelProps) {
  const [openDimension, setOpenDimension] = React.useState<'motivation' | 'value' | 'anxiety' | null>(null);
  const aspects = React.useMemo(() => aggregateAspects(messages), [messages]);

  const totalSignals = Object.values(aspects).reduce(
    (sum, dim) => sum + Object.values(dim as Record<string, unknown[]>).reduce((s, arr) => s + arr.length, 0),
    0
  );

  if (totalSignals === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-border-default)] p-5 text-center">
        <MessageSquare size={16} className="mx-auto text-[var(--color-text-secondary)] mb-2" />
        <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">Run the pipeline to extract conversion signals.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-2 border-b border-[var(--color-border-default)]">
        <MessageSquare size={14} className="text-[var(--color-text-secondary)]" />
        <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
          Conversion Signals
        </span>
        <span className="ml-auto text-[var(--text-xs)] font-bold text-[var(--color-text-secondary)]">{totalSignals} signal{totalSignals !== 1 ? 's' : ''}</span>
      </div>

      {/* Dimension rows */}
      <div className="divide-y divide-[var(--color-border-default)]">
        {DIMENSIONS.map(dim => {
          const dimData = aspects[dim.key];
          const allItems = dim.subs.flatMap(s => (dimData as Record<string, { text: string; sources: string[] }[]>)[s.key] ?? []);
          const total = allItems.length;
          const isOpen = openDimension === dim.key;

          if (total === 0) {
            return (
              <div key={dim.key} className="px-5 py-3 flex items-center gap-2 opacity-40">
                <span className={dim.color}>{dim.icon}</span>
                <span className="text-[var(--text-sm)] font-semibold">{dim.label}</span>
                <span className="ml-auto text-[var(--text-xs)] text-[var(--color-text-secondary)]">No signals yet</span>
              </div>
            );
          }

          return (
            <div key={dim.key}>
              <button
                onClick={() => setOpenDimension(isOpen ? null : dim.key)}
                className="w-full px-5 py-3 flex items-center gap-2 hover:bg-[var(--color-background-tertiary)] transition-colors text-left"
              >
                <span className={dim.color}>{dim.icon}</span>
                <span className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)]">{dim.label}</span>
                <span className={cn('text-[var(--text-xs)] font-semibold uppercase px-1.5 py-0.5 rounded border ml-1', dim.bgColor, dim.color, dim.borderColor)}>
                  {total}
                </span>
                <span className="ml-auto">
                  {isOpen ? <ChevronUp size={13} className="text-[var(--color-text-secondary)]" /> : <ChevronDown size={13} className="text-[var(--color-text-secondary)]" />}
                </span>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 space-y-4 border-t border-[var(--color-border-default)]">
                      {dim.subs.map(sub => {
                        const items = (dimData as Record<string, { text: string; sources: string[] }[]>)[sub.key] ?? [];
                        if (items.length === 0) return null;
                        return (
                          <div key={sub.key} className="mt-3">
                            <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-secondary)] block mb-2">
                              {sub.label}
                            </span>
                            <div className="space-y-1.5">
                              {items.map((item, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className={cn('text-[var(--text-xs)] mt-0.5 shrink-0', dim.color)}>·</span>
                                  <span className="text-[var(--text-sm)] text-[var(--color-text-primary)] capitalize leading-relaxed">
                                    {item.text}
                                  </span>
                                  {item.sources.length > 1 && (
                                    <span className="ml-auto text-[var(--text-xs)] text-[var(--color-text-secondary)] shrink-0">×{item.sources.length}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
