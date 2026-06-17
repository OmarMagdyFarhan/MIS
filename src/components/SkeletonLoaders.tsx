/**
 * SkeletonLoaders — contextual, layout-stable loading states replacing
 * generic Loader2 spinners. Each variant mirrors the shape of the content
 * it precedes so the layout doesn't jump when real content arrives.
 *
 * @module src/components/SkeletonLoaders
 */

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const shimmer = 'animate-pulse bg-[var(--color-slate-elevated)]';

/** A single labeled loading state with a contextual message + spinner dot. */
export const ContextualLoadingMessage: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className }) => (
  <div
    role="status"
    aria-live="polite"
    className={cn('flex items-center gap-3 text-[var(--text-sm)] font-semibold text-[var(--color-text-secondary)]', className)}
  >
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0A84FF] opacity-50" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0A84FF]" />
    </span>
    {message}
  </div>
);

/** Card-shaped skeleton — for avatar cards, insight cards, etc. */
export const SkeletonCard: React.FC<{ className?: string; lines?: number }> = ({ className, lines = 3 }) => (
  <div className={cn('rounded-[var(--radius-md)] border border-[var(--color-border-default)] p-5 space-y-3', className)}>
    <div className={cn('h-5 w-1/2 rounded-full', shimmer)} />
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className={cn('h-3 rounded-full', shimmer, i === lines - 1 ? 'w-2/3' : 'w-full')} />
    ))}
  </div>
);

/** Evidence-quote skeleton — mirrors EvidencePanel / EvidenceDrawer list items. */
export const SkeletonQuote: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-[var(--radius-sm)] border border-[var(--color-border-default)] p-3 space-y-2', className)}>
    <div className={cn('h-3 w-full rounded-full', shimmer)} />
    <div className={cn('h-3 w-4/5 rounded-full', shimmer)} />
    <div className={cn('h-2 w-1/3 rounded-full', shimmer)} />
  </div>
);

/** FeelWheel hero skeleton — circular placeholder + legend rows. */
export const SkeletonFeelWheel: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex flex-col md:flex-row items-center gap-8 p-6', className)}>
    <div className={cn('w-[260px] h-[260px] rounded-full shrink-0', shimmer)} />
    <div className="flex-1 w-full space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn('h-4 rounded-full', shimmer)} style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  </div>
);

/**
 * Full-section contextual loader — combines a rotating contextual message
 * with skeleton cards. Used for the heavier "analyzing" / "generating"
 * states previously shown via GeneratingScreen / Loader2.
 */
export const ContextualSectionLoader: React.FC<{
  messages: string[];
  cardCount?: number;
  className?: string;
}> = ({ messages, cardCount = 3, className }) => {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => setIndex(i => (i + 1) % messages.length), 2200);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className={cn('w-full flex flex-col items-center gap-8 py-16', className)}>
      <motion.div key={index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <ContextualLoadingMessage message={messages[index] ?? 'Working on it…'} className="text-[var(--text-base)]" />
      </motion.div>
      <div className="w-full max-w-2xl grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cardCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
};
