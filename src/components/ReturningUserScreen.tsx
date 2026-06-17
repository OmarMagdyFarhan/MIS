import React from 'react';
import { Plus, ChevronRight, Building2, Calendar, Target, Edit2, Trash2, X, AlertTriangle, Copy, Check, Sparkles, UserCircle2, ArrowRight } from 'lucide-react';
import { Company, Progress, Offer } from '../types';
import { cn } from '../lib/utils';
import { PhaseSelectionModal } from './PhaseSelectionModal';
import { EmptyState } from './EmptyState';
import { usePipelineStore } from '../stores/pipelineStore';
import { motion, AnimatePresence } from 'motion/react';

const PHASE_LABELS: Record<string, string> = {
  company_complete:        'Company defined',
  corpus_active:           'Evidence in progress',
  corpus_analyzed:         'Evidence analyzed',
  clusters_proposed:       'Segments proposed',
  clusters_validated:      'Segments validated',
  segments_materialized:   'Avatars created',
  avatar_offers_ready:     'Avatar offers ready',
  market_intel_ready:      'Market intelligence ready',
  pipeline_complete:       'Pipeline complete',
};



interface ReturningUserScreenProps {
  companies: Company[];
  companyProgress: Record<string, Progress>;
  needsOfferUpdate: Record<string, boolean>;
  offers: Record<string, Offer>;
  onSelectCompany: (id: string) => void;
  onEditCompany: (id: string, phase: 'company' | 'offer' | 'avatar') => void;
  onDeleteCompany: (id: string) => void;
  onAddNewCompany: () => void;
  onDataImported?: () => void;
}

