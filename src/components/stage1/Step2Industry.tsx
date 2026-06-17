import React from 'react';
import { Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { StepLayout } from './StepLayout';
import { INDUSTRIES } from '../../constants';
import { cn } from '../../lib/utils';

interface Step2IndustryProps {
  value: string;
  logoUrl?: string;
  onChange: (val: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onStepNav: (step: number) => void;
  isStageComplete?: boolean;
}

export const Step2Industry: React.FC<Step2IndustryProps> = ({ 
  value, 
  logoUrl,
  onChange, 
  onContinue, 
  onBack, 
  onStepNav, 
  isStageComplete 
}) => {
  const [search, setSearch] = React.useState('');
  const [shouldShake, setShouldShake] = React.useState(false);
  const footerRef = React.useRef<HTMLDivElement>(null);

  const filteredIndustries = INDUSTRIES.filter(i => 
    i.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (industry: string) => {
    const isNewSelection = value !== industry;
    onChange(industry);
    
    if (isNewSelection && industry !== '') {
      // Scroll to footer
      setTimeout(() => {
        footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Trigger shake
        setShouldShake(true);
        setTimeout(() => setShouldShake(false), 500);
      }, 100);
    }
  };

  return (
    <StepLayout
      step={2}
      totalSteps={4}
      stepName="Industry"
      title="Your industry"
      description="Choose the industry that best fits your business. We'll use it to tailor your results."
      onBack={onBack}
      onStepNav={onStepNav}
      isStageComplete={isStageComplete}
      logoUrl={logoUrl}
      footer={
        <div ref={footerRef}>
          <motion.div
            animate={shouldShake ? {
              x: [-2, 2, -2, 2, 0],
            } : {}}
            transition={{ duration: 0.4 }}
          >
            <button
              disabled={!value}
              onClick={onContinue}
              className="btn-primary w-full py-5 text-[var(--text-base)] group"
            >
              Confirm Industry Vector
              <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      }
    >
      <div className="relative mb-8 max-w-[600px] mx-auto">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <Search size={18} className="text-[var(--color-text-secondary)] opacity-40" strokeWidth={3} />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter strategic ecosystems..."
          className="input-premium w-full pl-14 py-6"
        />
      </div>

      {filteredIndustries.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          {filteredIndustries.map((industry) => (
            <button
              key={industry}
              onClick={() => handleSelect(industry)}
              className={cn(
                "p-8 rounded-[var(--radius-md)] border text-[var(--text-base)] font-semibold uppercase tracking-[0.06em] text-center transition-all duration-500",
                value === industry
                  ? "bg-[#0A84FF] border-[#0A84FF] text-white shadow-2xl shadow-[#0A84FF]/30 scale-105 z-10"
                  : "bg-[var(--color-card-bg)] dark:bg-[var(--color-card-bg)] border-[var(--color-border-default)] dark:border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-elevated)] dark:hover:bg-[var(--color-slate-elevated)] hover:text-[var(--color-text-primary)] hover:border-[#0A84FF]/60 shadow-sm"
              )}
            >
              {industry}
            </button>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center glass-panel rounded-[var(--radius-md)] border-dashed">
            <div className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.4em] opacity-40 mb-3">Null Vector</div>
            <div className="text-[var(--color-text-secondary)] font-medium">No matching industry profiles identified.</div>
        </div>
      )}
    </StepLayout>
  );
};
