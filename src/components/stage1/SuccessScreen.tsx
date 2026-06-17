import React from 'react';
import { motion } from 'motion/react';
import { Check, ChevronRight } from 'lucide-react';
import { DotNav } from '../DotNav';

interface SuccessScreenProps {
  companyName: string;
  onAddAnother: () => void;
  onBuildOffer: () => void;
  onStepNav?: (step: number) => void;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({ companyName, onAddAnother, onBuildOffer, onStepNav }) => {
  return (
    <div className="max-w-[800px] mx-auto px-6 pt-16 pb-16 text-center font-sans bg-[var(--color-card-bg)]/50 backdrop-blur-xl rounded-[var(--radius-md)] border border-[var(--color-border-default)] shadow-2xl">
      <DotNav 
        totalSteps={4}
        currentStep={5}
        onStepClick={(s) => onStepNav?.(s)}
        stepName="Done"
        isStageComplete={true}
      />

      <div className="flex justify-center mb-12">
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: "spring", damping: 15 }}
          className="w-24 h-24 bg-[#0A84FF] rounded-[var(--radius-md)] flex items-center justify-center text-white shadow-2xl relative"
        >
          <div className="absolute inset-0 bg-[#0A84FF] rounded-[var(--radius-md)] animate-ping opacity-20" />
          <Check size={44} strokeWidth={4} />
        </motion.div>
      </div>

      <h2 className="text-[var(--text-xl)] font-display font-semibold mb-3 text-[var(--color-text-primary)] tracking-tight">
        {companyName} is set up
      </h2>
      <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] mb-10 max-w-[440px] mx-auto leading-relaxed">
        You're all set. Your company profile is saved and ready for the next step.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button 
          onClick={onAddAnother} 
          className="btn-secondary w-full sm:w-auto px-10 py-3.5 border-[var(--color-border-default)] hover:bg-[var(--color-slate-elevated)]"
        >
          Add another company
        </button>
        <button 
          onClick={onBuildOffer} 
          className="btn-primary w-full sm:w-auto px-10 py-3.5 group"
        >
          <span>Add evidence next</span>
          <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