export const ReturningUserScreen: React.FC<ReturningUserScreenProps> = ({ 
  companies, 
  companyProgress, 
  needsOfferUpdate,
  offers,
  onSelectCompany, 
  onEditCompany,
  onDeleteCompany,
  onAddNewCompany,
  onDataImported
}) => {
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [isPhaseModalOpen, setIsPhaseModalOpen] = React.useState(false);
  const [projectToDelete, setProjectToDelete] = React.useState<string | null>(null);
  const pipelineByCompany = usePipelineStore(s => s.byCompany);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = () => {
    if (projectToDelete) {
      setIsDeleting(true);
      setTimeout(() => {
        onDeleteCompany(projectToDelete);
        setProjectToDelete(null);
        setIsDeleting(false);
      }, 300);
    }
  };

  return (
    <div className="min-h-screen pb-32 font-sans text-[var(--color-text-primary)]">
      <AnimatePresence>
        {projectToDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProjectToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[var(--color-card-bg)] dark:bg-[#1D1D1F] rounded-[var(--radius-md)] p-10 shadow-2xl border border-[var(--color-border-default)]"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-[var(--radius-md)] bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500">
                   <AlertTriangle size={32} />
                </div>
                <div>
                   <h3 className="text-[var(--text-xl)] font-display font-semibold text-[var(--color-text-primary)] mb-2">Delete this company?</h3>
                   <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] leading-relaxed">
                     This will permanently delete <span className="font-bold text-[var(--color-text-primary)]">"{companies.find(c => c.id === projectToDelete)?.name}"</span> and everything saved for it. This can't be undone.
                   </p>
                </div>
                <div className="flex flex-col w-full gap-3">
                   <button 
                     onClick={handleDelete}
                     disabled={isDeleting}
                     className="w-full py-4 bg-red-500 text-white rounded-[var(--radius-sm)] font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                   >
                     {isDeleting ? "Deleting…" : "Delete company"}
                   </button>
                   <button 
                     onClick={() => setProjectToDelete(null)}
                     className="w-full py-4 bg-[var(--color-slate-elevated)] text-[var(--color-text-primary)] rounded-[var(--radius-sm)] font-bold border border-[var(--color-border-default)]"
                   >
                     Cancel
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-[1100px] mx-auto px-6 pt-12 sm:pt-24">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 mb-16 sm:mb-24 animate-matrix">
          <div className="space-y-6 max-w-2xl">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 glass-panel rounded-full shadow-sm border border-[var(--color-border-default)] font-mono">
                <div className="w-1.5 h-1.5 bg-[#0A84FF] rounded-full animate-pulse" />
                <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.06em]">Workspace</span>
            </div>
            <h1 className="text-[var(--text-xl)] sm:text-[2.5rem] font-display font-bold tracking-tight leading-[1.05] text-[var(--color-text-primary)]">Your<br /><span className="text-[#0A84FF]">Companies</span></h1>
            <p className="text-[var(--text-base)] sm:text-[var(--text-lg)] text-[var(--color-text-secondary)] font-medium leading-relaxed max-w-[540px]">Build customer profiles and messaging backed by real evidence.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">

            <button 
              onClick={onAddNewCompany}
              className="btn-primary group flex items-center gap-5 py-5 px-12 shadow-2xl shadow-[#0A84FF]/20 flex-1 sm:flex-none justify-center"
            >
              <span className="text-[var(--text-base)] font-semibold">Add company</span>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:rotate-90">
                  <Plus size={16} strokeWidth={3} />
              </div>
            </button>
          </div>
        </header>

        <div className="space-y-10">
          {companies.length === 0 ? (
            <EmptyState 
              icon={Building2}
              title="Add your first company"
              description="Set up your company profile, then add customer feedback to get evidence-backed messaging."
              action={{
                label: "Add company",
                onClick: onAddNewCompany
              }}
              className="p-16 sm:p-24"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-12 pb-24">
              {companies.map((company, index) => {
                const progress = companyProgress[company.id];
                const isCompComplete = progress?.stage1Complete;
                const isOfferComplete = progress?.stage2Complete;
                const isModelComplete = progress?.stage3Complete;
                const offerNeedsUpdate = needsOfferUpdate[company.id];
                const activeOffer = offers[company.id];
                const pipelinePhase = pipelineByCompany[company.id]?.phase;
                const isStrategyReady = pipelinePhase === 'avatar_offers_ready' || pipelinePhase === 'pipeline_complete';
                
                return (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 1, ease: [0.23, 1, 0.32, 1] }}
                    className="group"
                  >
                    <div className="relative bg-[var(--color-card-bg)] dark:bg-[#1D1D1F] border border-[var(--color-border-secondary)] dark:border-white/5 rounded-[var(--radius-md)] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.12)] transition-all duration-700">
                      <div className="flex flex-col lg:flex-row h-full">
                        {/* Project Identity Section */}
                        <div className="lg:w-1/3 p-10 bg-[var(--color-background-tertiary)] dark:bg-white/5 border-b lg:border-b-0 lg:border-r border-[var(--color-border-secondary)] dark:border-white/5 flex flex-col justify-between">
                          <div className="space-y-8">
                             <div className="flex items-center justify-between">
                                {company.logoUrl ? (
                                  <div className="w-16 h-16 rounded-[var(--radius-sm)] bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] flex items-center justify-center p-3 shadow-md overflow-hidden group-hover:scale-105 transition-transform duration-700">
                                    <img src={company.logoUrl} alt={company.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 rounded-[var(--radius-sm)] bg-[var(--color-card-bg)] dark:bg-white/10 text-[var(--color-text-primary)] flex items-center justify-center border border-[var(--color-border-secondary)] dark:border-[var(--color-border-default)] shadow-sm">
                                    <Building2 size={24} />
                                  </div>
                                )}
                                <button 
                                  onClick={() => setProjectToDelete(company.id)}
                                  className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] hover:text-red-500 hover:bg-red-500/10 rounded-[var(--radius-full)] transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                             </div>

                             <div className="space-y-4">
                                <h3 className="text-[var(--text-lg)] font-display font-semibold text-[var(--color-text-primary)] leading-tight">{company.name}</h3>
                                <div className="flex flex-wrap gap-2">
                                  <span className="text-[var(--text-xs)] font-medium px-2.5 py-1 bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-[#1D1D1F] rounded-[var(--radius-sm)]">
                                    {company.industry}
                                  </span>
                                  {company.specializations?.[0] && (
                                    <span className="text-[var(--text-xs)] font-medium px-2.5 py-1 bg-[var(--color-card-bg)] dark:bg-white/10 text-[var(--color-text-primary)] dark:text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)] dark:border-[var(--color-border-default)] rounded-[var(--radius-sm)]">
                                      {company.specializations[0].name}
                                    </span>
                                  )}
                                </div>
                             </div>
                          </div>

                          <div className="mt-12">
                             <button 
                               onClick={() => onSelectCompany(company.id)}
                               className="btn-primary w-full py-4 flex items-center justify-center gap-3 shadow-lg hover:shadow-2xl transition-all"
                             >
                               <span className="text-[var(--text-sm)] font-medium">Open</span>
                               <ArrowRight size={16} />
                             </button>
                          </div>
                        </div>

                        {/* Synthesis Status Section */}
                        <div className="flex-1 p-10 flex flex-col justify-between bg-transparent">
                            <div className="space-y-8">
                               <div className="flex items-center justify-between">
                                  <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.06em]">Progress</span>
                                  <div className="flex items-center gap-2">
                                     <div className={cn("w-2 h-2 rounded-full", isStrategyReady ? "bg-emerald-500" : isModelComplete ? "bg-emerald-500/50" : "bg-amber-500 animate-pulse")} />
                                     <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-primary)]">
                                        {pipelinePhase ? (PHASE_LABELS[pipelinePhase] ?? pipelinePhase.replace(/_/g, ' ')) : isModelComplete ? "Segments ready" : isOfferComplete ? "Evidence collected" : "Just getting started"}
                                     </span>
                                  </div>
                               </div>

                               <div className="grid grid-cols-3 gap-6">
                                  <PhaseIndicator
                                    label="Identity"
                                    isDone={isCompComplete}
                                    onClick={() => onEditCompany(company.id, 'company')}
                                  />
                                  <PhaseIndicator
                                    label="Evidence"
                                    isDone={isOfferComplete}
                                    isWarning={offerNeedsUpdate}
                                    onClick={() => onEditCompany(company.id, 'offer')}
                                    disabled={!isCompComplete}
                                  />
                                  {isStrategyReady ? (
                                    <PhaseIndicator
                                      label="Strategy"
                                      isDone={isStrategyReady}
                                      onClick={() => onEditCompany(company.id, 'avatar')}
                                      disabled={!isStrategyReady}
                                    />
                                  ) : (
                                    <PhaseIndicator
                                      label="Segments"
                                      isDone={isModelComplete}
                                      onClick={() => onEditCompany(company.id, 'avatar')}
                                      disabled={!isOfferComplete}
                                    />
                                  )}
                               </div>

                               {activeOffer && (
                                 <div className="p-6 bg-[var(--color-background-tertiary)] dark:bg-white/5 rounded-[var(--radius-md)] border border-[var(--color-border-secondary)] dark:border-white/10 shadow-inner">
                                    <div className="flex items-center gap-2 mb-3">
                                       <Sparkles size={12} className="text-amber-500" />
                                       <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-tertiary)]">Current offer</span>
                                    </div>
                                    <p className="text-[var(--text-sm)] text-[var(--color-text-primary)] line-clamp-2 leading-relaxed italic opacity-90">
                                      “{activeOffer.generatedOffer}”
                                    </p>
                                 </div>
                               )}
                            </div>

                            <div className="mt-10 flex items-center justify-between border-t border-[var(--color-border-secondary)] dark:border-white/5 pt-8">
                                <div className="flex items-center gap-10">
                                   <div className="flex flex-col">
                                      <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-tertiary)] opacity-100 mb-1">Created</span>
                                      <span className="text-[var(--text-sm)] text-[var(--color-text-primary)]">{new Date(company.createdAt).toLocaleDateString()}</span>
                                   </div>
                                   <div className="flex flex-col">
                                      <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-tertiary)] opacity-100 mb-1">Customer profiles</span>
                                      <span className="text-[var(--text-sm)] font-bold text-[var(--color-text-primary)]">{progress?.avatars?.length || 0} profiles</span>
                                   </div>
                                </div>
                                <div className="text-[var(--text-xs)] text-[var(--color-text-tertiary)] whitespace-nowrap">
                                  {company.country} Market
                                </div>
                            </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PhaseIndicator = ({ label, isDone, isWarning, onClick, disabled }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex flex-col gap-4 p-5 rounded-[var(--radius-md)] border transition-all text-left group/phase",
      disabled ? "opacity-30 grayscale border-dashed border-[var(--color-border-secondary)] cursor-not-allowed" : 
      isDone ? "bg-emerald-500/[0.04] border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/[0.08]" :
      isWarning ? "bg-amber-500/[0.04] border-amber-500/40 text-amber-600 hover:bg-amber-500/[0.08] animate-pulse" :
      "bg-[var(--color-card-bg)] dark:bg-[var(--color-slate-elevated)] border-[var(--color-border-secondary)] dark:border-white/10 text-[var(--color-text-secondary)] hover:border-[#0A84FF]/60 hover:bg-[#0A84FF]/[0.02] shadow-sm"
    )}
  >
    <div className={cn(
      "w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center transition-transform group-hover/phase:scale-110",
      isDone ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : isWarning ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-[var(--color-background-tertiary)] dark:bg-white/10 border border-[var(--color-border-secondary)] dark:border-white/5 shadow-inner"
    )}>
      {isDone ? <Check size={14} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
    </div>
    <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-primary)]">{label}</span>
  </button>
);

