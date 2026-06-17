import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Sparkles, TrendingUp, AlertCircle, CheckCircle2, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';
import { SynthesisReport } from '../services/synthesisService';
import { cn } from '../lib/utils';

interface ConsultantReportProps {
  report: SynthesisReport | null;
  onProceed: () => void;
  onBack: () => void;
  isLoading: boolean;
  stageName: string;
}

export const ConsultantReport: React.FC<ConsultantReportProps> = ({
  report,
  onProceed,
  onBack,
  isLoading,
  stageName
}) => {
  const [activeTab, setActiveTab] = React.useState<'strengths' | 'weaknesses' | 'recommendations'>('strengths');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 p-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full animate-pulse" />
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 10, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }}
            className="relative w-32 h-32 bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] rounded-[var(--radius-md)] flex items-center justify-center shadow-2xl"
          >
            <Brain className="text-[var(--color-accent-blue)]" size={48} strokeWidth={1.5} />
          </motion.div>
        </div>

        <div className="space-y-6 max-w-md">
           <h2 className="text-[var(--text-xl)] font-display font-semibold text-[var(--color-text-primary)] tracking-tight">Intelligence Synthesis</h2>
           <div className="flex flex-col gap-2">
              <ThinkingLine delay={0} text="Mapping associative data nodes..." />
              <ThinkingLine delay={2000} text="Running adversarial strategic probe..." />
              <ThinkingLine delay={4000} text="Checking how this lands with your market..." />
              <ThinkingLine delay={6000} text="Drafting professional recommendations..." />
           </div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[800px] mx-auto px-6 py-12"
    >
      <header className="text-center mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 text-blue-500 rounded-full text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em]">
          <Sparkles size={14} /> Stratos Consultant Report
        </div>
        <h1 className="text-[var(--text-xl)] font-display font-extrabold text-[var(--color-text-primary)] leading-[1.1] tracking-tight">
          Phase {stageName}: <span className="text-blue-500">Deconstructed</span>
        </h1>
        <p className="text-[var(--text-lg)] text-[var(--color-text-secondary)] font-medium max-w-[600px] mx-auto">
          I've analyzed your inputs against global market benchmarks and psychological triggers. Here is your strategic breakdown.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="md:col-span-2 space-y-8">
           {/* Rating Card */}
           <div className="p-10 bg-[var(--color-card-elevated)] dark:bg-[var(--color-slate-elevated)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] dark:border-[var(--color-border-default)] flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.3em] mb-2 block opacity-100 dark:opacity-100">Strategic Viability</span>
                <div className="flex items-baseline gap-2">
                   <span className="text-[var(--text-xl)] font-display font-semibold leading-none">{report.rating}</span>
                   <span className="text-[var(--text-xl)] font-bold text-[var(--color-text-secondary)] opacity-100 dark:opacity-40">/10</span>
                </div>
              </div>
              <div className="text-right max-w-[240px]">
                 <span className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.3em] mb-2 block opacity-100 dark:opacity-100">Verdict</span>
                 <p className="text-[var(--text-base)] font-bold text-[var(--color-text-primary)] leading-relaxed italic border-r-4 border-blue-500 pr-4">
                   “{report.verdict}”
                 </p>
              </div>
           </div>

           {/* Content Tabs */}
           <div className="space-y-6">
              <div className="flex gap-4 p-1.5 bg-[var(--color-card-elevated)] dark:bg-[var(--color-slate-elevated)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] dark:border-[var(--color-border-default)]">
                 {(['strengths', 'weaknesses', 'recommendations'] as const).map(tab => (
                   <button
                     key={tab}
                     onClick={() => setActiveTab(tab)}
                     className={cn(
                       "flex-1 py-3 text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] rounded-[var(--radius-sm)] transition-all",
                       activeTab === tab 
                        ? "bg-[var(--color-card-bg)] dark:bg-[#1D1D1F] text-[var(--color-text-primary)] shadow-md border border-[var(--color-border-default)] dark:border-[var(--color-border-default)]" 
                        : "text-[var(--color-text-secondary)] opacity-80 dark:opacity-100 hover:opacity-100 hover:text-[var(--color-text-primary)]"
                     )}
                   >
                     {tab}
                   </button>
                 ))}
              </div>

              <div className="p-8 bg-[var(--color-card-bg)] dark:bg-[#1D1D1F] rounded-[var(--radius-md)] border border-[var(--color-border-default)] dark:border-[var(--color-border-default)] min-h-[300px] shadow-sm flex flex-col">
                 <AnimatePresence mode="wait">
                    <motion.ul
                      key={activeTab}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-4"
                    >
                      {(report[activeTab] || []).map((item, i) => (
                        <li key={i} className="flex gap-4 items-start group">
                           <div className={cn(
                             "mt-1.5 w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-125",
                             activeTab === 'strengths' ? 'bg-emerald-500' : 
                             activeTab === 'weaknesses' ? 'bg-amber-500' : 'bg-blue-500'
                           )} />
                           <span className="text-[var(--text-base)] text-[var(--color-text-primary)] leading-relaxed font-medium">
                             {item}
                           </span>
                        </li>
                      ))}
                    </motion.ul>
                 </AnimatePresence>
              </div>
           </div>
        </div>

        <div className="space-y-8">
           <div className="p-8 bg-blue-500 rounded-[var(--radius-md)] text-white space-y-6 shadow-2xl shadow-blue-500/20">
              <div className="w-12 h-12 bg-white/20 rounded-[var(--radius-md)] flex items-center justify-center">
                 <TrendingUp size={24} />
              </div>
              <h4 className="text-[var(--text-lg)] font-bold leading-tight">Proceed to next dimension?</h4>
              <p className="text-[var(--text-base)] text-white/80 leading-relaxed">
                If you're happy with this, let's move to the next step. Otherwise, go back and refine your inputs.
              </p>
              <button 
                onClick={onProceed}
                className="w-full py-4 bg-[var(--color-card-bg)] text-blue-500 rounded-[var(--radius-md)] font-semibold uppercase tracking-[0.06em] text-[var(--text-sm)] hover:scale-[1.02] transition-transform"
              >
                Continue Phase
              </button>
           </div>

           <button 
             onClick={onBack}
             className="w-full py-6 bg-[var(--color-slate-elevated)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] flex items-center justify-center gap-3 text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg)] dark:hover:bg-[#2C2C2E] transition-all group"
           >
             <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
             <span className="text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em]">Back to Polishing</span>
           </button>
        </div>
      </div>
    </motion.div>
  );
};

const ThinkingLine = ({ delay, text }: { delay: number, text: string }) => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 justify-center text-[var(--color-text-secondary)]"
    >
      <Loader2 size={14} className="animate-spin opacity-40" />
      <span className="text-[var(--text-sm)] font-mono uppercase tracking-[0.2em]">{text}</span>
    </motion.div>
  );
};
