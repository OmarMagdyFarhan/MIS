import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Lock, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DotNav } from '../DotNav';

interface AvatarMethod {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isLocked: boolean;
  tag?: string;
}

const METHODS: AvatarMethod[] = [
  {
    id: 'ai',
    title: 'AI Generated',
    description: 'Persona synthesised exclusively from your validated evidence clusters.',
    icon: <Sparkles className="text-[#0A84FF]" />,
    isLocked: false,
    tag: 'Evidence-driven'
  },
];

interface AvatarMethodSelectorProps {
  onSelect: (method: string) => void;
}

export const AvatarMethodSelector: React.FC<AvatarMethodSelectorProps> = ({ onSelect }) => {
  return (
    <div className="max-w-[1000px] mx-auto px-6 pt-24 pb-32 animate-fade-in font-sans text-white">
      <div className="mb-20">
        <DotNav 
            totalSteps={4} 
            currentStep={1} 
            stepName="AVATAR SYNTHESIS" 
            onStepClick={() => {}}
            isStageComplete={false} 
        />
      </div>

      <div className="text-center mb-24 space-y-6">
        <h2 className="text-[var(--text-xl)] font-display font-bold tracking-tight leading-[0.9] text-white">Select Intelligence.</h2>
        <p className="text-[var(--text-lg)] text-[#86868B] font-medium max-w-[600px] mx-auto leading-relaxed">
          The fidelity of your Ideal Customer Avatar determines the depth of the empathy engine's output. Select your synthesis vector.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {METHODS.map((method, i) => (
          <motion.div
            key={method.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
                delay: i * 0.1,
                duration: 1.2,
                ease: [0.32, 0.72, 0, 1]
            }}
            onClick={() => !method.isLocked && onSelect(method.id)}
            className={cn(
              "group relative bg-[var(--color-card-bg)] dark:bg-[#1D1D1F] border border-[var(--color-border-secondary)] dark:border-white/10 rounded-[var(--radius-md)] p-12 transition-all duration-700 overflow-hidden",
              method.isLocked 
                ? "opacity-50 grayscale border-transparent bg-[var(--color-background-tertiary)]/30 dark:bg-white/5" 
                : "hover:shadow-[0_60px_100px_-20px_rgba(0,0,0,0.1)] hover:-translate-y-2 cursor-pointer border-[var(--color-border-secondary)] hover:border-[#0A84FF]/20 shadow-sm"
            )}
          >
            <div className="relative z-20">
              <div className="flex items-start justify-between mb-10">
                <div className={cn(
                    "w-16 h-16 rounded-[var(--radius-md)] flex items-center justify-center transition-all duration-500",
                    method.isLocked ? "bg-white/50" : "bg-[var(--color-background-tertiary)] group-hover:bg-[#0A84FF] group-hover:text-white"
                )}>
                  {React.cloneElement(method.icon as any, { 
                      size: 32, 
                      strokeWidth: 2,
                      className: cn(
                          "transition-colors duration-500",
                          !method.isLocked && "group-hover:text-white"
                      )
                  })}
                </div>
                {method.tag && (
                  <span className={cn(
                    "text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full",
                    method.id === 'ai' ? "bg-[#0A84FF]/5 text-[#0A84FF]" : "bg-[#1D1D1F] text-white"
                  )}>
                    {method.tag}
                  </span>
                )}
              </div>

              <h3 className="text-[var(--text-xl)] font-bold mb-4 tracking-tight leading-tight transition-colors group-hover:text-[#0A84FF]">
                {method.title}
              </h3>
              <p className="text-[var(--text-lg)] text-[#6E6E73] dark:text-[#86868B] leading-relaxed mb-12 min-h-[50px] font-medium opacity-90 dark:opacity-100">
                {method.description}
              </p>

              <div className="flex items-center justify-between pt-10 border-t border-[var(--color-border-secondary)]">
                {method.isLocked ? (
                  <div className="flex items-center gap-3 text-[#86868B] opacity-40">
                    <Lock size={16} strokeWidth={2.5} />
                    <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em]">Module Encrypted</span>
                  </div>
                ) : (
                  <span className="text-[var(--text-base)] font-semibold uppercase tracking-[0.2em] text-[#0A84FF] flex items-center gap-2 group-hover:gap-4 transition-all">
                    Initiate Path <ChevronRight size={18} strokeWidth={3} />
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-32 flex justify-center">
        <div className="text-center group/footer">
            <p className="text-[var(--text-sm)] font-semibold text-[#86868B] uppercase tracking-[0.3em] mb-6 opacity-40 group-hover/footer:opacity-100 transition-opacity">Module Pipeline Status</p>
            <div className="flex items-center gap-3 justify-center mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] animate-pulse" />
                <span className="text-[var(--text-base)] font-bold text-white">AI Generation Online</span>
            </div>
            <div className="h-0.5 w-32 bg-[#D2D2D7]/20 rounded-full mx-auto relative overflow-hidden">
                <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-[#0A84FF] w-1/2 rounded-full"
                />
            </div>
        </div>
      </div>
    </div>
  );
};
