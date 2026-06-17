import React from 'react';
import { cn } from '../lib/utils';

interface DotNavProps {
  totalSteps: number;
  currentStep: number;
  onStepClick: (step: number) => void;
  stepName: string;
  isStageComplete?: boolean;
}

export const DotNav: React.FC<DotNavProps> = ({ totalSteps, currentStep, onStepClick, stepName, isStageComplete }) => {
  return (
    <div className="flex flex-col items-center gap-4 mb-12 pointer-events-auto">
      <div className="relative flex items-center justify-center gap-6">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep || isStageComplete;
          const isCurrent = step === currentStep;
          
          return (
            <button
              key={i}
              type="button"
              onClick={() => (isCompleted || isCurrent ? onStepClick(step) : null)}
              className={cn(
                "relative z-10 rounded-[var(--radius-full)] flex items-center justify-center transition-all duration-300 font-semibold text-[var(--text-sm)]",
                isCurrent 
                  ? "w-9 h-9 bg-[#0A84FF] text-white scale-110" 
                  : isCompleted
                    ? "w-3 h-3 bg-[#0A84FF] cursor-pointer hover:scale-150"
                    : "w-2.5 h-2.5 bg-[#D2D2D7] dark:bg-[var(--color-border-default)] cursor-default"
              )}
              aria-label={`Step ${step}`}
            >
              {isCurrent ? step : null}
              
              {/* Optional: Label below the dot */}
              {isCurrent && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[var(--text-xs)] font-medium text-[#0A84FF] uppercase tracking-[0.06em] animate-in fade-in slide-in-from-top-2">
                    {stepName}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
