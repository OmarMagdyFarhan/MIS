/**
 * ProgressRewardModal — genuine intelligence summary shown when the user
 * completes the journey from evidence to first Customer Profile.
 *
 * Not a confetti animation — a real summary of what the system discovered.
 * Rule 7: "The product rewards progress."
 *
 * @module src/components/ProgressRewardModal
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Users, MessageSquare, Layers, Lightbulb } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Avatar } from '../types';
import { ConfettiBurst } from './ConfettiBurst';

interface ProgressRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewIntelligence: () => void;
  avatar: Avatar;
  evidenceCount: number;
  patternCount: number;
  topInsight?: string;
}

export const ProgressRewardModal: React.FC<ProgressRewardModalProps> = ({
  isOpen,
  onClose,
  onViewIntelligence,
  avatar,
  evidenceCount,
  patternCount,
  topInsight,
}) => {
  if (!isOpen) return null;

  /* Pull most powerful quoted evidence line from avatar if available */
  const powerQuote: string | undefined =
    (avatar as any).evidenceSnapshot?.topQuote ??
    (avatar as any).generation?.dominantProblems?.[0]?.evidence?.[0] ??
    undefined;

  return (
    <AnimatePresence>
      <ConfettiBurst />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-6"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-[var(--color-card-bg)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] shadow-[0_40px_80px_rgba(0,0,0,0.4)] max-w-[520px] w-full overflow-hidden"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-[#0A84FF]/10 to-transparent p-8 pb-6 border-b border-[var(--color-border-default)]">
            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-[var(--color-background-tertiary)] hover:bg-[var(--color-slate-elevated)] flex items-center justify-center transition-colors"
            >
              <X size={14} strokeWidth={2.5} className="text-[var(--color-text-secondary)]" />
            </button>

            <div className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#0A84FF] mb-3">
              🎉 First Customer Profile
            </div>
            <h2 className="text-[var(--text-xl)] font-display font-bold text-[var(--color-text-primary)] leading-tight tracking-tight">
              Your first customer profile is ready.
            </h2>
            <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] mt-2">
              Next up: explore the buying intelligence behind it.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-px bg-[var(--color-border-default)] border-b border-[var(--color-border-default)]">
            {[
              { icon: MessageSquare, value: String(evidenceCount), label: 'Evidence pieces' },
              { icon: Layers,        value: String(patternCount),   label: 'Patterns found' },
              { icon: Users,         value: '1',                   label: 'Profile generated' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="bg-[var(--color-card-bg)] py-5 px-4 text-center">
                <Icon size={16} strokeWidth={1.5} className="mx-auto mb-2 text-[#0A84FF] opacity-70" />
                <div className="text-[var(--text-lg)] font-semibold text-[var(--color-text-primary)] leading-none mb-1">{value}</div>
                <div className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.04em]">{label}</div>
              </div>
            ))}
          </div>

          {/* Intelligence summary */}
          <div className="p-8 space-y-5">
            <div>
              <div className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-secondary)] mb-2">
                Profile: {avatar.name}
              </div>
              <p className="text-[var(--text-base)] text-[var(--color-text-primary)] font-medium leading-relaxed">
                {avatar.description}
              </p>
            </div>

            {powerQuote && (
              <div className="bg-[var(--color-background-secondary)] rounded-[var(--radius-md)] p-4 border-l-4 border-[#0A84FF]">
                <div className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] text-[#0A84FF] mb-2">
                  Your customers say
                </div>
                <p className="text-[var(--text-base)] text-[var(--color-text-primary)] italic leading-relaxed">
                  "{powerQuote}"
                </p>
              </div>
            )}

            {topInsight && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[#0A84FF]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Lightbulb size={14} className="text-[#0A84FF]" />
                </div>
                <div>
                  <div className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-secondary)] mb-1">
                    Most important insight
                  </div>
                  <p className="text-[var(--text-base)] text-[var(--color-text-primary)] leading-relaxed">{topInsight}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-8 pb-8 flex gap-3">
            <button
              onClick={onViewIntelligence}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0A84FF] hover:bg-[#0A84FF] text-white rounded-[var(--radius-md)] font-bold text-[var(--text-base)] transition-colors shadow-[0_4px_20px_rgba(10,132,255,0.3)]"
            >
              View Buying Intelligence
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3.5 bg-[var(--color-background-tertiary)] hover:bg-[var(--color-slate-elevated)] text-[var(--color-text-secondary)] rounded-[var(--radius-md)] font-semibold text-[var(--text-base)] transition-colors"
            >
              Continue
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProgressRewardModal;
