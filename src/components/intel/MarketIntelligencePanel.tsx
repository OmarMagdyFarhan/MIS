import React from 'react';
import { motion } from 'motion/react';
import { FlaskConical, Clock, Building2 } from 'lucide-react';
import { Company, MarketIntelligenceData, ProblemAwarenessLevel } from '../../types';
import { cn } from '../../lib/utils';

interface MarketIntelligencePanelProps {
  companies: Company[];
  marketIntelligence: Record<string, MarketIntelligenceData>;
}

const awarenessStyles: Record<ProblemAwarenessLevel, string> = {
  'Problem Unaware': 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)] dark:bg-white/10 dark:text-white/70',
  'Problem Aware': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Solution Aware': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Product Aware': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export const MarketIntelligencePanel: React.FC<MarketIntelligencePanelProps> = ({
  companies,
  marketIntelligence,
}) => {
  const withData = companies.filter(c => marketIntelligence[c.id]);

  if (withData.length === 0) {
    return (
      <div className="text-center py-12 text-[#86868B]">
        <FlaskConical size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-[var(--text-base)] font-medium">No market intelligence yet</p>
        <p className="text-[var(--text-sm)] mt-1">Run Message Mining on any avatar to populate this tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {withData.map(company => {
        const intel = marketIntelligence[company.id];
        const updated = new Date(intel.lastUpdatedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        return (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-secondary)] dark:border-white/10 bg-[var(--color-card-bg)] dark:bg-[#222222] shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-[var(--color-border-default)] dark:border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--color-card-bg)] dark:bg-white/5 flex items-center justify-center">
                <Building2 size={18} className="text-[#86868B]" />
              </div>
              <div>
                <h3 className="text-[var(--text-base)] font-bold text-[#1D1D1F] dark:text-white">{company.name}</h3>
                <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B]">
                  {company.industry}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-8">
              <div className="space-y-2">
                <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B]">
                  Core Problem
                </span>
                <p className="text-[var(--text-lg)] font-bold text-[#1D1D1F] dark:text-white leading-snug">
                  {intel.coreProblem}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B]">
                  Desired Outcome
                </span>
                <p className="text-[var(--text-base)] font-medium text-[#515154] dark:text-white/70 leading-relaxed">
                  {intel.desiredOutcome}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B]">
                  Problem Awareness
                </span>
                <span
                  className={cn(
                    'px-4 py-1.5 rounded-full text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]',
                    awarenessStyles[intel.problemAwarenessLevel]
                  )}
                >
                  {intel.problemAwarenessLevel}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] dark:bg-white/5 space-y-2">
                  <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B]">
                    Buyer
                  </span>
                  <p className="text-[var(--text-base)] font-medium text-[#1D1D1F] dark:text-white leading-relaxed">
                    {intel.buyerDescription}
                  </p>
                </div>
                <div className="p-5 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] dark:bg-white/5 space-y-2">
                  <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B]">
                    User
                  </span>
                  <p className="text-[var(--text-base)] font-medium text-[#1D1D1F] dark:text-white leading-relaxed">
                    {intel.userDescription}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em]">
                  <Clock size={14} />
                  {intel.jobCadence}
                </span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--color-border-default)] dark:border-white/5 text-[var(--text-xs)] text-[#86868B] font-medium">
              Derived from {intel.derivedFromMessageCount} messages · Last updated {updated}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
