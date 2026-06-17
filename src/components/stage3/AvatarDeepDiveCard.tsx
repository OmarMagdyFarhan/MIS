import React from 'react';
import { Target, ShieldCheck, Zap, MessageCircle, MessageSquare, Sparkles, Info, Check, UserCircle2, ArrowRight, Heart, Package, Sun, Activity, Users, Quote, User, Brain, RotateCcw, Loader2, Globe, Layers, X, RefreshCw, FlaskConical, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Avatar, Company, Offer, getClaimText } from '../../types';
import type { PrimaryValueElement } from '../../types/valueElements';
import { VALUE_ELEMENT_LABELS } from '../../types/valueElements';
import { assignValueElement } from '../../services/valueElementService';
import type { EvidenceMessage, Cluster } from '../../types/pipeline';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { OfferScoreCard } from '../intel/OfferScoreCard';
import { addToEditHistory } from '../../services/historyService';
import { ASSEMBLY_PROMPT_SYSTEM, AVATAR_STRUCTURE, regenerateTargetedOffer } from '../../services/avatarService';
import { runStabilityTest, computeStabilityReport } from '../../services/stabilityTestService';
import type { StabilityReport } from '../../services/stabilityTestService';
import { analyzeAvatarGaps } from '../../services/gapAnalysisService';
import type { AvatarGapReport } from '../../services/gapAnalysisService';
import { MessageMiningWorkspace } from '../../features/corpus/components/MessageMiningWorkspace';
import { ProvenancePanel } from '../provenance/ProvenancePanel';
import { resolveAvatarProvenance } from '../../lib/provenanceResolver';
import { useCorpusStore } from '../../features/corpus/store';
import { usePipelineStore } from '../../stores/pipelineStore';
import { useShallow } from 'zustand/react/shallow';
import { EvidencePanel } from './EvidencePanel';
import { CitedClaimDisplay } from './CitedClaimDisplay';

// ─── Stability Test Panel ──────────────────────────────────────────────────────

interface StabilityTestPanelProps {
  avatar: Avatar;
  clusterMessages: EvidenceMessage[];
}

