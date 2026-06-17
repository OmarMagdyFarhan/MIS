/**
 * ConfidenceBadge — inline visual badge for High/Medium/Low confidence,
 * used wherever a CitedClaim, insight, or avatar attribute is displayed.
 *
 * Thresholds match the existing convention used across EvidencePanel /
 * CitedClaimDisplay: >=0.7 high, >=0.4 medium, otherwise low.
 *
 * @module src/components/ConfidenceBadge
 */

import React from 'react';
import { cn } from '../lib/utils';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

const LEVEL_CONFIG: Record<ConfidenceLevel, { label: string; dot: string; text: string; bg: string }> = {
  high:   { label: 'High confidence',   dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-700/30' },
  medium: { label: 'Medium confidence', dot: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-700/30' },
  low:    { label: 'Low confidence',    dot: 'bg-rose-400',    text: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-900/15 border-rose-200 dark:border-rose-700/30' },
};

interface ConfidenceBadgeProps {
  /** 0-1 confidence score */
  confidence: number;
  /** Show the percentage alongside the label */
  showPercent?: boolean;
  /** Compact mode: dot + percent only, no label */
  compact?: boolean;
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  showPercent = true,
  compact = false,
  className,
}) => {
  const level = getConfidenceLevel(confidence);
  const cfg = LEVEL_CONFIG[level];
  const pct = Math.round(confidence * 100);

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[var(--text-xs)] font-bold tabular-nums',
          cfg.text,
          className
        )}
        title={cfg.label}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
        {pct}%
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]',
        cfg.bg,
        cfg.text,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
      {showPercent ? ` · ${pct}%` : ''}
    </span>
  );
};
