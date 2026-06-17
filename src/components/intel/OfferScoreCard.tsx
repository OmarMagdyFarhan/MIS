import React from 'react';
import { OfferScore } from '../../types';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface OfferScoreCardProps {
  score: OfferScore;
  className?: string;
}

export const OfferScoreCard: React.FC<OfferScoreCardProps> = ({ score, className }) => {
  const getScoreColor = (value: number) => {
    if (value >= 85) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (value >= 70) return "text-blue-600 bg-blue-50 border-blue-100";
    if (value >= 50) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-rose-600 bg-rose-50 border-rose-100";
  };

  const getScoreBg = (value: number) => {
    if (value >= 85) return "bg-emerald-500";
    if (value >= 70) return "bg-blue-500";
    if (value >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="text-[var(--text-sm)] font-semibold text-[#86868B] uppercase tracking-[0.2em] text-left">Strategic Score</h4>
          <p className="text-[var(--text-base)] font-medium text-[#86868B] text-left">Based on psychological resonance</p>
        </div>
        <div className={cn(
          "px-4 py-2 rounded-[var(--radius-md)] border-[var(--color-border-secondary)] flex items-center gap-2 font-semibold text-[var(--text-lg)]",
          getScoreColor(score.total)
        )}>
          {score.total}
          <span className="text-[var(--text-sm)] opacity-60">/100</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
        {[
          { label: 'Clarity', val: score.clarity, reasoning: score.clarityReasoning },
          { label: 'Relevance', val: score.relevance, reasoning: score.relevanceReasoning },
          { label: 'Urgency', val: score.urgency, reasoning: score.urgencyReasoning },
        ].map(s => (
          <div key={s.label} className="group relative p-3 bg-[var(--color-card-bg)] dark:bg-[#2C2C2E] rounded-[var(--radius-md)] border border-[var(--color-border-secondary)] dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.06em]">{s.label}</div>
              {s.reasoning && (
                <div className="relative group/info">
                  <Info size={12} className="text-[#0A84FF] cursor-help opacity-40 group-hover/info:opacity-100 transition-opacity" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-4 bg-[#1D1D1F] text-white text-[var(--text-sm)] rounded-[var(--radius-md)] shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 font-medium leading-relaxed pointer-events-none">
                    <div className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#0A84FF] mb-2">{s.label} Logic</div>
                    {s.reasoning}
                    <div className="absolute top-full right-4 transform border-8 border-transparent border-t-[#1D1D1F]" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-end gap-1.5">
               <span className="text-[var(--text-lg)] font-semibold leading-none text-[var(--color-text-primary)] dark:text-white">{s.val}</span>
               <div className="flex-1 h-1 bg-[var(--color-card-bg)] dark:bg-white/5 rounded-full overflow-hidden mb-1">
                 <div 
                   className={cn("h-full transition-all duration-1000", getScoreBg(s.val))} 
                   style={{ width: `${s.val}%` }} 
                 />
               </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 bg-[var(--color-card-bg)]/50 rounded-[var(--radius-md)] border border-[var(--color-border-secondary)] flex gap-4 text-left">
        <div className="w-10 h-10 rounded-full bg-[var(--color-card-bg)] flex items-center justify-center shrink-0 shadow-sm text-[#0A84FF]">
          <Info size={20} />
        </div>
        <div className="space-y-4 flex-1">
          <div>
            <span className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.2em] block mb-1">Smart Assessment</span>
            <p className="text-[var(--text-base)] text-[var(--color-text-primary)] font-medium leading-relaxed italic">
              "{score.reasoning}"
            </p>
          </div>

          {score.explanation && (
            <div className="pt-4 border-t border-[var(--color-border-secondary)]">
               <span className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.2em] block mb-2">How we calculated this</span>
               <p className="text-[var(--text-sm)] text-[#515154] leading-relaxed">
                 {score.explanation}
               </p>
            </div>
          )}

          {score.improvementTip && (
            <div className="pt-4 border-t border-[var(--color-border-secondary)] p-4 bg-emerald-50/50 rounded-[var(--radius-md)] border border-emerald-100">
               <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span className="text-[var(--text-xs)] font-semibold text-emerald-600 uppercase tracking-[0.06em]">How to improve</span>
               </div>
               <p className="text-[var(--text-sm)] text-emerald-900 font-bold leading-relaxed">
                 {score.improvementTip}
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
