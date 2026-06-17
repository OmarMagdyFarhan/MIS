import React from 'react';
import type { CitedClaim } from '../../types';
import { getClaimText, getClaimSources } from '../../types';
import type { EvidenceMessage } from '../../types/pipeline';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronUp, Quote, FileSearch } from 'lucide-react';
import { ConfidenceBadge } from '../ConfidenceBadge';
import { useEvidenceDrawer } from '../../stores/uiStore';

interface Props {
  field: CitedClaim | string | undefined;
  messages: EvidenceMessage[];
  label: string;
}

export const CitedClaimDisplay: React.FC<Props> = ({ field, messages, label }) => {
  const [expanded, setExpanded] = React.useState(false);
  const { open: openEvidenceDrawer } = useEvidenceDrawer();
  const text = getClaimText(field);
  const sourceIds = getClaimSources(field);
  const isCited = typeof field === 'object' && field !== null;
  const isLowConfidence = isCited && (field as CitedClaim).lowConfidence;
  const confidence = isCited ? (field as CitedClaim).confidence : undefined;

  const supportingMessages = messages.filter(m => sourceIds.includes(m.id));

  if (!text) return null;

  return (
    <div className="space-y-1">
      <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">
        {label}
      </p>

      <button
        type="button"
        onClick={() => openEvidenceDrawer({
          title: text,
          confidence,
          messages: supportingMessages,
          sourceLabel: label,
        })}
        className={cn(
          'w-full text-left rounded-[var(--radius-sm)] p-3 transition-colors cursor-pointer',
          'hover:ring-1 hover:ring-[#0A84FF]/40',
          isLowConfidence
            ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30'
            : 'bg-[var(--color-card-bg)] dark:bg-white/5'
        )}
      >
        <p className="text-[var(--text-base)] text-[#1D1D1F] dark:text-white leading-relaxed">
          {text}
        </p>

        {isCited && confidence !== undefined && (
          <div className="mt-2">
            <ConfidenceBadge confidence={confidence} compact={false} />
          </div>
        )}

        {sourceIds.length > 0 && (
          <div
            onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }}
            role="button"
            tabIndex={0}
            className="flex items-center gap-1 mt-2 text-[var(--text-xs)] text-[#0A84FF] font-semibold"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {sourceIds.length} supporting message{sourceIds.length !== 1 ? 's' : ''}
            <span className="ml-2 inline-flex items-center gap-1 text-[var(--color-text-tertiary)] normal-case font-medium">
              <FileSearch size={11} /> View evidence
            </span>
          </div>
        )}

        {expanded && supportingMessages.length > 0 && (
          <ul className="mt-2 space-y-2">
            {supportingMessages.map(m => (
              <li
                key={m.id}
                className="flex gap-2 items-start text-[var(--text-sm)] text-[#515154] dark:text-white/60
                           border-l-2 border-[#0A84FF]/30 pl-2"
              >
                <Quote size={10} className="mt-0.5 text-[#0A84FF]/40 shrink-0" />
                <span className="italic">{m.rawText.slice(0, 200)}</span>
              </li>
            ))}
          </ul>
        )}

        {expanded && sourceIds.length > 0 && supportingMessages.length === 0 && (
          <p className="mt-2 text-[var(--text-xs)] text-[#86868B] italic">
            Source messages not available in current corpus.
          </p>
        )}
      </button>
    </div>
  );
};
