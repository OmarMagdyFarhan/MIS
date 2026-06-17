import React from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { EvidenceMessage } from '../../types/pipeline';

interface EvidencePanelProps {
  claim?: string;
  messages: EvidenceMessage[];
  maxVisible?: number;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? 'bg-green-500 dark:bg-green-400' :
    pct >= 40 ? 'bg-yellow-500 dark:bg-yellow-400' :
    'bg-red-400 dark:bg-red-400';
  const blocks = Math.round(value * 10);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={cn(
              'w-2.5 h-2 rounded-sm',
              i < blocks ? color : 'bg-gray-200 dark:bg-gray-700'
            )}
          />
        ))}
      </div>
      <span className="text-xs text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'p-1 rounded transition-colors shrink-0',
        'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300',
        'hover:bg-[var(--color-background-tertiary)] dark:hover:bg-gray-700'
      )}
      title="Copy quote"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function filterRelevantMessages(claim: string | undefined, messages: EvidenceMessage[]): EvidenceMessage[] {
  if (!claim || !claim.trim()) return messages.slice(0, 5);

  const keywords = claim
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 4);

  const scored = messages.map(m => {
    const text = (m.normalizedText ?? m.rawText).toLowerCase();
    const score = keywords.filter(kw => text.includes(kw)).length;
    return { m, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.m);
}

export function EvidencePanel({ claim, messages, maxVisible = 3 }: EvidencePanelProps) {
  const [expanded, setExpanded] = React.useState(false);

  const relevant = React.useMemo(() => filterRelevantMessages(claim, messages), [claim, messages]);

  if (!messages.length) return null;

  const visible = expanded ? relevant.slice(0, Math.min(relevant.length, maxVisible + 3)) : relevant.slice(0, maxVisible);

  // Rough confidence: fraction of messages that are analyzed
  const analyzedCount = messages.filter(m => m.analyzed).length;
  const confidence = messages.length > 0 ? analyzedCount / messages.length : 0;

  return (
    <div className="mt-2 border border-[var(--color-border-default)] dark:border-gray-700 rounded-[var(--radius-sm)] overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 text-xs font-medium',
          'bg-[var(--color-background-tertiary)] dark:bg-gray-800 hover:bg-[var(--color-background-tertiary)] dark:hover:bg-gray-750',
          'text-[var(--color-text-secondary)] dark:text-[var(--color-text-tertiary)] transition-colors'
        )}
      >
        <span>Evidence ({messages.length} messages)</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="bg-[var(--color-card-bg)] dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          {/* Confidence indicator */}
          <div className="px-3 py-2">
            <ConfidenceBar value={confidence} />
          </div>

          {/* Message list */}
          {visible.map(msg => {
            const aspect = msg.analysis?.conversionFormulaAspect;
            const emotion = msg.analysis?.emotion;
            return (
              <div key={msg.id} className="px-3 py-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-xs text-[var(--color-text-secondary)] dark:text-gray-300 italic leading-relaxed">
                    "{(msg.normalizedText ?? msg.rawText).slice(0, 200)}"
                  </p>
                  <CopyButton text={msg.rawText} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {aspect && (
                    <span className="text-[var(--text-xs)] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">
                      {aspect}
                    </span>
                  )}
                  {msg.analysis?.subAspect && (
                    <span className="text-[var(--text-xs)] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {msg.analysis.subAspect}
                    </span>
                  )}
                  {emotion && (
                    <span className="text-[var(--text-xs)] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                      {emotion}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {relevant.length > visible.length && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full px-3 py-2 text-xs text-violet-600 dark:text-violet-400 hover:bg-[var(--color-background-tertiary)] dark:hover:bg-gray-800 transition-colors text-center"
            >
              + {relevant.length - visible.length} more similar messages
            </button>
          )}
        </div>
      )}
    </div>
  );
}
