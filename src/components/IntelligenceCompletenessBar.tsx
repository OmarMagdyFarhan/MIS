/**
 * Intelligence Completeness Bar — Phase 14
 * Shows coverage of Motivation / Value / Anxiety domains.
 * Always visible during Research and Patterns screens.
 * Replaces: confidence %, provisional/validated labels.
 */

import React from 'react';
import { usePipelineStore } from '../stores/pipelineStore';
import { useActiveCompanyId } from '../stores/companyStore';

interface DomainBarProps {
  label: string;
  covered: boolean;
  count: number;
  color: string;
}

function DomainBar({ label, covered, count, color }: DomainBarProps) {
  const status = count === 0 ? 'Missing' : count < 3 ? 'Building' : 'Strong';
  const statusColor =
    count === 0
      ? 'text-red-400'
      : count < 3
      ? 'text-amber-400'
      : 'text-emerald-400';
  const barW = Math.min(100, count * 12);

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <span className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] w-20 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border-default)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${barW}%` }}
        />
      </div>
      <span className={`text-[var(--text-xs)] font-bold w-14 text-right shrink-0 ${statusColor}`}>
        {status}
      </span>
    </div>
  );
}

export function IntelligenceCompletenessBar() {
  const companyId = useActiveCompanyId();
  const mva = usePipelineStore(s =>
    companyId ? s.getMVAProfile(companyId) : null
  );

  if (!companyId) return null;

  const motivationCount = mva
    ? (mva.motivation.desiredOutcomes.length +
        mva.motivation.painPoints.length +
        mva.motivation.purchasePrompts.length)
    : 0;
  const valueCount = mva
    ? (mva.value.uniqueBenefits.length +
        mva.value.delightfulFeatures.length +
        mva.value.dealbreakers.length)
    : 0;
  const anxietyCount = mva
    ? (mva.anxiety.uncertainties.length +
        mva.anxiety.objections.length +
        mva.anxiety.perceivedRisks.length)
    : 0;

  const missingDomains: string[] = [];
  if (motivationCount === 0) missingDomains.push('buying motivations');
  if (valueCount === 0) missingDomains.push('value signals');
  if (anxietyCount === 0) missingDomains.push('anxiety/objections');

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
          Intelligence Coverage
        </p>
        {missingDomains.length === 0 && (
          <span className="text-[var(--text-xs)] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            All domains covered ✓
          </span>
        )}
      </div>

      <div className="space-y-2">
        <DomainBar
          label="Motivations"
          covered={motivationCount > 0}
          count={motivationCount}
          color="bg-blue-500"
        />
        <DomainBar
          label="Value Signals"
          covered={valueCount > 0}
          count={valueCount}
          color="bg-indigo-500"
        />
        <DomainBar
          label="Anxieties"
          covered={anxietyCount > 0}
          count={anxietyCount}
          color="bg-amber-500"
        />
      </div>

      {missingDomains.length > 0 && (
        <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] border-t border-[var(--color-border-default)] pt-2">
          Add evidence about{' '}
          <span className="font-semibold text-amber-400">
            {missingDomains.join(', ')}
          </span>{' '}
          to complete your analysis.
        </p>
      )}
    </div>
  );
}
