import React from 'react';
import { Search, X, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StepLayout } from './StepLayout';
import { SPECIALIZATIONS } from '../../constants';
import { Specialization } from '../../types';
import { cn } from '../../lib/utils';

interface Step3SpecializationProps {
  industry: string;
  logoUrl?: string;
  values: Specialization[];
  onChange: (vals: Specialization[]) => void;
  onContinue: () => void;
  onBack: () => void;
  onStepNav: (step: number) => void;
  isStageComplete?: boolean;
}

export const Step3Specialization: React.FC<Step3SpecializationProps> = ({
  industry,
  logoUrl,
  values,
  onChange,
  onContinue,
  onBack,
  onStepNav,
  isStageComplete
}) => {
  const [search, setSearch] = React.useState('');
  const [openNoteIndex, setOpenNoteIndex] = React.useState<string | null>(null);
  const [shouldShake, setShouldShake] = React.useState(false);
  const footerRef = React.useRef<HTMLDivElement>(null);

  const availableSpecs = SPECIALIZATIONS[industry] || [];
  const filteredSpecs = availableSpecs.filter(s => 
    s.toLowerCase().includes(search.toLowerCase())
  );

  const isOtherSelected = values.some(v => v.name.startsWith('Other: ') || v.name === 'Others');
  const otherValue = values.find(v => v.name.startsWith('Other: '))?.name.replace('Other: ', '') || '';

  const handleToggle = (name: string) => {
    const exists = values.find(v => v.name === name);
    if (exists) {
      onChange(values.filter(v => v.name !== name));
    } else {
      onChange([...values, { name, note: '' }]);
      
      // Scroll to footer and shake if first selection
      if (values.length === 0) {
        setTimeout(() => {
          footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setShouldShake(true);
          setTimeout(() => setShouldShake(false), 500);
        }, 100);
      }
    }
  };

  const handleNoteChange = (name: string, note: string) => {
    onChange(values.map(v => v.name === name ? { ...v, note } : v));
  };

  const handleOtherChange = (val: string) => {
    const othersIdx = values.findIndex(v => v.name.startsWith('Other: ') || v.name === 'Others');
    if (othersIdx > -1) {
      const newValues = [...values];
      newValues[othersIdx] = { name: val ? `Other: ${val}` : 'Others', note: '' };
      onChange(newValues);
    }
  };

  const removeTag = (name: string) => {
    onChange(values.filter(v => v.name !== name));
  };

  const isContinueDisabled = values.length === 0 || (isOtherSelected && !otherValue.trim() && values.some(v => v.name === 'Others'));

  return (
    <StepLayout
      step={3}
      totalSteps={4}
      stepName="Specialty"
      title="Your specialty"
      description="Pick the specific areas you specialize in. This helps us tailor messaging to your audience."
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
              disabled={isContinueDisabled}
              onClick={onContinue}
              className="btn-primary w-full py-5 text-[var(--text-base)] group"
            >
              Analyze Focus Areas
              <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      }
    >
      {/* Selected Tags */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8 max-h-32 overflow-y-auto custom-scrollbar px-1">
          {values.map((spec) => (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              key={spec.name}
              className="flex items-center gap-2 bg-[#0A84FF]/10 border border-[#0A84FF]/20 rounded-full pl-5 pr-2 py-2 text-[var(--text-sm)] text-[#0A84FF] font-bold shadow-sm"
            >
              <span className="truncate max-w-[180px] tracking-tight">{spec.name.replace('Other: ', '')}</span>
              <button 
                onClick={() => removeTag(spec.name)} 
                className="w-6 h-6 rounded-full hover:bg-[#0A84FF] hover:text-white flex items-center justify-center transition-all bg-white/20"
              >
                <X size={12} strokeWidth={4} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-10 max-w-[600px] mx-auto">
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          <Search size={18} className="text-[var(--color-text-secondary)] opacity-40" strokeWidth={3} />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter strategic capabilities..."
          className="input-premium w-full pl-14 py-6"
        />
      </div>

      {/* Specialization List */}
      <div className="space-y-4">
        {filteredSpecs.length === 0 && availableSpecs.length > 0 && (
          <div className="py-12 text-center glass-panel rounded-[var(--radius-md)] border-dashed border-[var(--color-border-default)]">
            <div className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.3em] opacity-40 mb-2">Zero Matches</div>
            <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] font-medium">Use the custom capability input below.</p>
          </div>
        )}

        {filteredSpecs.map((spec) => {
          const isSelected = values.some(v => v.name === spec);
          const currentNote = values.find(v => v.name === spec)?.note || '';
          
          return (
            <div key={spec}>
              <div 
                className={cn(
                  "flex items-center p-6 rounded-[var(--radius-md)] cursor-pointer transition-all duration-500 border",
                  isSelected 
                    ? "bg-[#0A84FF]/5 border-[#0A84FF] shadow-md shadow-[#0A84FF]/5" 
                    : "bg-[var(--color-card-bg)] border-[var(--color-border-default)] hover:border-[var(--color-text-placeholder)] hover:bg-[var(--color-slate-elevated)]"
                )}
                onClick={() => handleToggle(spec)}
              >
                <div className={cn(
                  "w-7 h-7 rounded-[var(--radius-sm)] border-[var(--color-border-secondary)] flex items-center justify-center mr-5 transition-all duration-700",
                  isSelected ? "bg-[#0A84FF] border-[#0A84FF] scale-110 shadow-lg shadow-[#0A84FF]/30" : "bg-[var(--color-slate-elevated)] border-[var(--color-border-default)]"
                )}>
                  {isSelected && <Check size={16} className="text-white" strokeWidth={4} />}
                </div>
                <span className={cn(
                  "text-[var(--text-base)] flex-1 font-bold tracking-tight transition-colors",
                  isSelected ? "text-[#0A84FF]" : "text-[var(--color-text-primary)]"
                )}>{spec}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isSelected) handleToggle(spec);
                    setOpenNoteIndex(openNoteIndex === spec ? null : spec);
                  }}
                  className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)] hover:text-[#0A84FF] px-4 py-2 rounded-full hover:bg-[#0A84FF]/10 border border-transparent hover:border-[#0A84FF]/20 transition-all font-mono"
                >
                  {openNoteIndex === spec ? 'Collapse' : 'Insights'}
                </button>
              </div>
              <AnimatePresence>
                {openNoteIndex === spec && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 ml-12 overflow-hidden"
                  >
                    <textarea
                      value={currentNote}
                      onChange={(e) => handleNoteChange(spec, e.target.value)}
                      placeholder="Specify the industrial depth or strategic context for this capability..."
                      className="input-premium w-full h-32 py-5 px-6 focus:bg-[var(--color-card-bg)]"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Others Option */}
        <div>
          <div 
            className={cn(
              "flex items-center p-6 rounded-[var(--radius-md)] cursor-pointer transition-all duration-500 border",
              isOtherSelected 
                ? "bg-[#0A84FF]/5 border-[#0A84FF] shadow-md shadow-[#0A84FF]/5" 
                : "bg-[var(--color-card-bg)] border-[var(--color-border-default)] hover:border-[var(--color-text-placeholder)] hover:bg-[var(--color-slate-elevated)]"
            )}
            onClick={() => handleToggle('Others')}
          >
            <div className={cn(
                  "w-7 h-7 rounded-[var(--radius-sm)] border-[var(--color-border-secondary)] flex items-center justify-center mr-5 transition-all duration-700",
                  isOtherSelected ? "bg-[#0A84FF] border-[#0A84FF] scale-110 shadow-lg shadow-[#0A84FF]/30" : "bg-[var(--color-slate-elevated)] border-[var(--color-border-default)]"
            )}>
              {isOtherSelected && <Check size={16} className="text-white" strokeWidth={4} />}
            </div>
            <span className={cn(
              "text-[var(--text-base)] flex-1 font-bold tracking-tight transition-colors",
              isOtherSelected ? "text-[#0A84FF]" : "text-[var(--color-text-primary)]"
            )}>Add custom specialization</span>
          </div>
          <AnimatePresence>
            {isOtherSelected && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 ml-12 overflow-hidden"
              >
                <input
                  type="text"
                  value={otherValue}
                  onChange={(e) => handleOtherChange(e.target.value)}
                  placeholder="Define discrete industrial specialization..."
                  className="input-premium w-full py-5 text-[var(--text-base)] font-bold"
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </StepLayout>
  );
};
