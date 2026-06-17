import React from 'react';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Loader2, Sparkles,
  Users, BarChart2, ArrowUpRight, ArrowDownRight, Quote,
  ChevronDown, ChevronRight, Lightbulb, ArrowRight, ArrowLeftRight, CheckSquare, Square,
  MoreHorizontal, Plus, Eye, MessageSquare, Layers
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCorpusStore } from '../../features/corpus/store';
import { evolveAvatars } from '../../services/avatarEvolutionService';
import { detectOpportunities } from '../../services/opportunityDetectionService';
import { runPipelineIntent } from '../../services/pipelineOrchestrator';
import { computeAvatarReadinessScore } from '../../constants/pipelineThresholds';
import { AvatarComparisonView } from './AvatarComparisonView';
import type { Avatar, AvatarLifecycleStatus } from '../../types';
import type { PrimaryValueElement } from '../../types/valueElements';
import { VALUE_ELEMENT_LABELS } from '../../types/valueElements';
import type { Company, Offer } from '../../types';

/** Contextual action attached to a Customer Profile card (Addendum A §2.3). */
export interface CardAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

/** Minimal CardActionsMenu for Avatar cards. */
const AvatarCardActionsMenu: React.FC<{ actions: CardAction[] }> = ({ actions }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-background-tertiary)] hover:bg-[var(--color-slate-elevated)] flex items-center justify-center transition-colors absolute top-3 right-3 z-10"
        aria-label="More actions">
        <MoreHorizontal size={14} strokeWidth={2.5} className="text-[var(--color-text-secondary)]" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 bg-[var(--color-card-bg)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden min-w-[190px]">
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button key={action.label} type="button"
                onClick={e => { e.stopPropagation(); setOpen(false); action.onClick(); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[var(--text-sm)] font-medium transition-colors text-left ${action.destructive ? 'text-rose-500 hover:bg-rose-500/10' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)]'}`}>
                <Icon size={14} strokeWidth={2} />
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface AvatarDashboardProps {
  company: Company;
  offer: Offer;
  avatars: Avatar[];
  onAvatarsEvolved?: (evolved: Avatar[]) => void;
  onSelectAvatar?: (avatar: Avatar) => void;
  /** Contextual: add evidence related to this profile */
  onAddEvidenceToProfile?: (avatarId: string) => void;
  /** Contextual: navigate to buying triggers for this profile */
  onViewBuyingTriggers?: (avatarId: string) => void;
  /** Contextual: see patterns this profile is built from */
  onViewSourcePatterns?: (avatarId: string) => void;
}

type LifecycleFilter = AvatarLifecycleStatus | 'all';

const LIFECYCLE_CONFIG: Record<AvatarLifecycleStatus, {
  label: string;
  badgeClass: string;
  tabClass: string;
  icon: React.ReactNode;
}> = {
  emerging: {
    label: 'Emerging',
    badgeClass: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
    tabClass: 'text-yellow-600 dark:text-yellow-400 border-yellow-400',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  active: {
    label: 'Active',
    badgeClass: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    tabClass: 'text-green-600 dark:text-green-400 border-green-400',
    icon: <BarChart2 className="w-3.5 h-3.5" />,
  },
  declining: {
    label: 'Declining',
    badgeClass: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    tabClass: 'text-red-500 dark:text-red-400 border-red-400',
    icon: <TrendingDown className="w-3.5 h-3.5" />,
  },
  obsolete: {
    label: 'Obsolete',
    badgeClass: 'bg-[var(--color-background-tertiary)] dark:bg-gray-700 text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)]',
    tabClass: 'text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] border-gray-400',
    icon: <Minus className="w-3.5 h-3.5" />,
  },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? 'bg-green-500 dark:bg-green-400' :
    pct >= 40 ? 'bg-yellow-500 dark:bg-yellow-400' :
    'bg-red-400 dark:bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] tabular-nums w-8 text-right">
        {(value).toFixed(2)}
      </span>
    </div>
  );
}

function AvatarCard({
  avatar,
  onClick,
  size = 'medium',
}: {
  avatar: Avatar;
  onClick: () => void;
  /** Visual hierarchy: hero (primary), medium (secondary), compact (low-priority list row) */
  size?: 'hero' | 'medium' | 'compact';
}) {
  const status = avatar.lifecycleStatus ?? 'emerging';
  const config = LIFECYCLE_CONFIG[status];
  const snap = avatar.evidenceSnapshot;
  const prevSnap = avatar.previousSnapshot;

  const msgDelta = snap && prevSnap ? snap.messageCount - prevSnap.messageCount : null;

  if (size === 'compact') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full text-left px-4 py-3 rounded-[var(--radius-sm)] border transition-all hover:shadow-sm flex items-center justify-between gap-3',
          'bg-[var(--color-card-bg)] dark:bg-gray-900 border-[var(--color-border-default)] dark:border-gray-700',
          'hover:border-violet-300 dark:hover:border-violet-600'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn('text-[var(--text-xs)] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0', config.badgeClass)}>
            {config.icon}
          </span>
          <p className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)] dark:text-gray-100 truncate">
            {avatar.name}
          </p>
        </div>
        {snap && (
          <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] shrink-0">
            {Math.round((snap.confidenceScore ?? 0) * 100)}%
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-[var(--radius-sm)] border transition-all hover:shadow-md',
        'bg-[var(--color-card-bg)] dark:bg-gray-900 border-[var(--color-border-default)] dark:border-gray-700',
        'hover:border-violet-300 dark:hover:border-violet-600',
        size === 'hero' ? 'p-6' : 'p-4'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className={cn('font-semibold text-[var(--color-text-primary)] dark:text-gray-100 leading-tight', size === 'hero' ? 'text-base' : 'text-sm')}>
            {avatar.name}
          </p>
          {size === 'hero' && avatar.definingCharacteristic && (
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-1">{avatar.definingCharacteristic}</p>
          )}
        </div>
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0', config.badgeClass)}>
          {config.icon}
          {config.label}
        </span>
      </div>

      {/* ✅ Phase 11: Evidence strength indicator */}
      {(avatar as any).evidenceSnapshot && (
        <div className="flex items-center gap-2 mt-2 mb-2">
          <div className="flex-1 h-1 bg-[var(--color-border-default)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent-blue)] rounded-full transition-all duration-700"
              style={{ width: `${Math.round(((avatar as any).evidenceSnapshot.confidenceScore ?? 0) * 100)}%` }}
            />
          </div>
          <span className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.06em] whitespace-nowrap">
            {Math.round(((avatar as any).evidenceSnapshot.confidenceScore ?? 0) * 100)}% Evidence
          </span>
        </div>
      )}

      {/* Emotional profile badge */}
      {(avatar as any).emotionalProfile?.primary && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-card-elevated)] border border-[var(--color-border-default)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)] mb-2">
          <span>{
            (({ happy: '🟢', angry: '🔴', scared: '🟡', sad: '🔵' } as Record<string, string>)[(avatar as any).emotionalProfile.primary]) ?? '⚪'
          }</span>
          <span>{(avatar as any).emotionalProfile.primary}</span>
        </div>
      )}

      {/* Stats */}
      {snap && (
        <div className="space-y-2.5">
          {/* Message count + delta */}
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-tertiary)]">
            <Users className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
            <span>{snap.messageCount} messages</span>
            {msgDelta !== null && msgDelta !== 0 && (
              <span className={cn(
                'flex items-center gap-0.5 font-medium',
                msgDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
              )}>
                {msgDelta > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {msgDelta > 0 ? '+' : ''}{msgDelta} this update
              </span>
            )}
          </div>

          {/* Confidence bar */}
          <div>
            <p className="text-xs text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] mb-1">Confidence</p>
            <ConfidenceBar value={snap.confidenceScore} />
          </div>

          {/* Top quote */}
          {snap.representativeQuotes[0] && (
            <div className="flex gap-1.5 text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-tertiary)] bg-[var(--color-background-tertiary)] dark:bg-gray-800 rounded-[var(--radius-sm)] p-2">
              <Quote className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
              <p className="line-clamp-2 italic">"{snap.representativeQuotes[0]}"</p>
            </div>
          )}
        </div>
      )}

      {!snap && (
        <p className="text-xs text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] italic">No evidence snapshot yet</p>
      )}
    </button>
  );
}

