import React from 'react';
import { Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { StepLayout } from './StepLayout';
import { cn } from '../../lib/utils';
import { generateAIContent } from '../../services/aiService';

interface Step4USPProps {
  companyName: string;
  industry: string;
  logoUrl?: string;
  specializations: string[];
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onBack: () => void;
  onStepNav: (step: number) => void;
  isStageComplete?: boolean;
}

export const Step4USP: React.FC<Step4USPProps> = ({
  companyName,
  industry,
  logoUrl,
  specializations,
  value,
  onChange,
  onSave,
  onBack,
  onStepNav,
  isStageComplete
}) => {
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [shouldShake, setShouldShake] = React.useState(false);
  const footerRef = React.useRef<HTMLDivElement>(null);

  const getSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateAIContent({
        systemPrompt: "You are a marketing strategist. Return ONLY a raw JSON array of 3 strings. No explanation, no markdown, no code blocks.",
        userMessage: `Company: ${companyName}. Industry: ${industry}. Specializations: ${specializations.join(', ')}. Generate 3 compelling Unique Selling Points.`,
        jsonResponse: true
      });
      
      if (Array.isArray(data)) {
        setSuggestions(data);
      } else {
        throw new Error("Invalid response format from AI");
      }
    } catch (err: any) {
      console.error("USP Suggestions Error:", err);
      setError(err.message || "Couldn't load suggestions — write your own above.");
    } finally {
      setLoading(false);
    }
  };

  const handlePickSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setTimeout(() => {
      footerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
    }, 100);
  };

  return (
    <StepLayout
      step={4}
      totalSteps={4}
      stepName="What makes you different"
      title="What makes you different"
      description="What makes you different from competitors? Be specific."
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
              onClick={onSave}
              className="btn-primary w-full py-5 text-[var(--text-base)] group"
            >
              {value.trim() ? "Finalize Brand Identity" : "Skip & Save Configuration"}
              <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      }
    >
      <div className="space-y-12 flex flex-col items-center max-w-[600px] mx-auto pb-12">
        <div className="w-full space-y-4">
           <span className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.06em] px-1 text-center block opacity-60">Strategic Differentiator</span>
           <textarea
             value={value}
             onChange={(e) => onChange(e.target.value)}
             placeholder="e.g. The only Cairo-based entity delivering high-fidelity industrial components within 24 hours of protocol initiation."
             className="input-premium w-full h-44 resize-none text-center p-10 text-[var(--text-lg)] font-display font-bold leading-relaxed custom-scrollbar shadow-inner"
           />
        </div>

        <div className="flex flex-col items-center w-full">
           <div className="relative py-4 w-full mb-8">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center px-4 pointer-events-none">
                    <div className="w-full h-[1px] bg-[var(--color-border-default)]" />
                    <span className="bg-[var(--color-primary-bg)] px-6 text-[var(--text-xs)] font-semibold text-[var(--color-text-placeholder)] uppercase tracking-[0.4em] shrink-0 font-mono">Neural_Assist</span>
                    <div className="w-full h-[1px] bg-[var(--color-border-default)]" />
                </div>
            </div>

          <button
            onClick={getSuggestions}
            disabled={loading}
            className="btn-secondary flex items-center gap-3 px-10 border-[var(--color-border-default)] glass-panel hover:bg-[var(--color-slate-elevated)]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="text-[#0A84FF] fill-[#0A84FF]/20" />}
            <span className="uppercase tracking-[0.2em] text-[var(--text-xs)] font-semibold">
              {loading ? "Synthesizing_Matrix..." : "✦ Suggest Differentiators"}
            </span>
          </button>
          
          {error && (
            <p className="mt-4 text-[var(--text-sm)] text-rose-500 font-bold uppercase tracking-tight">{error}</p>
          )}
        </div>

        {suggestions.length > 0 && !loading && (
          <div className="space-y-4 w-full">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handlePickSuggestion(suggestion)}
                className="w-full text-center p-8 bg-[var(--color-card-bg)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] text-[var(--text-lg)] font-bold text-[var(--color-text-primary)] hover:border-[#0A84FF] hover:bg-[#0A84FF]/5 transition-all shadow-sm active:scale-[0.98] tracking-tight leading-relaxed group"
              >
                <div className="text-[var(--text-xs)] text-[#0A84FF] font-mono mb-2 opacity-0 group-hover:opacity-100 transition-opacity">SUGGESTION_0{i+1}</div>
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </StepLayout>
  );
};
