import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Building2, Sparkles, UserCircle2, BarChart3, Megaphone, ChevronRight, Lock, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { Progress } from '../types';

interface PhaseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  progress?: Progress;
  onSelectPhase: (phase: 'company' | 'offer' | 'avatar') => void;
}

const PHASES = [
  {
    id: 'company',
    title: 'Company',
    icon: Building2,
    color: 'text-blue-400',
    bg: 'bg-blue-900/20',
    description: 'Update your industry, name, and unique selling proposition.',
    disabled: false
  },
  {
    id: 'evidence',
    title: 'Evidence',
    icon: Sparkles,
    color: 'text-amber-400',
    bg: 'bg-amber-900/20',
    description: 'Mine real market evidence and seed the intelligence corpus.',
    disabled: false
  },
  {
    id: 'segments',
    title: 'Segments',
    icon: UserCircle2,
    color: 'text-purple-400',
    bg: 'bg-purple-900/20',
    description: 'Validate customer clusters and deep-dive avatar psychology.',
    disabled: false
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    icon: BarChart3,
    color: 'text-green-400',
    bg: 'bg-green-900/20',
    description: 'Synthesise market intelligence and avatar offer packages.',
    disabled: false
  },
  {
    id: 'strategy',
    title: 'Strategy',
    icon: Megaphone,
    color: 'text-rose-400',
    bg: 'bg-rose-900/20',
    description: 'Build launch strategy from your synthesised core offer.',
    disabled: false
  },
] as const;

export const PhaseSelectionModal: React.FC<PhaseSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  projectName,
  progress,
  onSelectPhase 
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-[var(--color-card-bg)] w-full max-w-sm rounded-[var(--radius-md)] shadow-2xl overflow-hidden"
          >
            <div className="p-8 pb-4">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-[var(--text-lg)] font-bold tracking-tight text-[var(--color-text-primary)]">Refine Project</h2>
                  <p className="text-[var(--text-sm)] text-[var(--color-text-tertiary)] font-medium">{projectName}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-[var(--color-background-tertiary)] rounded-full transition-colors text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {PHASES.map((phase) => {
                  const Icon = phase.icon;
                  const isLocked = phase.disabled;
                  const complete = phase.id === 'company' ? progress?.stage1Complete : phase.id === 'evidence' ? progress?.stage2Complete : false;

                  return (
                    <button
                      key={phase.id}
                      disabled={isLocked}
                      onClick={() => {
                        onClose();
                        onSelectPhase(phase.id as any);
                      }}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-[var(--radius-md)] border-[var(--color-border-secondary)] transition-all text-left group",
                        isLocked 
                          ? "bg-[var(--color-background-tertiary)] border-transparent opacity-60 cursor-not-allowed"
                          : "bg-[var(--color-card-bg)] border-[var(--color-border-default)] hover:border-blue-500 hover:shadow-md active:scale-[0.98]"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-[var(--radius-sm)] flex items-center justify-center transition-colors shadow-sm",
                        !isLocked && phase.bg,
                        !isLocked && phase.color,
                        isLocked && "bg-[var(--color-background-tertiary)] text-[var(--color-text-tertiary)]"
                      )}>
                        <Icon size={24} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text-base)] text-[var(--color-text-primary)]">{phase.title}</span>
                          {complete && <Check size={14} className="text-green-500" />}
                          {isLocked && <Lock size={12} className="text-[var(--color-text-tertiary)]" />}
                        </div>
                        <p className="text-[var(--text-xs)] text-[var(--color-text-tertiary)] leading-tight mt-0.5">{phase.description}</p>
                      </div>

                      {!isLocked && (
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 bg-[var(--color-background-tertiary)]/50 border-t border-[var(--color-border-default)] flex justify-center">
              <button 
                onClick={onClose}
                className="text-[var(--text-base)] font-bold text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors px-8 py-2"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
