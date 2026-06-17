import React from 'react';
import { Brain, ChevronRight, BarChart2, Users, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { TransitionWrapper } from '../components/TransitionWrapper';

interface Props {
  onStart: () => void;
}

export function WelcomeView({ onStart }: Props) {
  return (
    <TransitionWrapper id="welcome">
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-[var(--color-bg-primary)] dark:bg-[#000000]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-24 h-24 mb-10 relative"
        >
          <div className="relative w-full h-full bg-[#1D1D1F] dark:bg-[#111111] border border-white/5 rounded-[var(--radius-md)] flex items-center justify-center shadow-xl">
            <Brain className="text-white" size={40} strokeWidth={1.5} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
          className="space-y-5 max-w-[520px]"
        >
          <h1 className="text-[var(--text-xl)] sm:text-[var(--text-xl)] font-display font-bold tracking-tight text-[#1D1D1F] dark:text-white leading-tight">
            Understand why customers buy — and what stops them.
          </h1>
          <p className="text-[var(--text-base)] sm:text-[var(--text-lg)] text-[#86868B] dark:text-[#A1A1A6] leading-relaxed">
            Add real customer feedback. Discover buying patterns. Get customer profiles backed by evidence — not guesswork.
          </p>

          {/* 3-step visual */}
          <div className="flex items-center justify-center gap-4 pt-4">
            {[
              { icon: BarChart2, label: 'Add evidence' },
              { icon: TrendingUp, label: 'Find patterns' },
              { icon: Users, label: 'Get profiles' },
            ].map(({ icon: Icon, label }, i) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[#1D1D1F] dark:bg-white/10 flex items-center justify-center">
                    <Icon size={18} className="text-white dark:text-white/80" strokeWidth={1.5} />
                  </div>
                  <span className="text-[var(--text-xs)] text-[#86868B] dark:text-[#A1A1A6]">{label}</span>
                </div>
                {i < 2 && (
                  <ChevronRight size={14} className="text-[#C7C7CC] dark:text-white/20 mb-4" />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="pt-6">
            <button onClick={onStart} className="btn-primary group">
              Get started
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </div>
    </TransitionWrapper>
  );
}
