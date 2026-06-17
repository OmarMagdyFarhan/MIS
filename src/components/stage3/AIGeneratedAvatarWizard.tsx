import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, Check, ShieldCheck, ArrowRight, UserCircle2, Info, ChevronRight, MessageCircle, BarChart3, Target, Zap, Heart, Star, Filter, ArrowLeft, History, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { DotNav } from '../DotNav';
import { Company, Offer, Avatar, SynthesisReport } from '../../types';
import { generateInitialAvatars, deepDiveAvatar, deepDiveAvatarStream, generateSubAvatars, initAvatarSession, endAvatarSession, generateAvatarsFromClusters } from '../../services/avatarService';
import { rankAvatarsForDisplay } from '../../services/intelligenceService';
import { validateInputQuality } from '../../services/validationService';
import { cn } from '../../lib/utils';
import { AvatarDeepDiveCard } from './AvatarDeepDiveCard';
import { StorageManager, STORAGE_KEYS } from '../../lib/storage';
import { IndustryIntelligence, ActionableInsight } from '../../types';
import { ActionableInsightsCard } from '../intel/ActionableInsightsCard';
import { useCorpusStore } from '../../features/corpus/store';
import { AvatarDashboard } from './AvatarDashboard';
interface AvatarWizardProps {
  company: Company;
  offer: Offer;
  strategicReport?: SynthesisReport;
  onComplete: (avatars: Avatar[]) => void;
  onBack: () => void;
  onUpdateCompany?: (updated: Company) => void;
  onAvatarsGenerated?: (avatars: Avatar[]) => void;
  onDeepDiveComplete?: (avatar: Avatar) => void;
  insights?: ActionableInsight[];
  isInsightsLoading?: boolean;
}