const StabilityTestPanel: React.FC<StabilityTestPanelProps> = ({ avatar, clusterMessages }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isRunning, setIsRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [report, setReport] = React.useState<StabilityReport | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setProgress(0);
    try {
      const synthesisContext = JSON.stringify(avatar.synthesis ?? {});
      const result = await runStabilityTest(
        avatar,
        clusterMessages,
        synthesisContext,
        ASSEMBLY_PROMPT_SYSTEM,
        AVATAR_STRUCTURE,
        (completed) => setProgress(completed)
      );
      setReport(result);
    } catch {
      // Surface partial result using empty runs
      setReport(computeStabilityReport(avatar.id, avatar.name, []));
    } finally {
      setIsRunning(false);
    }
  };

  const stabilityColor = report
    ? report.overallStability === 'stable' ? 'text-green-600 dark:text-green-400'
    : report.overallStability === 'moderate' ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400'
    : '';

  const stabilityIcon = report
    ? report.overallStability === 'stable' ? '✓'
    : report.overallStability === 'moderate' ? '⚠️'
    : '✗'
    : null;

  return (
    <div className="mt-4 border border-[#F5F5F7] dark:border-white/10 rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-[var(--color-background-tertiary)] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-[#86868B]" />
          <span className="text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-white dark:text-white">
            Stability Test
          </span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-[#86868B]" /> : <ChevronRight className="w-4 h-4 text-[#86868B]" />}
      </button>

      {isOpen && (
        <div className="p-5 space-y-4">
          {isRunning ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#86868B]" />
              <span className="text-sm text-[#86868B]">Running… {progress} / 5</span>
            </div>
          ) : report ? (
            <div className="space-y-3">
              <div className={cn('text-sm font-semibold uppercase tracking-[0.06em]', stabilityColor)}>
                Overall: {report.overallStability.toUpperCase()} {stabilityIcon}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-44 text-[var(--text-xs)] text-[#86868B] uppercase tracking-[0.06em]">Motivation consistency</span>
                  <div className="flex-1 h-2 bg-[var(--color-background-tertiary)] dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-2 bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] rounded-full" style={{ width: `${Math.round(report.motivationStabilityScore * 100)}%` }} />
                  </div>
                  <span className="text-[var(--text-xs)] text-[#86868B] w-8 text-right">{Math.round(report.motivationStabilityScore * 100)}%</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-44 text-[var(--text-xs)] text-[#86868B] uppercase tracking-[0.06em]">Blocker consistency</span>
                  <div className="flex-1 h-2 bg-[var(--color-background-tertiary)] dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-2 bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] rounded-full" style={{ width: `${Math.round(report.blockerStabilityScore * 100)}%` }} />
                  </div>
                  <span className="text-[var(--text-xs)] text-[#86868B] w-8 text-right">{Math.round(report.blockerStabilityScore * 100)}%</span>
                </div>
              </div>
              {report.uniqueMotivations.length > 0 && (
                <div>
                  <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B] mb-1">Motivations seen:</p>
                  <ul className="space-y-0.5">
                    {report.runs.reduce<{ text: string; count: number }[]>((acc, r) => {
                      const existing = acc.find(x => x.text === r.realPrimaryMotivation);
                      if (existing) { existing.count++; } else { acc.push({ text: r.realPrimaryMotivation, count: 1 }); }
                      return acc;
                    }, []).map(({ text, count }) => (
                      <li key={text} className="text-xs text-white dark:text-white">
                        • &ldquo;{text}&rdquo; (×{count})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-[#86868B]">{report.recommendation}</p>
              <button
                onClick={handleRun}
                className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B] hover:text-white dark:hover:text-white transition-colors"
              >
                Re-run
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#86868B]">Status: Not yet run</p>
              <button
                onClick={handleRun}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-white text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] hover:opacity-90 transition-opacity"
              >
                Run Stability Test (5×)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Gap Analysis Panel ────────────────────────────────────────────────────────

interface GapAnalysisPanelProps {
  avatar: Avatar;
  clusterMessages: EvidenceMessage[];
  corpus: { clusters: Cluster[] } | undefined;
}

const GapAnalysisPanel: React.FC<GapAnalysisPanelProps> = ({ avatar, clusterMessages, corpus }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const cluster = corpus?.clusters.find(c => c.id === avatar.clusterId) ?? undefined;
  const report: AvatarGapReport = React.useMemo(
    () => analyzeAvatarGaps(avatar, cluster, clusterMessages),
    [avatar, cluster, clusterMessages]
  );

  const pct = Math.round(report.overallConfidence * 100);

  return (
    <div className="mt-2 border border-[#F5F5F7] dark:border-white/10 rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-[var(--color-background-tertiary)] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[#86868B]" />
          <span className="text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-white dark:text-white">
            Gap Analysis
          </span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-[#86868B]" /> : <ChevronRight className="w-4 h-4 text-[#86868B]" />}
      </button>

      {isOpen && (
        <div className="p-5 space-y-4">
          {/* Overall confidence bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[var(--text-xs)] text-[#86868B] uppercase tracking-[0.06em]">
              <span>Overall confidence</span>
              <span>{pct}% / {Math.round(report.targetConfidence * 100)}% target</span>
            </div>
            <div className="h-2 bg-[var(--color-background-tertiary)] dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn('h-2 rounded-full', pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>

          {/* Ready/Not ready */}
          <div className={cn('flex items-center gap-2 text-sm font-semibold', report.isReadyForCampaign ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {report.isReadyForCampaign
              ? <><CheckCircle2 className="w-4 h-4" /> Ready for campaign</>
              : <><XCircle className="w-4 h-4" /> Not ready for campaign</>
            }
          </div>

          {/* Gaps */}
          {report.gaps.length > 0 && (
            <div className="space-y-2">
              <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">Gaps to close:</p>
              {report.gaps.map(gap => (
                <div key={gap.fieldPath} className="flex items-start gap-3 p-3 rounded-[var(--radius-sm)] border border-[#F5F5F7] dark:border-white/10">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white dark:text-white">{gap.label}</p>
                    <p className="text-[var(--text-xs)] text-[#86868B]">{gap.supportingMessageCount} / 3 messages</p>
                    <p className="text-[var(--text-xs)] text-[#86868B] mt-0.5">{gap.suggestedAction}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {report.gaps.length === 0 && !report.isReadyForCampaign && (
            <p className="text-xs text-[#86868B]">All fields have sufficient evidence. Re-run deep dive to improve confidence score.</p>
          )}

          {/* Cluster health warning */}
          {report.clusterHealthWarning && (
            <div className="flex items-start gap-2 p-3 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">{report.clusterHealthWarning}</p>
            </div>
          )}

          {/* Missing message estimate */}
          {report.totalMissingMessages > 0 && (
            <p className="text-xs text-[#86868B]">
              Estimated: ~{report.totalMissingMessages} message{report.totalMissingMessages !== 1 ? 's' : ''} needed to reach campaign-ready.
            </p>
          )}
        </div>
      )}
    </div>
  );
};




// ── Task 8: Value Element Panel ───────────────────────────────────────────────
interface ValueElementPanelProps {
  avatar: Avatar;
  clusterMessages: EvidenceMessage[];
  offerRecord?: import('../../types/pipeline').AvatarOfferRecord;
  onAssign: (pve: PrimaryValueElement) => void;
}

const ValueElementPanel: React.FC<ValueElementPanelProps> = ({ avatar, clusterMessages, offerRecord, onAssign }) => {
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pve = (avatar as any).primaryValueElement as PrimaryValueElement | undefined;

  const handleAssign = async () => {
    setIsAssigning(true);
    setError(null);
    try {
      const result = await assignValueElement(avatar, offerRecord, clusterMessages);
      onAssign(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="mt-4 border border-[var(--color-border-default)] dark:border-white/10 rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={() => {}}
        className="w-full flex items-center justify-between px-5 py-3 bg-[var(--color-background-tertiary)] dark:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0A84FF]" />
          <span className="text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-white dark:text-white">
            Primary Element of Value
          </span>
          {pve && (
            <span className={cn(
              'text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full border',
              pve.status === 'confirmed'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            )}>
              {pve.status}
            </span>
          )}
        </div>
      </button>
      <div className="p-5 space-y-4">
        {pve ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-[var(--radius-md)] bg-[#0A84FF]/8 border border-[#0A84FF]/20 text-[#0A84FF] text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em]">
                {VALUE_ELEMENT_LABELS[pve.element] ?? pve.element}
              </div>
              <span className="text-[var(--text-xs)] font-bold text-[var(--color-text-secondary)] uppercase tracking-[0.06em]">
                Tier {pve.tier}{pve.usedFallback ? ' (fallback)' : ''}
              </span>
              <span className="ml-auto text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)]">
                {Math.round(pve.confidence * 100)}% confidence
              </span>
            </div>
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed italic">
              {pve.rationale}
            </p>
            <div className="flex items-center gap-3 pt-1">
              {pve.status === 'proposed' && (
                <button
                  onClick={() => onAssign({ ...pve, status: 'confirmed', confirmedAt: new Date().toISOString() })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-emerald-600 text-white text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] hover:bg-emerald-700 transition-colors"
                >
                  <Check size={12} /> Confirm
                </button>
              )}
              <button
                onClick={handleAssign}
                disabled={isAssigning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
              >
                {isAssigning ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                {isAssigning ? 'Re-assigning...' : 'Re-assign'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] flex-1">
              No primary element assigned yet. The AI will analyze this segment's evidence to determine the core value element that drives conversion.
            </p>
            <button
              onClick={handleAssign}
              disabled={isAssigning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-sm)] bg-[#0A84FF] text-white text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] hover:bg-[#0059B3] transition-colors disabled:opacity-50 shrink-0"
            >
              {isAssigning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isAssigning ? 'Assigning...' : 'Assign Element'}
            </button>
          </div>
        )}
        {error && (
          <p className="text-[var(--text-sm)] text-rose-500">{error}</p>
        )}
      </div>
    </div>
  );
};

// ── Task 2: Decision Engine Panel ─────────────────────────────────────────────
interface DecisionEnginePanelProps {
  avatar: Avatar;
}

const DecisionEnginePanel: React.FC<DecisionEnginePanelProps> = ({ avatar }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const synthesis = avatar.synthesis;
  if (!synthesis) return null;

  const confidence = synthesis.confidenceScore ?? 0;
  const motivationText = typeof synthesis.realPrimaryMotivation === 'string'
    ? synthesis.realPrimaryMotivation
    : getClaimText(synthesis.realPrimaryMotivation);
  const winningApproach = typeof synthesis.winningApproach === 'string'
    ? synthesis.winningApproach
    : getClaimText(synthesis.winningApproach);
  const uniqueInsight = typeof synthesis.uniqueInsight === 'string'
    ? synthesis.uniqueInsight
    : getClaimText(synthesis.uniqueInsight);

  const readiness = confidence >= 70 ? 'Ready to implement' : confidence >= 40 ? 'Needs more evidence' : 'Too early to act';
  const readinessColor = confidence >= 70 ? 'text-emerald-600 dark:text-emerald-400' : confidence >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="mt-4 border border-[var(--color-border-default)] dark:border-white/10 rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-[var(--color-background-tertiary)] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#0A84FF]" />
          <span className="text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-white dark:text-white">
            Decision Engine
          </span>
          <span className={cn("text-[var(--text-xs)] font-semibold", readinessColor)}>{readiness}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-[#86868B]" /> : <ChevronRight className="w-4 h-4 text-[#86868B]" />}
      </button>
      {isOpen && (
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--color-background-tertiary)] dark:bg-white/5">
            <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Synthesis Confidence</span>
            <div className="flex items-center gap-3">
              <div className="w-24 h-1.5 bg-[var(--color-border-default)] rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", confidence >= 70 ? "bg-emerald-500" : confidence >= 40 ? "bg-amber-500" : "bg-rose-500")}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className={cn("text-[var(--text-base)] font-semibold tabular-nums", readinessColor)}>{confidence}%</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-[var(--radius-sm)] border border-[var(--color-border-secondary)] bg-[var(--color-card-bg)]">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Implement This Strategy First</span>
              </div>
              <p className="text-[var(--text-base)] font-semibold text-[var(--color-text-primary)] leading-relaxed">{winningApproach}</p>
            </div>
            <div className="p-4 rounded-[var(--radius-sm)] border border-[var(--color-border-secondary)] bg-[var(--color-card-bg)]">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5 text-[#0A84FF]" />
                <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Core Motivation to Address</span>
              </div>
              <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] leading-relaxed">{motivationText}</p>
            </div>
            {uniqueInsight && (
              <div className="p-4 rounded-[var(--radius-sm)] border-2 border-[#0A84FF]/20 bg-[#0A84FF]/3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#0A84FF]" />
                  <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#0A84FF]">Unique Insight (Don't Ignore)</span>
                </div>
                <p className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)] leading-relaxed italic">"{uniqueInsight}"</p>
              </div>
            )}
          </div>

          {synthesis.messagesToUse && synthesis.messagesToUse.length > 0 && (
            <div className="space-y-2">
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-emerald-600 dark:text-emerald-400">Use These Messages</span>
              <ul className="space-y-1.5">
                {synthesis.messagesToUse.slice(0, 3).map((msg, i) => (
                  <li key={i} className="flex items-start gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                    <Check size={12} className="text-emerald-500 mt-0.5 shrink-0" /> {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {synthesis.messagesToAvoid && synthesis.messagesToAvoid.length > 0 && (
            <div className="space-y-2">
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-rose-600 dark:text-rose-400">Avoid These Messages</span>
              <ul className="space-y-1.5">
                {synthesis.messagesToAvoid.slice(0, 3).map((msg, i) => (
                  <li key={i} className="flex items-start gap-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                    <X size={12} className="text-rose-500 mt-0.5 shrink-0" /> {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Task 6: Devil's Advocate Panel ────────────────────────────────────────────
interface DevilsAdvocatePanelProps {
  avatar: Avatar;
}

const DevilsAdvocatePanel: React.FC<DevilsAdvocatePanelProps> = ({ avatar }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const probes = avatar.adversarialProbe ?? [];
  if (probes.length === 0) return null;

  const unresolved = probes.filter(p => !p.isResolved);
  const resolved = probes.filter(p => p.isResolved);

  return (
    <div className="mt-4 border border-[var(--color-border-default)] dark:border-white/10 rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-[var(--color-background-tertiary)] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-white dark:text-white">
            Devil's Advocate
          </span>
          {unresolved.length > 0 && (
            <span className="text-[var(--text-xs)] font-semibold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">{unresolved.length} unresolved</span>
          )}
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-[#86868B]" /> : <ChevronRight className="w-4 h-4 text-[#86868B]" />}
      </button>
      {isOpen && (
        <div className="p-5 space-y-4">
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            These objections were raised during the adversarial validation phase. {resolved.length > 0 ? `${resolved.length} resolved, ${unresolved.length} remain open.` : `${unresolved.length} remain open.`}
          </p>
          <div className="space-y-3">
            {probes.map((probe, i) => (
              <div
                key={i}
                className={cn(
                  "p-4 rounded-[var(--radius-sm)] border space-y-3",
                  probe.isResolved
                    ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10"
                    : "border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-900/10"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]", probe.isResolved ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                      {probe.attackVector}
                    </span>
                    {probe.isResolved && <CheckCircle2 size={12} className="text-emerald-500" />}
                    {!probe.isResolved && <XCircle size={12} className="text-rose-500" />}
                  </div>
                  <p className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)]">{probe.objection}</p>
                </div>
                {probe.isResolved && (
                  <div>
                    <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-emerald-600 dark:text-emerald-400 block mb-1">Resolution</span>
                    <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed">{probe.resolution}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface AvatarDeepDiveCardProps {
  avatar: Avatar;
  company: Company;
  offer: Offer;
  index?: number;
  onUpdateAvatar?: (updated: Avatar) => void;
  industry?: string;
  onDeepDiveComplete?: (avatar: Avatar) => void;
  allAvatars?: Avatar[];
  onGenerateSubAvatars?: (parent: Avatar) => Promise<void>;
  showOfferOnly?: boolean;
}

const EditableText: React.FC<{
  value: string;
  onSave: (val: string) => void;
  label: string;
  isTextArea?: boolean;
  dark?: boolean;
}> = ({ value, onSave, label, isTextArea, dark }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempValue, setTempValue] = React.useState(value);

  if (!isEditing) {
    return (
      <div 
        onClick={() => setIsEditing(true)}
        className="group cursor-pointer relative p-4 -m-4 rounded-[var(--radius-md)] hover:bg-[var(--color-background-tertiary)] transition-all"
      >
        <span className={cn("text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] block mb-2", dark ? "text-white/30" : "text-[#86868B]/60")}>{label}</span>
        <p className={cn("text-[var(--text-lg)] leading-relaxed transition-colors font-medium", dark ? "text-white" : "text-white")}>
          {value || 'Click to add...'}
        </p>
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <Zap size={14} className="text-amber-500 fill-amber-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <span className="text-[var(--text-xs)] font-semibold text-[#86868B] dark:text-white/40 uppercase tracking-[0.06em] block">{label} (Editing)</span>
      {isTextArea ? (
        <textarea
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          className={cn("w-full p-4 border-2 border-[#1D1D1F] dark:border-white/20 rounded-[var(--radius-md)] outline-none text-[var(--text-base)] min-h-[100px] resize-none", dark ? "bg-[#1D1D1F] text-white" : "bg-[var(--color-card-bg)] text-white")}
        />
      ) : (
        <input
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          className={cn("w-full p-4 border-2 border-[#1D1D1F] dark:border-white/20 rounded-[var(--radius-md)] outline-none text-[var(--text-base)]", dark ? "bg-[#1D1D1F] text-white" : "bg-[var(--color-card-bg)] text-white")}
        />
      )}
      <div className="flex gap-2">
        <button 
          onClick={() => {
            onSave(tempValue);
            setIsEditing(false);
          }}
          className="px-4 py-2 bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-white text-[var(--text-sm)] font-semibold rounded-[var(--radius-sm)] uppercase tracking-[0.06em]"
        >
          Save
        </button>
        <button 
          onClick={() => {
            setTempValue(value);
            setIsEditing(false);
          }}
          className="px-4 py-2 bg-gray-100 text-[#86868B] text-[var(--text-sm)] font-semibold rounded-[var(--radius-sm)] uppercase tracking-[0.06em]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export const AvatarDeepDiveCard: React.FC<AvatarDeepDiveCardProps> = ({ 
  avatar, 
  company, 
  offer, 
  index, 
  onUpdateAvatar, 
  industry, 
  onDeepDiveComplete,
  allAvatars,
  onGenerateSubAvatars,
  showOfferOnly
}) => {
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [streamingStatus, setStreamingStatus] = React.useState<string>('');
  const [selectedElement, setSelectedElement] = React.useState<any>(null);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [showMessageMining, setShowMessageMining] = React.useState(false);
  const [showProvenance, setShowProvenance] = React.useState(true);

  const corpus = useCorpusStore(s => s.corpora[company.id]);
  const clusterMessages = React.useMemo(() => {
    if (!corpus || !avatar.clusterId) return [];
    const cluster = corpus.clusters.find(c => c.id === avatar.clusterId);
    if (!cluster) return [];
    return corpus.messages.filter(m => cluster.messageIds.includes(m.id));
  }, [corpus, avatar.clusterId]);
  const avatarOffers = usePipelineStore(s => s.avatarOffers);
  // useShallow prevents re-renders when the filtered array contents haven't changed
  const provenanceLinks = usePipelineStore(
    useShallow((s) => s.getProvenance(company.id, avatar.id))
  );
  // Evidence-first: resolve the core offer (may be null if not yet synthesised).
  // regenerateTargetedOffer no longer requires it to be present.
  const avatarOffer = React.useMemo(
    () => Object.values(avatarOffers).find(o => o.avatarId === avatar.id),
    [avatarOffers, avatar.id]
  );
  const provenanceItems = React.useMemo(
    () =>
      resolveAvatarProvenance(
        avatar,
        corpus?.messages ?? [],
        corpus?.clusters ?? [],
        provenanceLinks,
        avatarOffer
      ),
    [avatar, corpus?.messages, corpus?.clusters, provenanceLinks, avatarOffer]
  );

  const tryParseDetailed = (text: string) => {
    const sections = [
      'demographics',
      'traits',
      'sources',
      'transformation',
      'targetedOffer',
      'visualDescriptor',
      'questionnaire',
      'marketIntelligence'
    ];

    const extracted: any = {};
    let foundAny = false;

    sections.forEach(section => {
      // Look for the section and its complete object/array
      // This regex looks for "section": { ... } or "section": [ ... ]
      const regex = new RegExp(`"${section}"\\s*:\\s*([\\{\\[][\\s\\S]*?[\\}\\]])`, 'g');
      const match = regex.exec(text);
      if (match && match[1]) {
        try {
          // Validate it's a complete JSON fragment by parsing it
          const parsed = JSON.parse(match[1]);
          extracted[section] = parsed;
          foundAny = true;
        } catch (e) {
          // Not complete yet
        }
      }
    });

    return foundAny ? extracted : null;
  };


  const handleEdit = (field: string, newValue: string, subField?: string) => {
    if (!onUpdateAvatar) return;
    
    const before = subField ? (avatar as any)[field]?.[subField] : (avatar as any)[field];
    
    addToEditHistory({
        field: subField || field,
        before: before || '',
        after: newValue,
        industry: industry || 'General',
        timestamp: new Date().toISOString(),
        type: 'user_edit'
    });

    const updated = { ...avatar };
    if (subField) {
      (updated as any)[field] = {
        ...(updated as any)[field],
        [subField]: newValue
      };
    } else {
      (updated as any)[field] = newValue;
    }
    
    onUpdateAvatar(updated);
  };

  const handleOfferRegenerationForAvatars = async (avatars: Avatar[]) => {
    if (!onUpdateAvatar) return;
    setIsRegenerating(true);
    try {
      for (const av of avatars) {
        const updated = await regenerateTargetedOffer(company, av);
        onUpdateAvatar(updated);
      }
    } catch (err) {
      console.error('Failed to regenerate offers:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRegenerateOffer = async () => {
    if (!onUpdateAvatar || isRegenerating) return;
    setIsRegenerating(true);
    try {
       const updated = await regenerateTargetedOffer(company, avatar);
       onUpdateAvatar(updated);
    } catch (err) {
       console.error("Failed to regenerate offer:", err);
    } finally {
       setIsRegenerating(false);
    }
  };
  // Use dicebear for more professional avatars if no image provided
  const avatarUrl = avatar.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.id}&backgroundColor=2C2C2E,3A3A3C,1D1D1F`;

  // Guard: if avatar object is corrupt/incomplete, render nothing to avoid crashes
  if (!avatar?.id || !avatar?.name) return null;

  return (
    <div className="space-y-16 relative">
      <AnimatePresence>
        {isStreaming && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="sticky top-6 z-[60] flex justify-center pointer-events-none mb-16"
          >
            <div className="px-8 py-4 bg-white/80 dark:bg-[#1D1D1F]/80 backdrop-blur-xl border border-[var(--color-border-secondary)] dark:border-white/10 rounded-full shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)] flex items-center gap-4 pointer-events-auto ring-1 ring-black/5">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="relative w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                     <Brain size={20} className="text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <div className="flex flex-col items-start translate-y-0.5">
                    <span className="text-[var(--text-xs)] font-semibold text-[#86868B] dark:text-white/40 uppercase tracking-[0.4em] leading-none mb-1.5 opacity-60">Synthesis Pipeline</span>
                    <span className="text-[var(--text-base)] font-bold text-white dark:text-white tracking-tight">{streamingStatus}</span>
                </div>
                <div className="w-px h-8 bg-[#D2D2D7]/40 dark:bg-white/10 mx-2" />
                <Loader2 size={18} className="text-emerald-500 animate-spin" strokeWidth={3} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Photo */}
      {!showOfferOnly && (
      <div className="flex flex-col md:flex-row items-center md:items-start gap-12 pt-8">
         <div className="relative group">
            <div className="w-40 h-40 md:w-64 md:h-64 bg-[var(--color-card-bg)] dark:bg-[#1D1D1F] rounded-[var(--radius-md)] md:rounded-[var(--radius-full)] border border-[var(--color-border-secondary)] dark:border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] dark:shadow-2xl flex items-center justify-center overflow-hidden shrink-0 transition-all duration-700 group-hover:scale-[1.05] group-hover:shadow-[0_60px_100px_-20px_rgba(0,0,0,0.15)]">
               <img 
                 src={avatarUrl} 
                 alt={avatar.name} 
                 className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                 referrerPolicy="no-referrer"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </div>
            {typeof index === 'number' && (
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-[#1D1D1F] text-white rounded-[var(--radius-md)] flex items-center justify-center font-display font-bold text-2xl shadow-2xl border-4 border-[#FBFBFD] z-10 rotate-6 group-hover:rotate-0 transition-transform duration-500">
                 {index + 1}
              </div>
            )}
         </div>

         <div className="flex-1 space-y-8 text-center md:text-left">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 justify-center md:justify-start">
                  <h3 className="text-[var(--text-xl)] font-display font-bold tracking-tight leading-[0.9] text-white dark:text-white">Empathy Model.</h3>
                  <div className="flex gap-3 justify-center md:justify-start">
                    <span className="text-[var(--text-xs)] bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-white px-5 py-2 rounded-full font-semibold uppercase tracking-[0.2em] shadow-lg">
                       {avatar.name}
                    </span>
                    <div className="flex items-center gap-2 px-5 py-2 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em]">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                       High Fidelity
                    </div>
                  </div>
               </div>
               <p className="text-[var(--text-lg)] text-[#86868B] dark:text-white/60 max-w-[800px] leading-relaxed font-medium tracking-tight pr-4">{avatar.description}</p>
            </div>
            
            <div className="flex flex-wrap gap-3 items-center justify-center md:justify-start">
               <button
                 type="button"
                 onClick={() => setShowMessageMining(true)}
                 className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
               >
                 <MessageSquare size={14} />
                 Add evidence
               </button>
               <button
                 type="button"
                 onClick={() => setShowProvenance(p => !p)}
                 className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-background-tertiary)] dark:bg-white/10 text-white dark:text-white text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em]"
               >
                 <Layers size={14} />
                 {showProvenance ? 'Hide' : 'Show'} provenance
               </button>
               {avatar.targetedOffer && onUpdateAvatar && (
                 <button
                   type="button"
                   onClick={handleRegenerateOffer}
                   disabled={isRegenerating}
                   className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-background-tertiary)] dark:bg-white/10 text-white dark:text-white text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] hover:bg-[#EBEBED] dark:hover:bg-white/15 transition-colors disabled:opacity-50"
                 >
                   {isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                   Regenerate Offer
                 </button>
               )}
            </div>

            <div className="flex flex-wrap gap-6 items-center justify-center md:justify-start">
               <div className="inline-flex items-center gap-4 px-8 py-4 bg-[var(--color-card-bg)] dark:bg-[#222222] rounded-[var(--radius-md)] border border-[var(--color-border-secondary)] dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--color-background-tertiary)] dark:bg-white/10 flex items-center justify-center text-white dark:text-white">
                    <ShieldCheck size={22} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col items-start translate-y-0.5">
                     <span className="text-[var(--text-xs)] font-semibold text-[#86868B] dark:text-white/30 uppercase tracking-[0.3em] leading-none mb-1.5 opacity-60">Dominant Trait</span>
                     <span className="text-[var(--text-lg)] font-bold text-white dark:text-white tracking-tight">{avatar.definingCharacteristic}</span>
                  </div>
               </div>

               {avatar.elementsOfValue && avatar.elementsOfValue.length > 0 && (
                 <div className="flex flex-wrap gap-3 justify-center">
                   {avatar.elementsOfValue.map((val, i) => (
                     <button 
                       key={i}
                       onClick={() => setSelectedElement(val)}
                       className={cn(
                         "flex items-center gap-3 px-6 py-3 bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-full shadow-sm hover:border-[#0A84FF] transition-all hover:-translate-y-0.5 active:scale-95 group/element",
                         selectedElement === val && "ring-2 ring-[#0A84FF] border-[#0A84FF]"
                       )}
                     >
                       <div className={cn(
                         "w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]",
                         val.category === 'Functional' ? "bg-[#0A84FF]" :
                         val.category === 'Emotional' ? "bg-[#FF3B30]" :
                         val.category === 'Life Changing' ? "bg-[#34C759]" : "bg-[#AF52DE]"
                       )} />
                       <span className="text-[var(--text-base)] font-bold text-white group-hover/element:text-[#0A84FF] tracking-tight">{val.element}</span>
                     </button>
                   ))}
                 </div>
               )}
            </div>
         </div>

          <AnimatePresence>
            {selectedElement && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden w-full"
              >
                <div className="p-8 bg-[#1D1D1F]/5 dark:bg-white/5 rounded-[var(--radius-md)] border border-[#1D1D1F]/10 dark:border-white/10 space-y-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <Info size={16} className="text-white dark:text-white/60" />
                         <span className="text-[var(--text-sm)] font-semibold text-white dark:text-white/60 uppercase tracking-[0.06em]">Why they need {selectedElement.element}</span>
                      </div>
                      <button onClick={() => setSelectedElement(null)} className="text-[#86868B] hover:text-white dark:hover:text-white">
                         <X size={16} />
                      </button>
                   </div>
                   <p className="text-[var(--text-lg)] font-bold text-white dark:text-white/90 leading-relaxed">
                     {selectedElement.reasonWhy || `This ${selectedElement.category} element is critical because it addresses specific unmet needs within ${avatar.name}'s current psychological state.`}
                   </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>
      )}

      {!showOfferOnly && avatar.valueAnalysis && (
        <div className="bg-[#1D1D1F] dark:bg-[#111111] border border-white/5 rounded-[var(--radius-full)] p-16 text-left relative overflow-hidden text-white shadow-2xl">
           <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/10 blur-[160px] -mr-[400px] -mt-[400px] rounded-full opacity-60" />
           <div className="flex flex-col md:flex-row gap-16 items-start relative z-10">
              <div className="w-16 h-16 bg-emerald-500 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 shadow-2xl">
                 <Sparkles size={32} className="text-white" />
              </div>
              <div className="space-y-6">
                 <div>
                   <h4 className="text-[var(--text-base)] font-semibold text-emerald-500 uppercase tracking-[0.3em] mb-4">
                      Strategic Relevance: Why they buy
                   </h4>
                   <p className="text-[var(--text-xl)] text-white/95 leading-tight font-bold italic">
                     "{avatar.valueAnalysis}"
                   </p>
                 </div>
                 <div className="flex items-center gap-4 text-white/40 text-[var(--text-sm)] font-bold uppercase tracking-[0.06em]">
                    <span>Market Psychology</span>
                    <div className="h-px bg-white/10 flex-1" />
                    <span>Proprietary Logic</span>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* NEW: Behavioral Sensitivity Analysis */}
      {!showOfferOnly && avatar.behavioralAnalysis && avatar.behavioralAnalysis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
           {avatar.behavioralAnalysis.map((item, i) => (
              <div 
                key={i} 
                className={cn(
                  "p-10 rounded-[var(--radius-md)] border-2 flex flex-col gap-6 shadow-sm transition-transform hover:-translate-y-1 duration-500",
                  item.category === 'Functional' ? "bg-[#F5FBFF] border-[#E1F3FF]" :
                  item.category === 'Emotional' ? "bg-[#FFF5F5] border-[#FFE1E1]" :
                  item.category === 'Life Changing' ? "bg-[#F5FFF9] border-[#E1FFE1]" : "bg-[#F9F5FF] border-[#F1E1FF]"
                )}
              >
                 <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      item.category === 'Functional' ? "bg-[#0A84FF] shadow-[0_0_10px_#0A84FF]" :
                      item.category === 'Emotional' ? "bg-[#FF3B30] shadow-[0_0_10px_#FF3B30]" :
                      item.category === 'Life Changing' ? "bg-[#34C759] shadow-[0_0_10px_#34C759]" : "bg-[#AF52DE] shadow-[0_0_10px_#AF52DE]"
                    )} />
                    <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-white/40">
                       {item.category} Vector
                    </span>
                 </div>
                 <p className="text-[var(--text-base)] font-bold text-white leading-relaxed tracking-tight">
                    {item.analysis}
                 </p>
              </div>
           ))}
        </div>
      )}

      {/* NEW: Market Intelligence (P16) */}
      {!showOfferOnly && avatar.marketIntelligence && (
        <div className="space-y-16">
          <div className="flex items-center gap-6">
            <div className="h-px bg-[#D2D2D7]/60 dark:bg-white/10 flex-1" />
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[#1D1D1F] dark:bg-white/10 flex items-center justify-center text-white">
                    <Globe size={20} strokeWidth={2.5} />
                </div>
                <h4 className="text-[var(--text-sm)] font-semibold text-white dark:text-white uppercase tracking-[0.5em] leading-none translate-y-0.5">Empathy Intel / {company.country}</h4>
              </div>
            </div>
            <div className="h-px bg-[#D2D2D7]/60 dark:bg-white/10 flex-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-12 bg-[var(--color-card-bg)] dark:bg-[#222222] border border-[var(--color-border-secondary)] dark:border-white/10 rounded-[var(--radius-full)] shadow-sm space-y-6 text-left hover:border-emerald-500/20 transition-colors duration-500">
              <div className="flex items-center gap-3 text-[#86868B]/60 dark:text-white/30 text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em]">
                <Zap size={16} className="text-[#FF9500]" strokeWidth={3} /> Price Perception Archetype
              </div>
              <p className="text-[var(--text-lg)] font-bold text-white dark:text-white/90 leading-[1.3] tracking-tight italic pr-4">
                "{avatar.marketIntelligence.pricePerception}"
              </p>
            </div>
            <div className="p-12 bg-[var(--color-card-bg)] dark:bg-[#222222] border border-[var(--color-border-secondary)] dark:border-white/10 rounded-[var(--radius-full)] shadow-sm space-y-6 text-left hover:border-emerald-500/20 transition-colors duration-500">
              <div className="flex items-center gap-3 text-[#86868B]/60 dark:text-white/30 text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em]">
                <Activity size={16} className="text-[#0A84FF]" strokeWidth={3} /> Behavioral Pattern Detection
              </div>
              <p className="text-[var(--text-lg)] font-bold text-white dark:text-white/90 leading-[1.3] tracking-tight italic pr-4">
                "{avatar.marketIntelligence.buyingBehavior}"
              </p>
            </div>
            <div className="p-16 bg-[#1D1D1F] dark:bg-[#111111] text-white rounded-[var(--radius-full)] shadow-2xl space-y-12 md:col-span-2 relative overflow-hidden text-left border border-white/5">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 blur-[140px] -mr-[300px] -mt-[300px] rounded-full" />
                <div className="relative z-10 space-y-12">
                    <div className="flex items-center gap-5 text-white/30 text-[var(--text-xs)] font-semibold uppercase tracking-[0.4em] leading-none">
                      <Heart size={16} className="text-[#FF2D55]" strokeWidth={3} /> Cultural Axioms & Strategic Framing
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 text-left">
                        <div className="space-y-4 text-left border-l border-white/10 pl-8">
                            <span className="text-[var(--text-xs)] font-semibold text-white/20 uppercase tracking-[0.3em]">Environmental Lens</span>
                            <p className="text-[var(--text-lg)] font-medium leading-relaxed text-white/80 italic pr-8">"{avatar.marketIntelligence.culturalConsiderations}"</p>
                        </div>
                        <div className="p-10 bg-white/5 rounded-[var(--radius-md)] border border-white/10 space-y-4 text-left shadow-inner">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
                                <span className="text-[var(--text-xs)] font-semibold text-emerald-500 uppercase tracking-[0.3em]">Vertical Framing Matrix</span>
                            </div>
                            <p className="text-[var(--text-xl)] font-bold text-white leading-tight tracking-tight">{avatar.marketIntelligence.offerFraming}</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Transformation Grid */}
      {!showOfferOnly && avatar.transformation && (
        <div className="space-y-20">
           <div className="flex items-center justify-center">
              <div className="inline-flex flex-col items-center gap-4">
                <div className="h-0.5 w-16 bg-emerald-500 rounded-full mb-2" />
                <h4 className="text-[var(--text-sm)] font-semibold text-white dark:text-white uppercase tracking-[0.5em] leading-none mb-2">The Transformation Logic</h4>
                <p className="text-[var(--text-base)] text-[#86868B] font-medium uppercase tracking-[0.2em] opacity-40">Psychological Shift Analysis</p>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative">
              <div className="absolute left-1/2 top-12 bottom-12 w-px bg-gradient-to-b from-transparent via-[#D2D2D7]/60 to-transparent hidden lg:block" />
              
              {/* Before State */}
              <div className="space-y-12">
                 <div className="inline-flex items-center gap-4 px-8 py-3 bg-[var(--color-background-tertiary)] rounded-full border border-[var(--color-border-secondary)] text-[#86868B] shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#86868B]/40" />
                    <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em]">Stage 01 / Entropic Current</span>
                 </div>

                 <div className="space-y-6">
                    {[
                      { label: 'The Friction Problem', value: avatar.transformation.beforeProblem },
                      { label: 'Current Possessions', value: avatar.transformation.beforeHave },
                      { label: 'Visceral Feelings', value: avatar.transformation.beforeFeelings, italic: true },
                      { label: 'Day Zero Reality', value: avatar.transformation.beforeDay },
                      { label: 'Baseline Status', value: avatar.transformation.beforeStatus },
                    ].map((item, idx) => (
                      <div key={idx} className="p-8 bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] hover:border-[var(--color-border-secondary)] transition-all shadow-sm">
                         <span className="text-[var(--text-xs)] font-semibold text-[#86868B]/60 uppercase tracking-[0.3em] block mb-3 leading-none">{item.label}</span>
                         <p className={cn("text-[var(--text-lg)] leading-relaxed text-white font-medium", item.italic && "italic text-white/70")}>
                            {item.value || 'N/A'}
                         </p>
                      </div>
                    ))}
                 </div>
              </div>

              {/* After State */}
              <div className="space-y-12">
                 <div className="inline-flex items-center gap-4 px-8 py-3 bg-[#1D1D1F] rounded-full text-white shadow-2xl shadow-black/20">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_#10B981]" />
                    <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em]">Stage 02 / Master Synthesis</span>
                 </div>

                 <div className="space-y-6">
                    {[
                      { label: 'Primary Solution Vector', value: avatar.transformation.afterBenefit },
                      { label: 'Recursive Value ("So What")', value: avatar.transformation.afterDeepBenefit, highlight: true },
                      { label: 'Mastery Possessions', value: avatar.transformation.afterHave },
                      { label: 'Synthesized Feelings', value: avatar.transformation.afterFeelings },
                      { label: 'The Optimized Day', value: avatar.transformation.afterDay },
                      { label: 'Elevated Social Status', value: avatar.transformation.afterStatus },
                    ].map((item, idx) => (
                      <div key={idx} className={cn(
                        "p-8 rounded-[var(--radius-md)] border-2 transition-all shadow-sm",
                        item.highlight ? "bg-[#0A84FF]/[0.02] border-[#0A84FF]/20 shadow-[0_20px_40px_-10px_rgba(10,132,255,0.05)]" : "bg-[var(--color-card-bg)] border-[var(--color-border-secondary)] hover:border-[var(--color-border-secondary)]"
                      )}>
                         <span className={cn(
                           "text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] block mb-3 leading-none",
                           item.highlight ? "text-[#0A84FF]" : "text-[#86868B]/60"
                         )}>{item.label}</span>
                         <p className={cn(
                           "text-[var(--text-lg)] leading-relaxed font-bold tracking-tight",
                           item.highlight ? "text-[#0A84FF]" : "text-white"
                         )}>
                            {item.value || 'N/A'}
                         </p>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Hook Summary */}
           <div className="pt-24 border-t border-[var(--color-border-secondary)] flex flex-col items-center text-center space-y-8">
              <div className="inline-flex items-center gap-3 text-[#0A84FF]">
                 <Quote size={24} strokeWidth={2.5} />
                 <span className="text-[var(--text-sm)] font-semibold uppercase tracking-[0.5em] opacity-80">Transformation Pivot Point</span>
              </div>
              <p className="text-[var(--text-xl)] font-display font-bold tracking-tight italic max-w-[1000px] leading-[1.1] text-white">
                 "{avatar.transformation.hook}"
              </p>
              <div className="h-0.5 w-24 bg-[#0A84FF]/20 rounded-full" />
           </div>
        </div>
      )}

      {/* NEW: Transformation Framework (7 Stages) */}
      {!showOfferOnly && (
      <div className="space-y-10">
         <div className="flex items-center gap-4">
            <div className="h-px bg-[#D2D2D7]/30 flex-1" />
            <h4 className="text-[var(--text-base)] font-semibold text-[#86868B] uppercase tracking-[0.4em]">Before & After Transformation Framework</h4>
            <div className="h-px bg-[#D2D2D7]/30 flex-1" />
         </div>

         <div className="grid grid-cols-1 gap-8">
            {[
               { icon: Heart, title: '1. Emotional State', key: 'emotional', desc: 'How they feel about the problem vs. the solution' },
               { icon: Package, title: '2. Tangible & Intangible Results', key: 'results', desc: 'Possessions, metrics, and invisible assets' },
               { icon: Sun, title: '3. Lifestyle Transformation', key: 'lifestyle', desc: 'How their average day changes' },
               { icon: Activity, title: '4. Stress & Relief', key: 'stress', desc: 'Frustration levels and the peace that follows' },
               { icon: Users, title: '5. Identity & Belonging', key: 'identity', desc: 'Community affiliations and social self-labeling' },
               { icon: MessageCircle, title: '6. Relationships & Conversations', key: 'relationships', desc: 'What they talk about with family and friends' },
               { icon: User, title: '7. Self-Perception', key: 'selfPerception', desc: 'Internal narrative and confidence' },
            ].map((stage, i) => {
               const data = (avatar.transformationFramework as any)?.[stage.key];
               if (!data) return null;
               const Icon = stage.icon;

               return (
                  <motion.div 
                    key={stage.key}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="group"
                  >
                     <div className="bg-[var(--color-card-bg)] border-2 border-[var(--color-border-secondary)] rounded-[var(--radius-md)] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 hover:border-[#0A84FF]/20">
                        <div className="p-8 border-b border-[var(--color-border-secondary)] bg-[var(--color-background-tertiary)]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                           <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] shadow-md border border-[var(--color-border-secondary)] flex items-center justify-center text-[#0A84FF] transition-transform group-hover:scale-110">
                                 <Icon size={20} />
                              </div>
                              <div>
                                 <h5 className="text-[var(--text-lg)] font-semibold tracking-tight">{stage.title}</h5>
                                 <p className="text-[var(--text-sm)] text-[#86868B] font-medium">{stage.desc}</p>
                              </div>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2">
                           <div className="p-8 space-y-4 border-r border-[var(--color-border-secondary)] bg-[var(--color-background-tertiary)]/10">
                              <div className="flex items-center gap-2 text-[#86868B]">
                                 <div className="w-2 h-2 rounded-full bg-[#86868B]" />
                                 <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]">The "Before" State</span>
                              </div>
                              <p className="text-[var(--text-base)] text-white leading-relaxed font-semibold italic">
                                 "{data.before}"
                              </p>
                           </div>
                           <div className="p-8 space-y-4 bg-[#0A84FF]/[0.02]">
                              <div className="flex items-center gap-2 text-[#0A84FF]">
                                 <div className="w-2 h-2 rounded-full bg-[#0A84FF] shadow-[0_0_8px_#0A84FF]" />
                                 <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]">The "After" Mastery</span>
                              </div>
                              <p className="text-[var(--text-base)] text-white leading-relaxed font-bold">
                                 {data.after}
                              </p>
                           </div>
                        </div>
                     </div>
                  </motion.div>
               );
            })}
         </div>
      </div>
      )}

      {avatar.targetedOffer && (
        <div className="relative pt-24 pb-12">
           <div className="absolute inset-0 bg-[#0A84FF] rounded-[var(--radius-full)] rotate-[0.5deg] scale-[1.02] opacity-[0.03] -z-10" />
           <div className="bg-[var(--color-card-bg)] border border-[#0A84FF]/20 rounded-[var(--radius-full)] p-20 shadow-[0_60px_100px_-20px_rgba(10,132,255,0.12)] overflow-hidden relative text-left">
              <div className="absolute top-0 right-0 p-16 bg-[#0A84FF]/5 rounded-bl-[120px] border-l border-b border-[#0A84FF]/10">
                 <Zap size={80} className="text-[#0A84FF] opacity-20" strokeWidth={1.5} />
              </div>
              
              <div className="max-w-[800px] space-y-12 relative z-10">
                 <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] rounded-full text-white dark:text-white text-[var(--text-xs)] font-semibold uppercase tracking-[0.4em] shadow-xl">
                           Vertical Optimization
                        </div>
                        <div className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.3em] opacity-40">Segment: {avatar.name}</div>
                    </div>
                    <h4 className="text-[var(--text-xl)] font-display font-bold tracking-tight leading-[0.9] text-white pr-12">
                       {avatar.targetedOffer.offerName}
                    </h4>
                 </div>

                 <div className="space-y-12">
                    {avatar.targetedOffer.score && (
                       <OfferScoreCard score={avatar.targetedOffer.score} className="p-10 bg-[var(--color-background-tertiary)]/30 rounded-[var(--radius-md)] border border-[var(--color-border-secondary)] shadow-inner" />
                    )}
                    <div className="space-y-4 border-l-4 border-emerald-500 pl-10">
                       <div className="flex items-center gap-3 text-emerald-500 text-[var(--text-xs)] font-semibold uppercase tracking-[0.4em] leading-none mb-4">
                          Synthesized Core Transformation
                       </div>
                       <p className="text-[var(--text-xl)] font-bold text-white leading-tight tracking-tight">
                          {avatar.targetedOffer.transformation}
                       </p>
                    </div>

                    <div className="p-12 bg-[#0A84FF] rounded-[var(--radius-md)] space-y-6 shadow-[0_40px_80px_-20px_rgba(10,132,255,0.4)] group/offer-box relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[60px] -mr-32 -mt-32" />
                       <div className="flex items-center gap-3 text-white/60 text-[var(--text-xs)] font-semibold uppercase tracking-[0.5em] relative z-10">
                          <Quote size={16} strokeWidth={3} /> Strategic Hook Vector
                       </div>
                       <p className="text-[var(--text-xl)] font-display font-bold tracking-tight text-white italic leading-tight relative z-10 pr-8">
                          "{avatar.targetedOffer.hook}"
                       </p>
                       <div className="pt-6 flex justify-end relative z-10">
                           <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center text-white group-hover/offer-box:scale-110 group-hover/offer-box:border-white transition-all duration-500">
                               <ArrowRight size={24} strokeWidth={3} />
                           </div>
                       </div>
                    </div>

                    <div className="space-y-4 pl-4">
                       <div className="text-[#86868B]/60 text-[var(--text-xs)] font-semibold uppercase tracking-[0.4em]">Engine Logic Reasoning</div>
                       <p className="text-[var(--text-lg)] font-medium text-white/70 leading-relaxed max-w-[640px]">
                          {avatar.targetedOffer.reasoning || "Optimized to bypass segment-specific psychological friction and leverage the brand's unique market authority."}
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Rendered Copy — Phase 16 output from render_copy pipeline step */}
      {avatarOffer?.rendered && (avatarOffer.rendered.hook || avatarOffer.rendered.offerName || avatarOffer.rendered.longCopy) && (
        <div className="mt-8 p-8 rounded-[var(--radius-md)] bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border border-violet-200 dark:border-violet-800/40 space-y-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 rounded-full text-white text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]">
              Rendered Copy
            </div>
            <span className="text-[var(--text-xs)] text-[#86868B] uppercase tracking-[0.06em]">AI-generated copy variants</span>
          </div>
          {avatarOffer.rendered.offerName && (
            <div className="space-y-1">
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-violet-600 dark:text-violet-400">Offer Name</span>
              <p className="text-[var(--text-lg)] font-bold text-white dark:text-white leading-tight">{avatarOffer.rendered.offerName}</p>
            </div>
          )}
          {avatarOffer.rendered.hook && (
            <div className="space-y-1">
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-violet-600 dark:text-violet-400">Hook</span>
              <p className="text-[var(--text-lg)] font-semibold italic text-white dark:text-white leading-snug">&ldquo;{avatarOffer.rendered.hook}&rdquo;</p>
            </div>
          )}
          {avatarOffer.rendered.longCopy && (
            <div className="space-y-1">
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-violet-600 dark:text-violet-400">Long Copy</span>
              <p className="text-[var(--text-base)] text-white/80 dark:text-white/80 leading-relaxed">{avatarOffer.rendered.longCopy}</p>
            </div>
          )}
        </div>
      )}

            {/* Original Content Below (Compressed for flow) */}
      {!showOfferOnly && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
        <div className="lg:col-span-1 space-y-8">
           <div className="bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] p-10 shadow-sm">
              <h4 className="text-[var(--text-sm)] font-semibold text-[#86868B] uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                 <Target size={18} /> Demographics
              </h4>
              <div className="space-y-4">
                 {[
                   { label: 'Age Range', value: avatar.demographics?.age },
                   { label: 'Income Level', value: avatar.demographics?.income },
                   { label: 'Education', value: avatar.demographics?.education },
                   { label: 'Location', value: avatar.demographics?.location },
                 ].map(item => (
                   <div key={item.label} className="group p-5 bg-[var(--color-background-tertiary)] rounded-[var(--radius-md)] border border-transparent hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-card-bg)] transition-all">
                      <span className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.06em] block mb-1">{item.label}</span>
                      <span className="text-[var(--text-lg)] font-bold text-white">{item.value || 'N/A'}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="lg:col-span-2 space-y-8 text-left">
           <div className="bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] p-10 shadow-sm text-left">
              <h4 className="text-[var(--text-sm)] font-semibold text-[#86868B] uppercase tracking-[0.2em] mb-10 flex items-center gap-2">
                 <Zap size={18} /> Deep Psychological Questionnaire
              </h4>
              
              <div className="space-y-12 text-left">
                {/* Section: Fears & Motivations */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={16} className="text-rose-500" />
                    <span className="text-[var(--text-xs)] font-semibold uppercase text-[#86868B] tracking-[0.06em]">Inhibitors & Drivers</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[
                      { q: 'What results in anxiety?', a: avatar.questionnaire?.anxious },
                      { q: 'What motivates them to take action?', a: avatar.questionnaire?.motivation },
                      { q: 'What makes life feel complicated?', a: avatar.questionnaire?.complicated },
                      { q: 'What information do they find valuable?', a: avatar.questionnaire?.valuableInfo },
                    ].map(item => (
                      <div key={item.q} className="space-y-2 group text-left">
                        <div className="text-[var(--text-base)] font-semibold text-white uppercase tracking-tight">{item.q}</div>
                        <p className="text-[var(--text-base)] text-[#515154] leading-relaxed pl-4 font-medium italic border-l-2 border-[var(--color-border-secondary)] group-hover:border-[#0A84FF]/30 transition-colors">
                          {item.a || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Values & Motivations (Health, Money, Design) */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Heart size={16} className="text-red-500" />
                    <span className="text-[var(--text-xs)] font-semibold uppercase text-[#86868B] tracking-[0.06em]">Core Value Lens</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { q: 'Money Motivation', a: avatar.questionnaire?.moneyMotivation },
                      { q: 'Health Motivation', a: avatar.questionnaire?.healthMotivation },
                      { q: 'Design Motivation', a: avatar.questionnaire?.designMotivation },
                      { q: 'Appearance Motivation', a: avatar.questionnaire?.appearanceMotivation },
                    ].map(item => (
                      <div key={item.q} className="p-5 bg-[var(--color-background-tertiary)]/50 rounded-[var(--radius-md)] border border-[var(--color-border-secondary)] group text-left">
                        <div className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.06em] mb-3">{item.q}</div>
                        <p className="text-[var(--text-base)] text-white font-bold leading-tight">
                          {item.a || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Daily Life & Roles */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Users size={16} className="text-blue-500" />
                    <span className="text-[var(--text-xs)] font-semibold uppercase text-[#86868B] tracking-[0.06em]">Identity & Lifestyle</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[
                      { q: 'Fond Memories', a: avatar.questionnaire?.fondPast },
                      { q: 'Fun & Entertainment', a: avatar.questionnaire?.fun },
                      { q: 'Risk Perception', a: avatar.questionnaire?.risk },
                      { q: 'Roles they are proud of', a: avatar.questionnaire?.proudRoles },
                      { q: 'Roles they aspire to', a: avatar.questionnaire?.aspiringRoles },
                      { q: 'The Average Day', a: avatar.questionnaire?.averageDay },
                    ].map(item => (
                      <div key={item.q} className="space-y-2 group text-left">
                        <div className="text-[var(--text-base)] font-semibold text-white uppercase tracking-tight">{item.q}</div>
                        <p className="text-[var(--text-base)] text-[#515154] leading-relaxed pl-4 font-medium italic border-l-2 border-[var(--color-border-secondary)] group-hover:border-[#0A84FF]/30 transition-colors">
                          {item.a || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
           </div>
           
           {/* Sub-Avatars / Granular Characteristics Section */}
           {avatar.canHaveSubAvatars && (
             <div className="bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] p-10 shadow-sm text-left">
               <div className="flex items-center justify-between mb-10">
                 <div>
                   <h4 className="text-[var(--text-sm)] font-semibold text-[#86868B] uppercase tracking-[0.2em] flex items-center gap-2">
                     <Layers size={18} className="text-[#0A84FF]" /> Granular Defining Characteristics
                   </h4>
                   <p className="text-[var(--text-xs)] text-[#86868B] font-bold mt-1 uppercase tracking-[0.06em]">Identifying Niche Segments within {avatar.name}</p>
                 </div>
                 {!allAvatars?.some(a => a.parentId === avatar.id) && onGenerateSubAvatars && (
                   <button 
                     onClick={() => onGenerateSubAvatars(avatar)}
                     className="px-4 py-2 bg-[#0A84FF] text-white text-[var(--text-xs)] font-semibold rounded-full uppercase tracking-[0.06em] hover:bg-[#0076F1] transition-all"
                   >
                     Drill Down
                   </button>
                 )}
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allAvatars?.filter(a => a.parentId === avatar.id).map(sub => (
                    <div 
                      key={sub.id}
                      className="p-6 bg-[var(--color-background-tertiary)]/30 rounded-[var(--radius-md)] border border-[var(--color-border-secondary)] hover:border-[#0A84FF]/20 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] overflow-hidden shrink-0">
                          <img 
                            src={sub.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sub.id}&backgroundColor=2C2C2E,3A3A3C,1D1D1F`} 
                            className="w-full h-full object-cover" 
                            alt=""
                          />
                        </div>
                        <h5 className="text-[var(--text-base)] font-semibold text-white">{sub.name}</h5>
                      </div>
                      <p className="text-[var(--text-sm)] text-[#515154] leading-relaxed mb-3 line-clamp-2">{sub.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-xs)] font-semibold text-[#0A84FF] uppercase tracking-[0.06em]">
                          {sub.definingCharacteristic}
                        </span>
                      </div>
                    </div>
                  ))}
                  {allAvatars?.filter(a => a.parentId === avatar.id).length === 0 && (
                    <div className="col-span-2 py-10 bg-[var(--color-background-tertiary)]/20 border-2 border-dashed border-[var(--color-border-secondary)] rounded-[var(--radius-md)] text-center">
                       <p className="text-[var(--text-sm)] text-[#86868B] font-bold uppercase tracking-[0.06em]">No granular segments generated yet</p>
                    </div>
                  )}
               </div>
             </div>
           )}
        </div>
      </div>
      )}

      {/* NEW: Enriched Deep Context (Requested by user) */}
      {!showOfferOnly && avatar.deepContext && (
        <div className="space-y-24">
          <div className="flex items-center gap-6">
            <div className="h-px bg-[#D2D2D7]/60 flex-1" />
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[#AF52DE]/10 flex items-center justify-center text-[#AF52DE]">
                    <Target size={20} strokeWidth={2.5} />
                </div>
                <h4 className="text-[var(--text-sm)] font-semibold text-white uppercase tracking-[0.5em] leading-none translate-y-0.5">Neural Empathy Map</h4>
              </div>
            </div>
            <div className="h-px bg-[#D2D2D7]/60 flex-1" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Path to Purchase */}
            <div className="space-y-8">
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#0A84FF]" />
                  <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.4em] text-white">Path to Purchase</span>
               </div>
               <div className="space-y-6">
                  {[
                    { label: 'Awareness', value: avatar.deepContext.pathToPurchase.awareness, desc: 'Problem realization trigger' },
                    { label: 'Consideration', value: avatar.deepContext.pathToPurchase.consideration, desc: 'Evaluated alternatives' },
                    { label: 'Decision', value: avatar.deepContext.pathToPurchase.decision, desc: 'Final push factors' },
                  ].map((item, idx) => (
                    <div key={idx} className="p-8 bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] shadow-sm relative group hover:border-[#0A84FF]/30 transition-all">
                       <span className="text-[var(--text-xs)] font-semibold text-[#86868B]/60 uppercase tracking-[0.3em] block mb-2">{item.label}</span>
                       <p className="text-[var(--text-base)] leading-relaxed text-white font-bold">{item.value}</p>
                       <p className="text-[var(--text-xs)] text-[#86868B] mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-medium italic">{item.desc}</p>
                    </div>
                  ))}
               </div>
            </div>

            {/* Beyond Demographics */}
            <div className="space-y-8">
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#AF52DE]" />
                  <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.4em] text-white">Decomposition of Values</span>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: 'Values & Beliefs', value: avatar.deepContext.beyondDemographics.valuesAndBeliefs },
                    { label: 'Pain Points', value: avatar.deepContext.beyondDemographics.painPoints, color: 'text-rose-500' },
                    { label: 'Goals & Aspirations', value: avatar.deepContext.beyondDemographics.goalsAndAspirations, color: 'text-emerald-500' },
                    { label: 'Fears & Objections', value: avatar.deepContext.beyondDemographics.fearsAndObjections, color: 'text-amber-500' },
                  ].map((item, idx) => (
                    <div key={idx} className="p-6 bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] shadow-sm hover:shadow-md transition-all">
                       <span className="text-[var(--text-xs)] font-semibold text-[#86868B]/60 uppercase tracking-[0.3em] block mb-2">{item.label}</span>
                       <p className={cn("text-[var(--text-base)] leading-snug font-bold", item.color || "text-white")}>{item.value}</p>
                    </div>
                  ))}
                  <div className="p-6 bg-[#AF52DE]/5 border border-[#AF52DE]/10 rounded-[var(--radius-md)]">
                     <span className="text-[var(--text-xs)] font-semibold text-[#AF52DE] uppercase tracking-[0.3em] block mb-2">Interests & Hobbies</span>
                     <p className="text-[var(--text-base)] leading-snug font-bold text-white">{avatar.deepContext.beyondDemographics.interestsAndHobbies}</p>
                  </div>
               </div>
            </div>

            {/* Behavioral Details */}
            <div className="space-y-8">
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF9500]" />
                  <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.4em] text-white">Targeting Vector</span>
               </div>
               <div className="space-y-6">
                  {[
                    { label: 'Online Hangouts', value: avatar.deepContext.behavioralDetails.onlineHangouts, icon: Globe },
                    { label: 'Content Consumption', value: avatar.deepContext.behavioralDetails.contentConsumption, icon: Package },
                    { label: 'Communication Choice', value: avatar.deepContext.behavioralDetails.communicationPreferences, icon: MessageCircle },
                    { label: 'Purchase Triggers', value: avatar.deepContext.behavioralDetails.purchaseTriggers, icon: Zap, highlight: true },
                  ].map((item, idx) => (
                    <div key={idx} className={cn(
                      "p-8 rounded-[var(--radius-md)] border shadow-sm flex items-start gap-4 transition-all duration-500",
                      item.highlight ? "bg-[#1D1D1F] text-white border-transparent shadow-xl" : "bg-[var(--color-card-bg)] border-[var(--color-border-secondary)] hover:border-[var(--color-border-secondary)]"
                    )}>
                       <item.icon size={18} className={cn("mt-1", item.highlight ? "text-[#FF9500]" : "text-[#86868B]")} />
                       <div>
                          <span className={cn("text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] block mb-2", item.highlight ? "text-white/40" : "text-[#86868B]/60")}>{item.label}</span>
                          <p className={cn("text-[var(--text-base)] leading-snug font-bold", item.highlight ? "text-[#FF9500]" : "text-white")}>{item.value}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary section */}
      {!showOfferOnly && avatar.synthesis && (
        <div className="space-y-10">
          <div className="flex items-center gap-4">
            <div className="h-px bg-[#D2D2D7]/30 flex-1" />
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <Brain size={20} className="text-[#0A84FF]" />
                <h4 className="text-[var(--text-base)] font-semibold text-[#86868B] uppercase tracking-[0.4em]">Summary</h4>
              </div>
              <span className="text-[var(--text-xs)] font-semibold text-[#0A84FF] uppercase tracking-[0.06em] text-center">Neural Agent Resolution Layer</span>
            </div>
            <div className="h-px bg-[#D2D2D7]/30 flex-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="p-10 bg-[var(--color-card-bg)] border-2 border-[var(--color-border-secondary)] rounded-[var(--radius-md)] space-y-8 text-left"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Target size={18} />
                  </div>
                  <h5 className="text-[var(--text-sm)] font-semibold text-white uppercase tracking-[0.06em]">Winning Core Logic</h5>
                </div>
                <div className="space-y-4">
                  <div className="p-6 bg-[var(--color-background-tertiary)] rounded-[var(--radius-md)] space-y-2">
                    <CitedClaimDisplay
                      field={avatar.synthesis.realPrimaryMotivation}
                      messages={clusterMessages}
                      label="Primary Motivation"
                    />
                  </div>
                  <div className="p-6 bg-[var(--color-background-tertiary)] rounded-[var(--radius-md)] space-y-2">
                    <CitedClaimDisplay
                      field={avatar.synthesis.winningApproach}
                      messages={clusterMessages}
                      label="Winning Approach"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-[var(--color-border-secondary)] space-y-6">
                 <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Sparkles size={18} />
                  </div>
                  <h5 className="text-[var(--text-sm)] font-semibold text-white uppercase tracking-[0.06em]">Unique Strategic Insight</h5>
                </div>
                <CitedClaimDisplay
                  field={avatar.synthesis.uniqueInsight}
                  messages={clusterMessages}
                  label="Unique Strategic Insight"
                />
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="p-10 bg-[#1D1D1F] rounded-[var(--radius-md)] space-y-8 text-white text-left"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-white/10 text-white flex items-center justify-center">
                    <ShieldCheck size={18} />
                  </div>
                  <h5 className="text-[var(--text-sm)] font-semibold text-white/50 uppercase tracking-[0.06em]">Resolved Tensions</h5>
                </div>
                <div className="space-y-4">
                  {avatar.synthesis.conflictsResolved.map((item, i) => (
                    <div key={i} className="p-6 bg-white/5 rounded-[var(--radius-md)] border border-white/10 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                        <span className="text-[var(--text-xs)] font-semibold text-rose-400 uppercase tracking-[0.06em]">Conflict</span>
                      </div>
                      <p className="text-[var(--text-sm)] text-white/70 font-medium italic">"{item.conflict}"</p>
                      <div className="flex items-center gap-2 pt-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span className="text-[var(--text-xs)] font-semibold text-emerald-400 uppercase tracking-[0.06em]">Resolution</span>
                      </div>
                      <p className="text-[var(--text-base)] text-white font-bold leading-relaxed">{item.resolution}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 flex items-center justify-between">
                <div>
                   <span className="text-[var(--text-xs)] font-semibold text-white/40 uppercase tracking-[0.06em] block mb-1">Synthesis Confidence</span>
                   <div className="flex items-center gap-2">
                      <div className="text-[var(--text-xl)] font-semibold text-emerald-400">{avatar.synthesis.confidenceScore}%</div>
                      <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: `${avatar.synthesis.confidenceScore}%` }}
                          className="h-full bg-emerald-400"
                        />
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* NEW: Actionable Execution Plan */}
      {!showOfferOnly && avatar.executionPlan && avatar.executionPlan.length > 0 && (
        <div className="space-y-10">
          <div className="flex items-center gap-4">
            <div className="h-px bg-[#D2D2D7]/30 flex-1" />
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <Brain size={20} className="text-[#0A84FF]" />
                <h4 className="text-[var(--text-base)] font-semibold text-[#86868B] uppercase tracking-[0.4em]">Actionable Strategy Plan</h4>
              </div>
              <span className="text-[var(--text-xs)] font-semibold text-[#0A84FF] uppercase tracking-[0.06em] text-center">Step-by-Step Implementation for this Segment</span>
            </div>
            <div className="h-px bg-[#D2D2D7]/30 flex-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {avatar.executionPlan.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="group p-8 bg-[var(--color-card-bg)] border-2 border-[var(--color-border-secondary)] rounded-[var(--radius-md)] hover:border-[#0A84FF]/30 hover:shadow-2xl transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 bg-[var(--color-background-tertiary)] rounded-bl-[32px] border-l border-b border-[var(--color-border-secondary)] text-[var(--text-xl)] font-semibold text-[#D2D2D7] group-hover:text-[#0A84FF]/20 transition-colors">
                  {(i + 1).toString().padStart(2, '0')}
                </div>
                
                  <div className="space-y-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] px-3 py-1 rounded-full",
                      item.priority === 'High' ? "bg-rose-50 text-rose-600 border border-rose-100" :
                      item.priority === 'Medium' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                      "bg-blue-50 text-blue-600 border border-blue-100"
                    )}>
                      {item.priority} Priority
                    </span>
                    <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">{item.difficulty}</span>
                  </div>

                  <div className="space-y-3 pt-4">
                    <h5 className="text-[var(--text-lg)] font-semibold tracking-tight leading-tight group-hover:text-[#0A84FF] transition-colors">{item.title}</h5>
                    <p className="text-[var(--text-base)] text-[#86868B] font-bold uppercase tracking-tighter">{item.type}</p>
                  </div>

                  <p className="text-[var(--text-base)] text-[#515154] leading-relaxed font-medium pb-4 border-b border-[var(--color-border-secondary)]">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                       <Zap size={14} className="text-[#0A84FF]" />
                       <span className="text-[var(--text-xs)] font-semibold text-white uppercase tracking-[0.06em]">Time: {item.timeEstimate}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* NEW: Intelligence Critique (Self-Evaluation) */}
      {!showOfferOnly && avatar.critique && (
        <div className="p-10 bg-amber-50/30 border-2 border-amber-100 rounded-[var(--radius-md)] relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-amber-200/20 blur-[80px] -mr-32 -mt-32" />
           <div className="flex gap-8 items-start relative z-10">
              <div className="w-16 h-16 bg-[var(--color-card-bg)] rounded-[var(--radius-md)] border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 shadow-lg">
                 <ShieldCheck size={32} />
              </div>
              <div className="space-y-4 text-left">
                 <div className="flex items-center gap-3">
                    <h4 className="text-[var(--text-sm)] font-semibold text-amber-700 uppercase tracking-[0.4em]">Strategy Self-Evaluation Layer</h4>
                    <div className="h-px bg-amber-200 flex-1" />
                 </div>
                 <p className="text-[var(--text-lg)] text-amber-900 leading-relaxed font-bold italic">
                    "{avatar.critique}"
                 </p>
                 <div className="flex items-center gap-2 text-amber-600 font-bold text-[var(--text-xs)] uppercase tracking-[0.06em]">
                    <Check size={14} /> Second-Pass Correctness Check Passed
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Neural Pipeline Stats (New) */}
      {!showOfferOnly && avatar.pipelineMetadata && (
        <>
          {avatar.pipelineMetadata.scoreGateDecision === 'insufficient_evidence' && (
            <div className="rounded-[var(--radius-sm)] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-[var(--text-sm)] text-amber-700 dark:text-amber-300">
              ⚠️ This avatar was built with insufficient evidence. Add more relevant customer quotes to improve accuracy.
            </div>
          )}
          <div className="flex flex-wrap gap-4 pt-10 border-t border-[var(--color-border-secondary)]">
           <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-background-tertiary)] rounded-[var(--radius-md)] border border-[var(--color-border-secondary)]">
              <Activity size={14} className="text-[#0A84FF]" />
              <span className="text-[var(--text-xs)] font-semibold text-white uppercase tracking-[0.06em]">
                Calls: {avatar.pipelineMetadata.totalCalls}
              </span>
           </div>
           <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-background-tertiary)] rounded-[var(--radius-md)] border border-[var(--color-border-secondary)]">
              <RotateCcw size={14} className={cn(avatar.pipelineMetadata.retriesUsed > 0 ? "text-amber-500" : "text-[#86868B]")} />
              <span className="text-[var(--text-xs)] font-semibold text-white uppercase tracking-[0.06em]">
                Retries: {avatar.pipelineMetadata.retriesUsed}
              </span>
           </div>
           <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-background-tertiary)] rounded-[var(--radius-md)] border border-[var(--color-border-secondary)]">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span className="text-[var(--text-xs)] font-semibold text-white uppercase tracking-[0.06em]">
                Attacks Resolved: {avatar.pipelineMetadata.adversarialAttacksResolved}
              </span>
           </div>
           <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-background-tertiary)] rounded-[var(--radius-md)] border border-[var(--color-border-secondary)]">
              <Sparkles size={14} className="text-[#0A84FF]" />
              <span className="text-[var(--text-xs)] font-semibold text-white uppercase tracking-[0.06em]">
                Synthesis Confidence: {avatar.pipelineMetadata.synthesisConfidence}%
              </span>
           </div>
        </div>
        </>
      )}

      {showProvenance && !showOfferOnly && (
        <ProvenancePanel items={provenanceItems} />
      )}

      {/* Handling Objections */}
      {!showOfferOnly && (
      <div className="bg-[var(--color-background-tertiary)] rounded-[var(--radius-md)] p-12 flex flex-col md:flex-row gap-12 items-center border border-[var(--color-border-secondary)] shadow-sm">
         <div className="w-20 h-20 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] flex items-center justify-center text-[#FF3B30] shrink-0 shadow-xl border border-[var(--color-border-secondary)] rotate-3">
            <Info size={40} />
         </div>
         <div className="flex-1 space-y-6">
            <h4 className="text-[var(--text-xl)] font-semibold tracking-tight text-left text-white">Handling Fatal Objections</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
               <div className="space-y-2">
                  <div className="text-[var(--text-xs)] font-semibold text-[#86868B] uppercase tracking-[0.2em] mb-2">The Psychological Friction</div>
                  <p className="text-[var(--text-lg)] font-bold leading-tight text-white">{avatar.hesitations?.judgments}</p>
                  <p className="text-[var(--text-base)] text-[#86868B] font-medium leading-relaxed">{avatar.hesitations?.reasoning}</p>
               </div>
               <div className="p-8 bg-[var(--color-card-bg)] rounded-[var(--radius-md)] border-2 border-[var(--color-border-secondary)] shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px]" />
                  <div className="text-[var(--text-xs)] font-semibold text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 text-left relative z-10">
                     <Check size={18} className="bg-emerald-500 text-white rounded-full p-0.5" /> High-Con Strategy
                  </div>
                  <p className="text-[var(--text-base)] font-semibold leading-relaxed text-white relative z-10">{avatar.hesitations?.addressing}</p>
               </div>
            </div>
         </div>
      </div>
      )}

      {showMessageMining && (
        <MessageMiningWorkspace
          isOpen={showMessageMining}
          onClose={() => setShowMessageMining(false)}
          avatar={avatar}
          company={company}
          offer={offer}
          allAvatars={allAvatars || []}
          onAvatarCreated={newAvatar => {
            onUpdateAvatar?.(newAvatar);
          }}
          onAvatarImproved={(avatarId, patch) => {
            if (avatarId === avatar.id) {
              const updated = { ...avatar, ...patch };
              onUpdateAvatar?.(updated);
            } else {
              const existing = allAvatars?.find(a => a.id === avatarId);
              if (existing) onUpdateAvatar?.({ ...existing, ...patch });
            }
          }}
          onRequestOfferRegeneration={handleOfferRegenerationForAvatars}
        />
      )}

      {/* ── Task 8: Primary Element of Value Surface ─────────────────────────── */}
      {!showOfferOnly && (
        <ValueElementPanel
          avatar={avatar}
          clusterMessages={clusterMessages}
          offerRecord={avatarOffer ?? undefined}
          onAssign={(pve) => onUpdateAvatar?.({ ...avatar, primaryValueElement: pve })}
        />
      )}

      {/* ── Task 2: Decision Engine Panel ─────────────────────────────────────── */}
      {!showOfferOnly && avatar.synthesis && (
        <DecisionEnginePanel avatar={avatar} />
      )}

      {/* ── Task 6: Devil's Advocate Panel ────────────────────────────────────── */}
      {!showOfferOnly && (avatar.adversarialProbe ?? []).length > 0 && (
        <DevilsAdvocatePanel avatar={avatar} />
      )}

      <StabilityTestPanel avatar={avatar} clusterMessages={clusterMessages} />
      <GapAnalysisPanel avatar={avatar} clusterMessages={clusterMessages} corpus={corpus} />
    </div>
  );
};
