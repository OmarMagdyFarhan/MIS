import React from 'react';
import type { MessageEmotion } from '../../types';
import { cn } from '../../lib/utils';

const CORE_COLORS: Record<string, string> = {
  Happy:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Surprised: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  Bad:       'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)] dark:bg-gray-800 dark:text-gray-300',
  Fearful:   'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Angry:     'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Disgusted: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  Sad:       'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

interface EmotionBadgeProps {
  emotion: MessageEmotion;
  compact?: boolean;
}

export const EmotionBadge: React.FC<EmotionBadgeProps> = ({ emotion, compact }) => {
  if (compact) {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[var(--text-xs)] font-medium',
        CORE_COLORS[emotion.core] ?? CORE_COLORS['Bad']
      )}>
        {emotion.specific}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[var(--text-xs)] text-[var(--color-text-tertiary)] dark:text-[var(--color-text-secondary)]">Feel:</span>
      <span className={cn(
        'inline-flex px-2 py-0.5 rounded-full text-[var(--text-xs)] font-semibold',
        CORE_COLORS[emotion.core] ?? CORE_COLORS['Bad']
      )}>
        {emotion.specific}
      </span>
      <span className="text-[var(--text-xs)] text-gray-300 dark:text-[var(--color-text-secondary)]">
        {emotion.mid} · {emotion.core}
      </span>
    </div>
  );
};