const StageCard = ({ title, subtitle, icon: Icon, isComplete, isWarning, disabled, onClick }: any) => (
  <button 
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex flex-col items-start gap-8 p-8 card-premium group/card text-left transition-all duration-500",
      disabled ? "opacity-30 grayscale cursor-not-allowed border-dashed bg-transparent shadow-none" : "hover:border-[#0A84FF]/30"
    )}
  >
    <div className={cn(
      "w-14 h-14 rounded-[var(--radius-sm)] flex items-center justify-center transition-all duration-700 shadow-sm",
      isComplete ? "bg-emerald-500 text-white shadow-emerald-500/20" : 
      isWarning ? "bg-amber-500 text-white animate-pulse" :
      "bg-[var(--color-slate-elevated)] text-[#0A84FF] group-hover/card:scale-110 group-hover/card:rotate-3"
    )}>
      {isComplete ? <Check size={28} strokeWidth={3} /> : <Icon size={28} strokeWidth={1.5} />}
    </div>
    
    <div className="space-y-1">
      <h3 className="text-premium-sm">{title}</h3>
      <div className="text-[var(--text-lg)] font-bold font-mono tracking-tight text-[var(--color-text-primary)]">
        {isComplete ? (
          <span className="text-emerald-500 uppercase tracking-[0.04em]">{subtitle}</span>
        ) : isWarning ? (
          <span className="text-amber-500 uppercase tracking-[0.04em]">{subtitle}</span>
        ) : (
          <span className="opacity-50 uppercase tracking-[0.04em]">{subtitle}</span>
        )}
      </div>
    </div>
    
    {!disabled && (
       <div className="mt-auto pt-6 w-full flex justify-end">
          <ChevronRight size={18} className="text-[var(--color-border-default)] group-hover/card:text-[#0A84FF] group-hover/card:translate-x-1 transition-all" />
       </div>
    )}
  </button>
);
