/**
 * Buying Insights Panel — Phase 14
 * Surfaces Conversion Intelligence and MVA signals in plain language.
 * Replaces the Offers tab in IntelligenceHub.
 */

import React from 'react';
import { TrendingUp, Shield, AlertCircle, Zap, Target, AlertTriangle } from 'lucide-react';
import { usePipelineStore } from '../../stores/pipelineStore';
import type { ConversionSignal } from '../../services/conversionIntelligenceService';

interface Props {
  companyId: string;
}

function SignalList({
  signals,
  max = 5,
}: {
  signals: ConversionSignal[];
  max?: number;
}) {
  if (!signals.length) {
    return (
      <p className="text-sm text-[var(--color-text-tertiary)] italic">
        Add more evidence to reveal signals here.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {signals.slice(0, max).map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-0.5 w-5 h-5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-border-default)] flex items-center justify-center text-[var(--text-xs)] font-bold text-[var(--color-text-secondary)] shrink-0">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">{s.text}</p>
            {s.representativeQuote && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 line-clamp-1 italic">
                "{s.representativeQuote}"
              </p>
            )}
          </div>
          <span className="text-xs text-[var(--color-text-tertiary)] shrink-0">
            {s.frequency}×
          </span>
        </li>
      ))}
    </ul>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  signals: ConversionSignal[];
  accent: string;
}

function InsightSection({ icon, title, subtitle, signals, accent }: SectionProps) {
  return (
    <div className={`rounded-[var(--radius-md)] border ${accent} bg-[var(--color-card-bg)] p-5 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-primary)] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{title}</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
        </div>
        <span className="ml-auto text-xs font-bold text-[var(--color-text-tertiary)]">
          {signals.length} signals
        </span>
      </div>
      <SignalList signals={signals} />
    </div>
  );
}

export const BuyingInsightsPanel: React.FC<Props> = ({ companyId }) => {
  const intel = usePipelineStore(s => s.getConversionIntelligence(companyId));
  const mva = usePipelineStore(s => s.getMVAProfile(companyId));

  if (!intel && !mva) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] border border-[var(--color-border-default)] flex items-center justify-center">
          <Zap size={28} className="text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">No Buying Insights Yet</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">
            Add at least 8 pieces of customer evidence and run analysis to reveal buying triggers, objections, and trust signals.
          </p>
        </div>
      </div>
    );
  }

  const totalSignals = intel?.totalSignalsAnalyzed ?? 0;

  return (
    <div className="space-y-4 pb-8">
      {/* Header summary */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {totalSignals} conversion signals analysed
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Derived from {mva ? 'your evidence library' : 'available evidence'} — updates automatically as you add more
          </p>
        </div>
        {mva && (
          <div className="flex gap-2 text-xs">
            {mva.coverage.motivationCovered && (
              <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                Motivations ✓
              </span>
            )}
            {mva.coverage.valueCovered && (
              <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                Value ✓
              </span>
            )}
            {mva.coverage.anxietyCovered && (
              <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                Anxieties ✓
              </span>
            )}
          </div>
        )}
      </div>

      {/* Buying Triggers */}
      {intel && (
        <InsightSection
          icon={<TrendingUp size={16} className="text-emerald-500" />}
          title="Buying Triggers"
          subtitle="What causes customers to decide to buy"
          signals={intel.buyingTriggers}
          accent="border-emerald-500/20"
        />
      )}

      {/* MVA — What they want */}
      {mva && mva.motivation.desiredOutcomes.length > 0 && (
        <InsightSection
          icon={<Target size={16} className="text-blue-500" />}
          title="What They Want"
          subtitle="Desired outcomes driving purchase decisions"
          signals={mva.motivation.desiredOutcomes.map(s => ({
            text: s.text,
            weight: s.weight,
            frequency: s.sourceMessageIds.length,
            sourceMessageIds: s.sourceMessageIds,
            representativeQuote: '',
          }))}
          accent="border-blue-500/20"
        />
      )}

      {/* Trust Drivers */}
      {intel && (
        <InsightSection
          icon={<Shield size={16} className="text-indigo-500" />}
          title="Trust Drivers"
          subtitle="What builds confidence and reduces hesitation"
          signals={intel.trustDrivers}
          accent="border-indigo-500/20"
        />
      )}

      {/* Objections */}
      {intel && (
        <InsightSection
          icon={<AlertCircle size={16} className="text-amber-500" />}
          title="Objections"
          subtitle="Specific resistance patterns to address"
          signals={intel.objections}
          accent="border-amber-500/20"
        />
      )}

      {/* Friction Points */}
      {intel && intel.frictionPoints.length > 0 && (
        <InsightSection
          icon={<AlertTriangle size={16} className="text-red-500" />}
          title="Friction Points"
          subtitle="Where customers get stuck in the buying journey"
          signals={intel.frictionPoints}
          accent="border-red-500/20"
        />
      )}

      {/* Opportunities */}
      {intel && intel.conversionOpportunities.length > 0 && (
        <InsightSection
          icon={<Zap size={16} className="text-purple-500" />}
          title="Conversion Opportunities"
          subtitle="Untapped signals that could accelerate purchase"
          signals={intel.conversionOpportunities}
          accent="border-purple-500/20"
        />
      )}
    </div>
  );
};
