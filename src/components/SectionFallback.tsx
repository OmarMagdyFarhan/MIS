import React from 'react';
import { ContextualLoadingMessage } from './SkeletonLoaders';

/**
 * Lightweight fallback used for lazy-loaded sections.
 *
 * Designed to:
 *  - Match the dark/light shell background (no flash of white)
 *  - Reserve roughly full-section height to avoid layout shift
 *  - Stay extremely cheap so it ships in the initial bundle
 *  - Show a contextual message (Phase 15) instead of a generic spinner
 */
interface Props {
  /** Optional label for screen readers / debugging (also shown if `messages` not given) */
  label?: string;
  /** Compact mode for modals/panels rather than full-page sections */
  compact?: boolean;
}

export function SectionFallback({ label = 'Loading', compact = false }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={
        compact
          ? 'w-full h-full min-h-[200px] flex items-center justify-center'
          : 'flex-1 w-full min-h-[60vh] flex items-center justify-center'
      }
    >
      <ContextualLoadingMessage message={label} />
    </div>
  );
}