export function AvatarDashboard({
  company,
  offer,
  avatars,
  onAvatarsEvolved,
  onSelectAvatar,
  onAddEvidenceToProfile,
  onViewBuyingTriggers,
  onViewSourcePatterns,
}: AvatarDashboardProps) {
  const [filter, setFilter] = React.useState<LifecycleFilter>('all');
  const [valueElementFilter, setValueElementFilter] = React.useState<string>('all');
  const [showValueDistribution, setShowValueDistribution] = React.useState(false);
  const [isEvolving, setIsEvolving] = React.useState(false);
  const [isRenderingCopy, setIsRenderingCopy] = React.useState(false);
  const [renderCopyError, setRenderCopyError] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = React.useState(false);
  const [showUntapped, setShowUntapped] = React.useState(false);
  const [generatingClusterId, setGeneratingClusterId] = React.useState<string | null>(null);

  // Access corpora[id] directly (stable reference) rather than getCorpus() which creates
  // a new empty corpus object on every render when the corpus doesn't exist yet.
  const corpus = useCorpusStore(s => s.corpora[company.id]);

  const handleRunEvolution = async () => {
    setIsEvolving(true);
    try {
      const evolved = evolveAvatars(avatars, corpus.clusters, corpus.messages, corpus.version);
      onAvatarsEvolved?.(evolved);
    } finally {
      setIsEvolving(false);
    }
  };

  const handleRenderCopy = async () => {
    setIsRenderingCopy(true);
    setRenderCopyError(null);
    try {
      const result = await runPipelineIntent(company, 'render_copy', { existingAvatars: avatars });
      if (!result.success && result.error) setRenderCopyError(result.error);
    } catch (e) {
      setRenderCopyError(e instanceof Error ? e.message : 'Render copy failed');
    } finally {
      setIsRenderingCopy(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < 2) next.add(id);
      return next;
    });
  };

  const selectedAvatars = avatars.filter(a => selectedIds.has(a.id));

  const opportunities = React.useMemo(
    () => detectOpportunities(corpus.clusters ?? [], avatars, corpus.messages ?? []),
    [corpus.clusters, corpus.messages, avatars]
  );

  const handleGenerateFromCluster = async (clusterId: string) => {
    const cluster = corpus.clusters.find(c => c.id === clusterId);
    if (!cluster) return;
    setGeneratingClusterId(clusterId);
    try {
      await runPipelineIntent(company, 'materialize_avatars', {
        clusterIds: [cluster.id],
        existingAvatars: avatars,
        callbacks: {
          onAvatarCreated: (av: Avatar) => {
            onAvatarsEvolved?.(
              avatars.some(a => a.id === av.id)
                ? avatars.map(a => a.id === av.id ? av : a)
                : [...avatars, av]
            );
          },
        },
      });
    } catch (err) {
      console.error('[AvatarDashboard] regeneration failed:', err);
    } finally {
      setGeneratingClusterId(null);
    }
  };

  const allStatuses: AvatarLifecycleStatus[] = ['emerging', 'active', 'declining', 'obsolete'];

  const valueElementGroups = React.useMemo(() => {
    const groups: Record<string, { label: string; count: number; avatarNames: string[] }> = {};
    for (const av of avatars) {
      const pve = (av as any).primaryValueElement;
      if (pve?.element) {
        const key = pve.element;
        if (!groups[key]) groups[key] = { label: VALUE_ELEMENT_LABELS[key as keyof typeof VALUE_ELEMENT_LABELS] ?? key, count: 0, avatarNames: [] };
        groups[key].count++;
        groups[key].avatarNames.push(av.name);
      }
    }
    return Object.entries(groups).sort(([, a], [, b]) => b.count - a.count);
  }, [avatars]);

  const countByStatus = React.useMemo(() => {
    const counts: Partial<Record<AvatarLifecycleStatus, number>> = {};
    for (const av of avatars) {
      const s = av.lifecycleStatus ?? 'emerging';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [avatars]);

  const filtered = avatars
    .filter(av => filter === 'all' || (av.lifecycleStatus ?? 'emerging') === filter)
    .filter(av => valueElementFilter === 'all' || (av as any).primaryValueElement?.element === valueElementFilter);

  const lastUpdated = React.useMemo(() => {
    const snaps = avatars.flatMap(av => av.evidenceSnapshot ? [av.evidenceSnapshot.recordedAt] : []);
    if (!snaps.length) return null;
    return snaps.sort().reverse()[0];
  }, [avatars]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] dark:text-gray-100">
            Customer Intelligence
          </h2>
          {lastUpdated && (
            <p className="text-xs text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] mt-0.5">
              Last updated {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={handleRenderCopy}
          disabled={isRenderingCopy || !avatars.length}
          className={cn(
            'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[var(--radius-sm)] font-medium transition-colors',
            'bg-indigo-600 hover:bg-indigo-700 text-white',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {isRenderingCopy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          Render Copy
        </button>
        <button
          onClick={handleRunEvolution}
          disabled={isEvolving || !avatars.length}
          className={cn(
            'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[var(--radius-sm)] font-medium transition-colors',
            'bg-violet-600 hover:bg-violet-700 text-white',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {isEvolving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Run Evolution
        </button>
      </div>

      {renderCopyError && (
        <div className="flex items-center gap-2 p-3 rounded-[var(--radius-sm)] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <span>⚠️</span>
          <span>{renderCopyError}</span>
          <button onClick={() => setRenderCopyError(null)} className="ml-auto text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border-default)] dark:border-gray-700">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'text-sm px-3 py-1.5 font-medium border-b-2 transition-colors -mb-px',
            filter === 'all'
              ? 'border-violet-500 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300'
          )}
        >
          All ({avatars.length})
        </button>
        {allStatuses.map(s => {
          const count = countByStatus[s] ?? 0;
          if (!count && filter !== s) return null;
          const cfg = LIFECYCLE_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'text-sm px-3 py-1.5 font-medium border-b-2 transition-colors -mb-px flex items-center gap-1',
                filter === s
                  ? cn('border-current', cfg.tabClass)
                  : 'border-transparent text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] dark:hover:text-gray-300'
              )}
            >
              {cfg.icon}
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Value Element second-dimension filter (Task 10) */}
      {valueElementGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setShowValueDistribution(v => !v)}
              className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1"
            >
              <Layers className="w-3 h-3" /> Value Elements {showValueDistribution ? '▲' : '▼'}
            </button>
          </div>
          {showValueDistribution && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setValueElementFilter('all')}
                className={cn(
                  'text-[var(--text-xs)] font-semibold px-2.5 py-1 rounded-full border transition-colors',
                  valueElementFilter === 'all'
                    ? 'bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] border-transparent'
                    : 'border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-secondary)]'
                )}
              >
                All ({avatars.length})
              </button>
              {valueElementGroups.map(([key, { label, count }]) => (
                <button
                  key={key}
                  onClick={() => setValueElementFilter(valueElementFilter === key ? 'all' : key)}
                  className={cn(
                    'text-[var(--text-xs)] font-semibold px-2.5 py-1 rounded-full border transition-colors',
                    valueElementFilter === key
                      ? 'bg-[#0A84FF] text-white border-transparent'
                      : 'border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[#0A84FF]/40'
                  )}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cards grid — visual hierarchy by priority (Phase 15) */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)]">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No avatars in this category yet.</p>
        </div>
      ) : (() => {
        const primary = filtered.filter(a => a.uiMetadata?.priorityLabel === 'primary');
        const secondary = filtered.filter(a => a.uiMetadata?.priorityLabel === 'secondary');
        const lowPriority = filtered.filter(a => {
          const label = a.uiMetadata?.priorityLabel;
          return label === 'low-priority' || !label;
        });

        const renderCard = (avatar: Avatar, size: 'hero' | 'medium' | 'compact') => {
          const profileActions: CardAction[] = [
            ...(onAddEvidenceToProfile ? [{ label: 'Add related evidence', icon: Plus as LucideIcon, onClick: () => onAddEvidenceToProfile(avatar.id) }] : []),
            ...(onViewBuyingTriggers ? [{ label: 'View buying triggers', icon: Layers as LucideIcon, onClick: () => onViewBuyingTriggers(avatar.id) }] : []),
            { label: 'View full profile', icon: Eye as LucideIcon, onClick: () => onSelectAvatar?.(avatar) },
            ...(onViewSourcePatterns ? [{ label: 'See source patterns', icon: MessageSquare as LucideIcon, onClick: () => onViewSourcePatterns(avatar.id) }] : []),
          ];
          return (
            <div key={avatar.id} className="relative group">
              <button
                onClick={() => toggleSelect(avatar.id)}
                className="absolute top-2 left-2 z-10 p-1 rounded-[var(--radius-sm)] bg-white/80 dark:bg-black/40 hover:bg-[var(--color-card-bg)] dark:hover:bg-black/60 transition-colors"
              >
                {selectedIds.has(avatar.id)
                  ? <CheckSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  : <Square className="w-4 h-4 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                }
              </button>
              {profileActions.length > 0 && <AvatarCardActionsMenu actions={profileActions} />}
              <AvatarCard avatar={avatar} onClick={() => onSelectAvatar?.(avatar)} size={size} />
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {primary.length > 0 && (
              <div>
                <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] mb-2">
                  Primary profiles
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {primary.map(a => renderCard(a, 'hero'))}
                </div>
              </div>
            )}
            {secondary.length > 0 && (
              <div>
                <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] mb-2">
                  Secondary profiles
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {secondary.map(a => renderCard(a, 'medium'))}
                </div>
              </div>
            )}
            {lowPriority.length > 0 && (
              <div>
                <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] mb-2">
                  Other profiles
                </p>
                <div className="space-y-2">
                  {lowPriority.map(a => renderCard(a, primary.length === 0 && secondary.length === 0 ? 'medium' : 'compact'))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Compare button when 2 selected */}
      {selectedIds.size === 2 && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowComparison(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-sm)] bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-[#1D1D1F] text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] hover:opacity-90 transition-opacity"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Compare Selected Avatars
          </button>
        </div>
      )}

      {/* Untapped Segments */}
      {opportunities.length > 0 && (
        <div className="border border-[var(--color-border-default)] dark:border-white/10 rounded-[var(--radius-md)] overflow-hidden">
          <button
            onClick={() => setShowUntapped(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-[var(--color-card-bg)] dark:bg-white/5 hover:bg-[#E8E8ED] dark:hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span className="text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-[#1D1D1F] dark:text-white">
                Untapped Segments ({opportunities.length} cluster{opportunities.length !== 1 ? 's' : ''} with no avatar)
              </span>
            </div>
            {showUntapped ? <ChevronDown className="w-4 h-4 text-[#86868B]" /> : <ChevronRight className="w-4 h-4 text-[#86868B]" />}
          </button>

          {showUntapped && (
            <div className="p-4 space-y-3">
              {opportunities.map(opp => (
                <div key={opp.cluster.id} className="p-4 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] dark:border-white/10 bg-[var(--color-card-bg)] dark:bg-white/3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-white">{opp.cluster.label}</p>
                    {(() => {
                      const readiness = computeAvatarReadinessScore(
                        opp.messageCount,
                        opp.cohesionScore,
                        opp.dominantAspects.length > 0 ? Math.min(3, opp.dominantAspects.length) : 0,
                        1
                      );
                      return (
                        <div className="mt-1 space-y-1">
                          <p className="text-[var(--text-xs)] text-[#86868B]">
                            {opp.messageCount} evidence pieces · {readiness.ready ? (
                              <span className="text-emerald-500 font-semibold">Ready to generate</span>
                            ) : (
                              <span className="text-amber-500 font-semibold">Needs more evidence</span>
                            )}
                          </p>
                          {!readiness.ready && readiness.gaps[0] && (
                            <p className="text-[var(--text-xs)] text-amber-400 italic">{readiness.gaps[0]}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-[var(--color-border-default)] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${readiness.score >= 60 ? 'bg-emerald-500' : readiness.score >= 35 ? 'bg-amber-500' : 'bg-red-400'}`}
                                style={{ width: `${readiness.score}%` }}
                              />
                            </div>
                            <span className="text-[var(--text-xs)] text-[#86868B] shrink-0">{readiness.score}/100</span>
                          </div>
                        </div>
                      );
                    })()}
                    {opp.topQuotes[0] && (
                      <p className="text-xs text-[#86868B] mt-1 italic truncate">
                        &ldquo;{opp.topQuotes[0]}&rdquo;
                      </p>
                    )}
                  </div>
                  <button
                    disabled={generatingClusterId === opp.cluster.id}
                    onClick={() => handleGenerateFromCluster(opp.cluster.id)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[#1D1D1F] dark:border-white text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#1D1D1F] dark:text-white hover:bg-[#1D1D1F] dark:hover:bg-[var(--color-card-bg)] hover:text-white dark:hover:text-[#1D1D1F] transition-all disabled:opacity-50"
                  >
                    {generatingClusterId === opp.cluster.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3 h-3" />
                    )}
                    Generate Profile
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comparison modal */}
      {showComparison && selectedAvatars.length === 2 && (() => {
        const [avA, avB] = selectedAvatars;
        const clA = corpus.clusters?.find(c => c.id === avA.clusterId);
        const clB = corpus.clusters?.find(c => c.id === avB.clusterId);
        return (
          <AvatarComparisonView
            avatarA={avA}
            avatarB={avB}
            clusterA={clA}
            clusterB={clB}
            messages={corpus.messages ?? []}
            onClose={() => setShowComparison(false)}
          />
        );
      })()}
    </div>
  );
}