export const AIGeneratedAvatarWizard: React.FC<AvatarWizardProps> = ({ 
  company, 
  offer, 
  strategicReport,
  onComplete, 
  onBack, 
  onUpdateCompany,
  onAvatarsGenerated,
  onDeepDiveComplete,
  insights,
  isInsightsLoading
}) => {
  const [step, setStep] = React.useState<'finding' | 'selection' | 'deep-diving' | 'results' | 'blocked' | 'dashboard' | 'error'>('finding');
  const [generationError, setGenerationError] = React.useState<string | null>(null);
  const [isForced, setIsForced] = React.useState(false);
  const [availableAvatars, setAvailableAvatars] = React.useState<Avatar[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [deepDivedAvatars, setDeepDivedAvatars] = React.useState<Avatar[]>([]);
  const [loadingMessage, setLoadingMessage] = React.useState('Scanning your brand strategy...');
  const [subLoadingId, setSubLoadingId] = React.useState<string | null>(null);
  const [drillHistory, setDrillHistory] = React.useState<Avatar[][]>([]);

  const [showLowPriority, setShowLowPriority] = React.useState(false);

  // Ref-based guard to prevent re-running deepdive on re-renders
  const deepDiveStarted = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    for (const av of deepDivedAvatars) {
      if (!av.transformation && !deepDiveStarted.current.has(av.id)) {
        deepDiveStarted.current.add(av.id);
        const runDeepDive = async () => {
          try {
            const corpus = useCorpusStore.getState().getCorpus(company.id);
            const clusterMsgs = corpus?.messages.filter(m =>
              av.clusterId
                ? corpus.clusters.find(c => c.id === av.clusterId)?.messageIds.includes(m.id)
                : false
            ) ?? [];
            const finalResult = await deepDiveAvatarStream(
              company,
              offer,
              av,
              corpus?.messages ?? [],
              clusterMsgs,
              (_partial: string) => {
                // partial streaming — parent owns state
              }
            );
            setDeepDivedAvatars(prev => prev.map(a => a.id === finalResult.id ? finalResult : a));
            if (onDeepDiveComplete) onDeepDiveComplete(finalResult);
          } catch (err) {
            console.error('Deep dive failed for avatar', av.id, err);
          }
        };
        runDeepDive();
      }
    }
  }, [deepDivedAvatars]);

  // Stepper logic
  const steps = [
    { id: 'selection', label: 'Archetypes' },
    { id: 'results', label: 'Empathy' },
    { id: 'dashboard', label: 'Intelligence' },
  ];
  const currentStepIndex = steps.findIndex(s => s.id === (step === 'results' ? 'results' : 'selection'));
  const hasFinishedDeepDive = deepDivedAvatars.length > 0;

  const { prioritizedAvatars, lowPriorityAvatars } = React.useMemo(() => {
    const p: Avatar[] = [];
    const l: Avatar[] = [];
    (availableAvatars || []).forEach(a => {
      const priority = a.uiMetadata?.priorityLabel || 'secondary';
      if (priority === 'low-priority') l.push(a);
      else p.push(a);
    });
    return { prioritizedAvatars: p, lowPriorityAvatars: l };
  }, [availableAvatars]);

  const [industryIntel, setIndustryIntel] = React.useState<any>(null);

  React.useEffect(() => {
    StorageManager.load<Record<string, unknown>>(STORAGE_KEYS.INDUSTRY_INTELLIGENCE, {}).then((allIntel) => {
      setIndustryIntel(allIntel[company.industry] ?? null);
    });
  }, [company.industry]);

  // Initial generation with validation
  React.useEffect(() => {
    const init = async () => {
      try {
        if (!isForced) {
          setLoadingMessage('Validating input quality...');
          const qualityResult = await validateInputQuality(company, offer);

          if (!qualityResult.isReadyToGenerate) {
            if (onUpdateCompany) {
              onUpdateCompany({
                ...company,
                validationResult: {
                  question: qualityResult.clarifyingQuestion,
                  example: qualityResult.exampleOfGoodVersion,
                  score: qualityResult.qualityScore
                }
              });
            }
            setStep('blocked');
            return;
          }
        }

        setLoadingMessage('Identifying core avatars...');

        const corpus = useCorpusStore.getState().getCorpus(company.id);
        // FIX #4: Relax threshold — accept 'pending' clusters too (not just 'validated'),
        // exclude only 'merged' and 'archived', and require at least 3 messages as a
        // quality floor. Only 1 qualifying cluster is enough to use the evidence path.
        const validatedClusters = corpus?.clusters.filter(
          c =>
            c.status !== 'merged' &&
            c.status !== 'archived' &&
            (c.validationStatus === 'validated' || c.validationStatus === 'provisional') &&
            c.messageIds.length >= 3
        ) ?? [];

        let initialAvatars: Avatar[];
        let usedEvidencePath = false;

        if (validatedClusters.length >= 1) {
          // Evidence-first path: generate from clusters (validated OR pending with enough messages)
          usedEvidencePath = true;
          initialAvatars = await generateAvatarsFromClusters(
            company,
            validatedClusters,
            corpus?.messages ?? [],
            offer
          );
        } else {
          // Fallback: no qualifying clusters — use offer/USP-based generation
          console.warn('[Phase7] No clusters with ≥3 messages — falling back to offer-based generation');
          initialAvatars = await generateInitialAvatars(company, offer, strategicReport);
        }
        console.log(`[Phase7] Avatar generation path: ${usedEvidencePath ? 'evidence-clusters' : 'offer-based'}, clusters used: ${validatedClusters.length}`);
        
        setLoadingMessage('Ranking by business potential...');
        const ranked = await rankAvatarsForDisplay(initialAvatars, company);
        setAvailableAvatars(ranked);
        onAvatarsGenerated?.(ranked);
        setStep('selection');
        setIsForced(false); // Reset
      } catch (err) {
        console.error(err);
        setLoadingMessage('');
        setGenerationError(err instanceof Error ? err.message : 'Avatar generation failed. Please try again.');
        setStep('error');
      }
    };
    if (step === 'finding') init();
  }, [step, company, offer, onUpdateCompany, isForced]);

  const handleDrillDown = async (parent: Avatar) => {
    setSubLoadingId(parent.id);
    setLoadingMessage(`Niche-drilling into ${parent.name}...`);
    try {
      const subs = await generateSubAvatars(parent, company, offer);
      setDrillHistory(prev => [...prev, availableAvatars]);
      setAvailableAvatars(subs);
      setSelectedIds([]); // Reset selection for new level
    } catch (err) {
      console.error(err);
    } finally {
      setSubLoadingId(null);
    }
  };

  const handleLevelBack = () => {
    if (drillHistory.length > 0) {
      const prev = drillHistory[drillHistory.length - 1];
      setAvailableAvatars(prev);
      setDrillHistory(drillHistory.slice(0, -1));
      setSelectedIds([]);
    } else {
      onBack();
    }
  };

  const handleStartDeepDive = async () => {
    setStep('deep-diving');
    setLoadingMessage('Optimizing AI session for scale...');
    try {
      await initAvatarSession(company, offer);
      const selectedAvatars = availableAvatars.filter(a => selectedIds.includes(a.id));
      setDeepDivedAvatars(selectedAvatars);
      setStep('results');
    } catch (err) {
      console.error("Failed to start deep dive session:", err);
      // Still proceed, cache is optional optimization
      const selectedAvatars = availableAvatars.filter(a => selectedIds.includes(a.id));
      setDeepDivedAvatars(selectedAvatars);
      setStep('results');
    }
  };

  React.useEffect(() => {
    return () => {
      endAvatarSession();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] pb-32 sm:pb-40">
      {/* Strategic Stepper for jumping between selection and results */}
      {(step === 'selection' || step === 'results') && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[40] w-full max-w-[320px] px-6">
          <div className="bg-[var(--color-card-bg)]/80 backdrop-blur-xl border border-[var(--color-border-secondary)] rounded-full h-12 flex items-center justify-between px-6 shadow-xl shadow-black/5">
            {steps.map((s, idx) => (
              <React.Fragment key={s.id}>
                {idx > 0 && <div className="w-8 h-[1px] bg-[#D2D2D7]/50" />}
                <button
                  onClick={() => {
                    if (idx <= currentStepIndex || (s.id === 'results' && hasFinishedDeepDive)) {
                      setStep(s.id as any);
                    }
                  }}
                  disabled={idx > currentStepIndex && !hasFinishedDeepDive}
                  className={cn(
                    "text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] transition-all",
                    step === s.id ? "text-[#0A84FF]" : (idx < currentStepIndex || hasFinishedDeepDive) ? "text-white hover:text-[#0A84FF]" : "text-[#D2D2D7]"
                  )}
                >
                  {s.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'finding' && (
          <motion.div 
            key="finding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-[440px] mx-auto pt-48 px-6 text-center"
          >
             <div className="relative mb-12">
                <div className="absolute inset-0 bg-[#0A84FF]/20 blur-[100px] rounded-full scale-150" />
                <motion.div
                  animate={{ 
                    scale: [1, 1.05, 1],
                    rotate: [0, 2, -2, 0]
                  }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="relative w-24 h-24 bg-[var(--color-card-bg)]/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[var(--radius-md)] border border-white flex items-center justify-center mx-auto"
                >
                   <Sparkles className="text-[#0A84FF]" size={40} strokeWidth={2.5} />
                </motion.div>
             </div>
             <h2 className="text-[var(--text-xl)] sm:text-[var(--text-xl)] font-display font-bold mb-4 tracking-tight leading-tight">Analyzing Market.</h2>
             <p className="text-[var(--text-base)] text-[#86868B] font-medium animate-pulse tracking-wide font-mono uppercase text-[var(--text-xs)] sm:text-[var(--text-xs)] font-semibold opacity-60">{loadingMessage}</p>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-[700px] mx-auto px-6 pt-24 text-center"
          >
            <div className="w-20 h-20 rounded-[var(--radius-md)] bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-sm border border-rose-500/20 mx-auto mb-8">
              <AlertCircle size={36} strokeWidth={2.5} />
            </div>
            <h2 className="text-[var(--text-xl)] font-display font-bold tracking-tight text-white mb-4">Generation Failed</h2>
            <p className="text-[var(--text-base)] text-[#86868B] leading-relaxed mb-2 max-w-[460px] mx-auto">
              {generationError || 'Something went wrong while generating avatars. This is usually a temporary issue.'}
            </p>
            <p className="text-[var(--text-sm)] text-[#86868B]/60 mb-10">Check your connection and try again, or go back to edit your company profile.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onBack}
                className="px-8 py-4 bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] rounded-[var(--radius-md)] font-semibold uppercase tracking-[0.2em] text-[var(--text-xs)] hover:text-white transition-all"
              >
                Edit Profile
              </button>
              <button
                onClick={() => {
                  setGenerationError(null);
                  setIsForced(true);
                  setStep('finding');
                }}
                className="px-8 py-4 bg-[#0A84FF] text-white rounded-[var(--radius-md)] font-semibold uppercase tracking-[0.2em] text-[var(--text-sm)] hover:bg-[#0077ED] transition-all"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        )}

        {step === 'blocked' && company.validationResult && (
          <motion.div
            key="blocked"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-[800px] mx-auto px-6 pt-24"
          >
            <div className="bg-[var(--color-card-bg)] rounded-[var(--radius-md)] sm:rounded-[var(--radius-full)] p-8 sm:p-16 border border-[var(--color-border-secondary)] shadow-2xl relative overflow-hidden text-left">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#FF9500]/5 blur-[120px] -mr-[250px] -mt-[250px] rounded-full" />
              
              <div className="relative z-10 space-y-8 sm:space-y-12">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[var(--radius-md)] sm:rounded-[var(--radius-md)] bg-[#FF9500]/10 flex items-center justify-center text-[#FF9500] shadow-sm border border-[#FF9500]/20">
                    <AlertCircle size={40} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-[var(--text-xl)] sm:text-[var(--text-xl)] font-display font-bold tracking-tight text-white leading-tight">
                      Input Quality.
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="text-[var(--text-xs)] text-[#86868B] font-semibold uppercase tracking-[0.3em]">Score:</span>
                        <div className="px-3 py-1 bg-[#FF9500] text-white text-[var(--text-xs)] font-semibold rounded-full">{company.validationResult.score}%</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-10 bg-[var(--color-card-bg)] rounded-[var(--radius-md)] sm:rounded-[var(--radius-md)] space-y-6 border border-[var(--color-border-secondary)] shadow-inner">
                  <p className="text-[var(--text-lg)] sm:text-[var(--text-lg)] font-bold text-white leading-relaxed italic pr-4">
                    "{company.validationResult.question}"
                  </p>
                </div>
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row gap-4 pt-12 sm:pt-16 border-t border-[var(--color-border-secondary)] mt-12">
                   <button
                    onClick={onBack}
                    className="flex-1 py-5 bg-[#1D1D1F] text-white rounded-[var(--radius-md)] font-semibold uppercase tracking-[0.2em] text-[var(--text-sm)] flex items-center justify-center gap-4 hover:shadow-xl transition-all"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setIsForced(true);
                      setStep('finding');
                    }}
                    className="px-8 py-5 bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] text-[#86868B] rounded-[var(--radius-md)] font-semibold uppercase tracking-[0.2em] text-[var(--text-xs)] flex items-center justify-center gap-4"
                  >
                    Force
                  </button>
              </div>
            </div>
          </motion.div>
        )}


        {step === 'selection' && (
          <motion.div 
            key="selection"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[1200px] mx-auto px-6 pt-32 sm:pt-40 pb-40"
          >
            <div className="mb-12 sm:mb-24 flex flex-col items-start gap-8 sm:gap-12 text-left">
               <div className="flex-1 w-full">
                  <button 
                    onClick={handleLevelBack}
                    className="flex items-center gap-2 text-[var(--text-xs)] sm:text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] text-[#0A84FF] mb-6 hover:opacity-70 transition-opacity"
                  >
                     <ArrowLeft size={16} strokeWidth={3} />
                     {drillHistory.length > 0 ? "Strategic Level Back" : "Change Vector"}
                  </button>
                  
                  {industryIntel && industryIntel.companiesAnalyzed >= 1 && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center gap-3 px-4 py-1.5 bg-[#34C759]/10 text-[#34C759] rounded-full border border-[#34C759]/20 text-[var(--text-xs)] sm:text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] mb-4 sm:mb-6"
                    >
                       <Brain size={14} strokeWidth={2.5} />
                       Historical Delta: {industryIntel.companiesAnalyzed} Analyzed
                    </motion.div>
                  )}
                  
                  <h2 className="text-[var(--text-xl)] sm:text-[var(--text-xl)] font-display font-bold tracking-tight leading-[1] text-white mb-6">Market Archetypes.</h2>
                  <p className="text-[var(--text-lg)] sm:text-[var(--text-lg)] text-[#86868B] max-w-[600px] font-medium leading-relaxed">
                    {drillHistory.length > 0 
                      ? "Refining high-fidelity niches within the selected strategic segment." 
                      : "We've synthesized unique customer archetypes. Select the archetypes you intend to dominate."}
                  </p>
               </div>
               
               {drillHistory.length > 0 && (
                 <div className="flex items-center gap-4 bg-[#1D1D1F] px-5 py-2.5 rounded-full text-white shadow-xl shadow-black/10">
                    <History size={16} className="text-white/40" />
                    <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em]">Depth / {drillHistory.length + 1}</span>
                 </div>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-40">
              {prioritizedAvatars.map((avatar, i) => (
                <motion.div
                  key={avatar.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ 
                      delay: i * 0.05,
                      duration: 0.8,
                      ease: [0.32, 0.72, 0, 1]
                  }}
                  onClick={() => {
                    if (selectedIds.includes(avatar.id)) {
                      setSelectedIds(prev => prev.filter(id => id !== avatar.id));
                    } else {
                      setSelectedIds(prev => [...prev, avatar.id]);
                    }
                  }}
                  className={cn(
                    "relative group text-left p-8 sm:p-12 rounded-[var(--radius-md)] sm:rounded-[var(--radius-full)] border-[var(--color-border-secondary)] transition-all duration-700 bg-[var(--color-card-bg)] cursor-pointer flex flex-col",
                    selectedIds.includes(avatar.id) 
                      ? "border-[#0A84FF] shadow-[0_40px_80px_-20px_rgba(10,132,255,0.15)] bg-[#0A84FF]/[0.01]" 
                      : "border-[var(--color-border-secondary)] hover:border-[var(--color-border-secondary)] hover:shadow-xl"
                  )}
                >
                  <div className="flex items-start justify-between mb-6 sm:mb-8">
                    <div className={cn(
                      "w-12 h-12 sm:w-16 sm:h-16 rounded-[var(--radius-sm)] sm:rounded-[var(--radius-md)] flex items-center justify-center transition-all duration-500",
                      selectedIds.includes(avatar.id) ? "bg-[#0A84FF] text-white shadow-lg shadow-[#0A84FF]/40 scale-110" : "bg-[var(--color-card-bg)] text-white"
                    )}>
                      {selectedIds.includes(avatar.id) ? <Check size={32} strokeWidth={3} /> : <UserCircle2 size={32} strokeWidth={1.5} />}
                    </div>
                    {avatar.score && (
                      <div className="flex flex-col items-end">
                        <div className="text-[var(--text-xs)] sm:text-[var(--text-xs)] uppercase font-semibold text-[#86868B] tracking-[0.3em] mb-1 sm:mb-2 text-right">Buy Propensity</div>
                        <div className="flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-[var(--color-card-bg)] rounded-full border border-[var(--color-border-secondary)]">
                           <Star size={12} className="fill-[#0A84FF] text-[#0A84FF]" />
                           <span className="text-[var(--text-sm)] sm:text-[var(--text-base)] font-semibold tracking-tight">{avatar.score} / 10</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 mb-6 sm:mb-8">
                     <h3 className="text-[var(--text-lg)] sm:text-[var(--text-xl)] font-bold tracking-tight text-white leading-tight group-hover:text-[#0A84FF] transition-colors">{avatar.name}</h3>
                     <div className="flex flex-wrap gap-2">
                         <span className={cn(
                            "text-[var(--text-xs)] px-2.5 py-1 rounded-full font-semibold uppercase tracking-[0.2em] border text-left",
                            avatar.uiMetadata?.priorityLabel === 'primary' ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20" : "bg-[#0A84FF]/5 text-[#0A84FF] border-[#0A84FF]/20"
                         )}>
                            {avatar.uiMetadata?.priorityLabel === 'primary' ? 'High Fidelity' : avatar.category}
                         </span>
                     </div>
                  </div>

                  <div className="mb-6 space-y-2 text-left">
                     <div className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.3em] opacity-60">Strategic Differentiator</div>
                     <div className="text-[var(--text-base)] sm:text-[var(--text-base)] font-bold text-white leading-snug tracking-tight line-clamp-2">{avatar.definingCharacteristic}</div>
                  </div>

                  <p className="text-[var(--text-base)] sm:text-[var(--text-base)] text-[#86868B] leading-relaxed mb-6 sm:mb-8 line-clamp-3 font-medium text-left">
                    {avatar.description}
                  </p>

                  <div className="mt-auto pt-6 sm:pt-8 border-t border-[var(--color-border-default)] text-left">
                     <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col flex-1 min-w-0">
                           <span className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.3em] mb-2 opacity-60">Logic reasoning</span>
                           <p className="text-[var(--text-sm)] italic text-[#86868B] leading-relaxed font-medium truncate">"{avatar.reasoning}"</p>
                        </div>
                        
                        {avatar.canHaveSubAvatars && (
                          <button
                            onClick={(e) => {
                               e.stopPropagation();
                               handleDrillDown(avatar);
                            }}
                            disabled={subLoadingId === avatar.id}
                            className={cn(
                                "w-12 h-12 sm:w-14 sm:h-14 rounded-[var(--radius-sm)] sm:rounded-[var(--radius-sm)] flex items-center justify-center transition-all duration-500 shadow-sm border",
                                subLoadingId === avatar.id ? "bg-[var(--color-card-bg)] border-[var(--color-border-secondary)]" : "bg-[var(--color-card-bg)] group-hover:bg-[#1D1D1F] group-hover:text-white border-transparent"
                            )}
                          >
                             {subLoadingId === avatar.id ? <Loader2 size={18} className="animate-spin" /> : <Filter size={20} strokeWidth={2.5} />}
                          </button>
                        )}
                     </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {lowPriorityAvatars.length > 0 && (
               <div className="mb-40">
                  <div className="flex justify-center mb-10">
                      <button 
                        onClick={() => setShowLowPriority(!showLowPriority)}
                        className="flex items-center gap-4 px-10 py-5 bg-[var(--color-card-bg)] hover:bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-full transition-all group/toggle"
                      >
                         <div className={cn("w-6 h-6 rounded-[var(--radius-sm)] bg-[#D2D2D7]/20 flex items-center justify-center transition-transform duration-500", showLowPriority && "rotate-90 bg-[#1D1D1F] text-white")}>
                            <ChevronRight size={14} strokeWidth={3} />
                         </div>
                         <span className="text-[var(--text-sm)] font-semibold text-white uppercase tracking-[0.3em]">
                            {showLowPriority ? "Hide" : "Show"} {lowPriorityAvatars.length} Latent Market Segments
                         </span>
                      </button>
                  </div>

                  <AnimatePresence>
                     {showLowPriority && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-hidden"
                        >
                           {lowPriorityAvatars.map((avatar) => (
                              <div 
                                key={avatar.id}
                                className="p-10 bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] transition-all opacity-60 hover:opacity-100 grayscale hover:grayscale-0 hover:shadow-xl group/latent text-left"
                              >
                                 <div className="flex items-center justify-between mb-6">
                                    <div className="text-[var(--text-lg)] font-bold text-white tracking-tight group-hover/latent:text-[#0A84FF] transition-colors">{avatar.name}</div>
                                    <div className="px-3 py-1 bg-[var(--color-card-bg)] rounded-full text-[var(--text-xs)] font-semibold text-[#86868B]">
                                       {avatar.score}/10
                                    </div>
                                 </div>
                                 <p className="text-[var(--text-base)] text-[#86868B] mb-8 font-medium leading-relaxed line-clamp-2">{avatar.description}</p>
                                 <div className="text-[var(--text-xs)] font-semibold text-[#FF3B30] uppercase tracking-[0.2em] flex items-center gap-3 py-3 border-t border-[var(--color-border-default)]">
                                    <Filter size={14} strokeWidth={2.5} />
                                    {avatar.uiMetadata?.collapseReason || 'Lower confidence score'}
                                 </div>
                              </div>
                           ))}
                        </motion.div>
                     )}
                  </AnimatePresence>
               </div>
            )}

            <div className="fixed bottom-10 left-0 right-0 flex justify-center px-6 z-50">
               <button
                 disabled={selectedIds.length === 0}
                 onClick={handleStartDeepDive}
                 className="group w-full max-w-[480px] h-14 sm:h-16 bg-[#1D1D1F] text-white rounded-full font-semibold uppercase tracking-[0.2em] text-[var(--text-sm)] sm:text-[var(--text-base)] shadow-[0_20px_40px_rgba(0,0,0,0.2)] flex items-center justify-center gap-4 sm:gap-6 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
               >
                 <span>Analyze Selected ({selectedIds.length})</span>
                 <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-2 transition-transform" />
               </button>
            </div>
          </motion.div>
        )}

        {step === 'deep-diving' && (
          <motion.div 
            key="deep-diving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-[440px] mx-auto pt-48 px-6 text-center"
          >
             <div className="relative mb-12">
                <div className="absolute inset-x-0 top-0 bottom-0 bg-[#0A84FF]/20 blur-[100px] rounded-full" />
                <motion.div
                  animate={{ 
                    rotate: 360,
                  }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="w-32 h-32 border-[6px] border-[#0A84FF]/10 border-t-[#0A84FF] rounded-[var(--radius-md)] mx-auto flex items-center justify-center relative bg-[var(--color-card-bg)]/50 backdrop-blur-md"
                >
                   <Brain size={48} className="text-[#0A84FF]" strokeWidth={2.5} />
                </motion.div>
             </div>
             <h2 className="text-[var(--text-xl)] font-display font-bold mb-4 tracking-tight leading-tight">Synthesizing Empathy.</h2>
             <p className="text-[var(--text-base)] text-[#86868B] mb-8 font-medium leading-relaxed">
               Mapping neural pathways and behavioral triggers. This involves a 3-stage intelligence layer and may take up to 2 minutes per model.
             </p>
             <div className="flex flex-col gap-2">
                <div className="px-6 py-2 bg-[#0A84FF] text-white rounded-full inline-block text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] shadow-xl shadow-[#0A84FF]/20">
                  {loadingMessage}
                </div>
                <p className="text-[var(--text-xs)] text-[#86868B] font-semibold uppercase tracking-[0.2em] opacity-40 mt-4 animate-pulse">
                  Checking how this lands with your market...
                </p>
             </div>
          </motion.div>
        )}

        {step === 'results' && (
           <motion.div 
             key="results"
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: 1, y: 0 }}
             className="max-w-[1400px] mx-auto px-6 pt-24 pb-48"
           >
              <div className="text-center mb-32 space-y-8">
                 <div className="flex justify-center mb-10">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-[#34C759]/10 text-[#34C759] px-6 py-3 rounded-full font-semibold text-[var(--text-xs)] uppercase tracking-[0.3em] flex items-center gap-4 border border-[#34C759]/20 shadow-xl shadow-[#34C759]/5"
                    >
                       <div className="w-5 h-5 rounded-md bg-[#34C759] flex items-center justify-center text-white">
                           <Check size={14} strokeWidth={3} />
                       </div>
                       Empathy Extraction Stabilized
                    </motion.div>
                 </div>
                 <h2 className="text-[var(--text-xl)] font-display font-bold tracking-tight leading-[0.85] text-white">Empathy Models.</h2>
                 <p className="text-[var(--text-lg)] text-[#86868B] max-w-[700px] mx-auto font-medium leading-relaxed">
                   We've decrypted their psychological core, daily environmental triggers, and internal transformation paths.
                 </p>
              </div>

              <div className="space-y-48">
                {deepDivedAvatars.map((avatar, idx) => (
                  <AvatarDeepDiveCard 
                    key={avatar.id} 
                    avatar={avatar} 
                    company={company}
                    offer={offer}
                    index={idx} 
                    onUpdateAvatar={(updated) => {
                      setDeepDivedAvatars(prev => prev.map(a => a.id === updated.id ? updated : a));
                    }}
                    onDeepDiveComplete={(av) => onDeepDiveComplete?.(av)}
                  />
                ))}
              </div>

              {/* Insights with premium spacing */}
              <div className="pt-48 pb-32">
                 <div className="text-center mb-20 space-y-4">
                    <div className="text-[var(--text-xs)] font-semibold text-[#0A84FF] uppercase tracking-[0.4em] opacity-80">Strategic Intelligence</div>
                    <h2 className="text-[var(--text-xl)] font-display font-bold tracking-tight text-white">Vertical Insights.</h2>
                 </div>
                 <ActionableInsightsCard insights={insights || []} isLoading={isInsightsLoading || false} />
              </div>

              <div className="fixed bottom-12 left-0 right-0 flex justify-center px-6 z-50">
                 <button
                   onClick={() => onComplete(deepDivedAvatars)}
                   className="group w-full max-w-[480px] h-20 bg-[#0A84FF] text-white rounded-full font-semibold uppercase tracking-[0.2em] text-[var(--text-base)] shadow-[0_30px_60px_rgba(10,132,255,0.3)] flex items-center justify-center gap-6 hover:scale-[1.02] active:scale-95 transition-all"
                 >
                   <span>Save All Profiles</span>
                   <ArrowRight size={22} strokeWidth={3} className="group-hover:translate-x-2 transition-transform" />
                 </button>
              </div>
           </motion.div>
        )}

        {step === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[1200px] mx-auto px-6 pt-24 pb-32"
          >
            <AvatarDashboard
              company={company}
              offer={offer}
              avatars={deepDivedAvatars.length > 0 ? deepDivedAvatars : (availableAvatars ?? [])}
              onAvatarsEvolved={(evolved) => {
                setDeepDivedAvatars(prev => prev.map(a => evolved.find(e => e.id === a.id) ?? a));
                setAvailableAvatars(prev => (prev ?? []).map(a => evolved.find(e => e.id === a.id) ?? a));
              }}
              onSelectAvatar={() => setStep('results')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

