/**
 * EvidenceDrawer — global right-side drawer showing the evidence backing
 * any claim, insight, or avatar attribute across the workspace.
 *
 * Opened via `uiStore.openEvidenceDrawer(context)`. Reuses the confidence
 * badge and quote-list conventions from EvidencePanel/CitedClaimDisplay
 * ("GitHub blame view" — show exactly which quotes back this claim).
 *
 * @module src/components/EvidenceDrawer
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Quote, Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEvidenceDrawer } from '../stores/uiStore';
import { ConfidenceBadge } from './ConfidenceBadge';
import { EmptyState } from './EmptyState';
import { FileSearch } from 'lucide-react';

function CopyQuoteButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors — non-critical
    }
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy quote"
      className="p-1 rounded transition-colors shrink-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-slate-elevated)]"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export const EvidenceDrawer: React.FC = () => {
  const { context, isOpen, close } = useEvidenceDrawer();

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && context && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/40 z-[1200]"
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            role="complementary"
            aria-label="Evidence detail"
            className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[var(--color-card-bg)] border-l border-[var(--color-border-default)] z-[1201] flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.25)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-[var(--color-border-default)]">
              <div className="min-w-0">
                {context.sourceLabel && (
                  <div className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] mb-1">
                    {context.sourceLabel}
                  </div>
                )}
                <h2 className="text-[var(--text-base)] font-bold text-[var(--color-text-primary)] leading-snug">
                  {context.title}
                </h2>
                {context.confidence !== undefined && (
                  <div className="mt-2">
                    <ConfidenceBadge confidence={context.confidence} />
                  </div>
                )}
              </div>
              <button
                onClick={close}
                className="p-2 rounded-full hover:bg-[var(--color-slate-elevated)] transition-colors shrink-0"
                aria-label="Close evidence drawer"
              >
                <X size={18} className="text-[var(--color-text-secondary)]" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
              <div className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] mb-3">
                Supporting quotes ({context.messages.length})
              </div>

              {context.messages.length === 0 ? (
                <EmptyState
                  icon={FileSearch}
                  title="No linked quotes yet"
                  description="This claim isn't linked to specific source messages in the current corpus. Add more evidence to strengthen it."
                  className="!p-6 !rounded-[var(--radius-md)]"
                />
              ) : (
                <ul className="space-y-3">
                  {context.messages.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-primary-bg)]/40 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <Quote size={12} className="mt-1 text-[#0A84FF]/50 shrink-0" />
                        <p className="text-[var(--text-sm)] text-[var(--color-text-primary)] leading-relaxed italic flex-1">
                          {m.rawText}
                        </p>
                        <CopyQuoteButton text={m.rawText} />
                      </div>
                      <div className="flex items-center gap-2 mt-2 pl-5">
                        {m.sourceLabel && (
                          <span className="text-[var(--text-xs)] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                            {m.sourceLabel}
                          </span>
                        )}
                        {m.analysis?.qualityScore !== undefined && (
                          <span
                            className={cn(
                              'text-[var(--text-xs)] font-bold uppercase tracking-[0.06em]',
                              m.analysis.qualityScore >= 0.7 ? 'text-emerald-500' :
                              m.analysis.qualityScore >= 0.4 ? 'text-amber-500' : 'text-rose-400'
                            )}
                          >
                            {Math.round(m.analysis.qualityScore * 100)}% quality
                          </span>
                        )}
                        {m.analysis?.emotion && (
                          <span className="text-[var(--text-xs)] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                            {m.analysis.emotion}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
