import React from 'react';
import { X, GitMerge, GitBranch, CheckCircle2, AlertTriangle, MinusCircle, ArrowLeftRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { compareAvatars } from '../../services/avatarComparisonService';
import type { ClaimComparison } from '../../services/avatarComparisonService';
import type { Avatar } from '../../types';
import type { Cluster, EvidenceMessage } from '../../types/pipeline';

interface AvatarComparisonViewProps {
  avatarA: Avatar;
  avatarB: Avatar;
  clusterA?: Cluster;
  clusterB?: Cluster;
  messages: EvidenceMessage[];
  onClose: () => void;
}

const DIVERGENCE_CONFIG: Record<ClaimComparison['divergenceType'], {
  label: string;
  className: string;
  icon: React.ReactNode;
}> = {
  identical: {
    label: '= Same',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  similar: {
    label: '≈ Similar',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    icon: <ArrowLeftRight className="w-3 h-3" />,
  },
  opposite: {
    label: '↔ Opposite',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  one_missing: {
    label: '— Missing',
    className: 'bg-[var(--color-background-tertiary)] text-[var(--color-text-tertiary)] dark:bg-gray-700 dark:text-[var(--color-text-tertiary)]',
    icon: <MinusCircle className="w-3 h-3" />,
  },
};

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  keep_both: {
    label: 'KEEP BOTH',
    icon: <GitBranch className="w-4 h-4" />,
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  consider_merge: {
    label: 'CONSIDER MERGE',
    icon: <GitMerge className="w-4 h-4" />,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  review_split: {
    label: 'REVIEW SPLIT',
    icon: <AlertTriangle className="w-4 h-4" />,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
};

function StarRating({ value }: { value?: number }) {
  if (value === undefined) return <span className="text-[var(--text-xs)] text-[#86868B]">—</span>;
  const pct = Math.round(value * 5);
  return (
    <span className="text-[var(--text-xs)] text-[#86868B]">
      {'★'.repeat(pct)}{'☆'.repeat(5 - pct)} {value.toFixed(2)}
    </span>
  );
}

export const AvatarComparisonView: React.FC<AvatarComparisonViewProps> = ({
  avatarA, avatarB, clusterA, clusterB, messages, onClose,
}) => {
  const report = React.useMemo(
    () => compareAvatars(avatarA, avatarB, clusterA, clusterB, messages),
    [avatarA, avatarB, clusterA, clusterB, messages]
  );

  const actionCfg = ACTION_CONFIG[report.recommendedAction];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] bg-[var(--color-card-bg)] dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-[var(--radius-md)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-default)] dark:border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#86868B]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-[#1D1D1F] dark:text-white">
              Avatar Comparison
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-card-bg)] dark:hover:bg-white/5 text-[#86868B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Avatar headers */}
          <div className="grid grid-cols-2 gap-4">
            {[report.avatarA, report.avatarB].map((av, i) => (
              <div key={av.id} className="p-3 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] dark:border-white/10 bg-[var(--color-card-bg)] dark:bg-white/3">
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-white">{av.name}</p>
                <p className="text-[var(--text-xs)] text-[#86868B] mt-0.5">{av.messageCount} messages</p>
                <p className="text-[var(--text-xs)] text-[#86868B]">Avatar {i === 0 ? 'A' : 'B'}</p>
              </div>
            ))}
          </div>

          {/* Claim comparisons */}
          <div className="space-y-3">
            {report.claimComparisons.map(comp => {
              const divCfg = DIVERGENCE_CONFIG[comp.divergenceType];
              return (
                <div key={comp.fieldPath} className="border border-[var(--color-border-default)] dark:border-white/10 rounded-[var(--radius-sm)] overflow-hidden">
                  <div className="px-4 py-2 bg-[var(--color-card-bg)] dark:bg-white/5 flex items-center justify-between">
                    <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">{comp.label}</span>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]', divCfg.className)}>
                      {divCfg.icon}
                      {divCfg.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[#F5F5F7] dark:divide-white/10">
                    {[comp.avatarA, comp.avatarB].map((side, i) => (
                      <div key={i} className="p-3 space-y-1">
                        <p className="text-sm text-[#1D1D1F] dark:text-white leading-relaxed">
                          {side.text || <span className="text-[#86868B] italic">Not available</span>}
                        </p>
                        <div className="flex items-center gap-2">
                          <StarRating value={side.confidence} />
                          <span className="text-[var(--text-xs)] text-[#86868B]">{side.sourceCount} source{side.sourceCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overlap metrics */}
          <div className="flex gap-4">
            <div className="flex-1 p-3 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] dark:border-white/10 bg-[var(--color-card-bg)] dark:bg-white/3 text-center">
              <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">Aspect Overlap</p>
              <p className="text-xl font-semibold text-[#1D1D1F] dark:text-white mt-1">
                {Math.round(report.aspectOverlap * 100)}%
              </p>
            </div>
            <div className="flex-1 p-3 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] dark:border-white/10 bg-[var(--color-card-bg)] dark:bg-white/3 text-center">
              <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">Evidence Overlap</p>
              <p className="text-xl font-semibold text-[#1D1D1F] dark:text-white mt-1">
                {Math.round(report.evidenceOverlap * 100)}%
              </p>
            </div>
          </div>

          {/* Recommendation */}
          <div className={cn('p-4 rounded-[var(--radius-sm)] flex items-start gap-3', actionCfg.className)}>
            {actionCfg.icon}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.06em] mb-1">
                Recommendation: {actionCfg.label}
              </p>
              <p className="text-sm leading-relaxed">{report.reasoning}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
