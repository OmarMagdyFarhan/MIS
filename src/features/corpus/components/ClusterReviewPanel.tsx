import React from 'react';
import { motion } from 'motion/react';
import {
  GitMerge, Split, Check, ChevronDown, ChevronRight, Scissors,
  Plus, User, Eye, MoreHorizontal, Trash2
} from 'lucide-react';
import type { Cluster, EvidenceMessage } from '../../../types/pipeline';
import { cn } from '../../../lib/utils';
import { MIN_MESSAGES_FOR_VALIDATION } from '../services/clusteringService';
import { analyzeClusterIntegrity } from '../../../services/clusterIntegrityService';
import type { LucideIcon } from 'lucide-react';

// ─── Contextual Actions (Addendum A §2.3) ────────────────────────────────────

/** A contextual action attached to a card (Addendum A §2.3 implementation rule). */
export interface CardAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

interface CardActionsMenuProps {
  actions: CardAction[];
}

const CardActionsMenu: React.FC<CardActionsMenuProps> = ({ actions }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-background-tertiary)] hover:bg-[var(--color-slate-elevated)] flex items-center justify-center transition-colors"
        aria-label="More actions"
      >
        <MoreHorizontal size={14} strokeWidth={2.5} className="text-[var(--color-text-secondary)]" />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute right-0 top-9 z-50 bg-[var(--color-card-bg)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden min-w-[180px]"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  action.onClick();
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-2.5 text-[var(--text-sm)] font-medium transition-colors text-left',
                  action.destructive
                    ? 'text-rose-500 hover:bg-rose-500/10'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)]'
                )}
              >
                <Icon size={14} strokeWidth={2} />
                {action.label}
              </button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  clusters: Cluster[];
  messages: EvidenceMessage[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onValidate: (clusterId: string) => void;
  onMerge: (sourceIds: string[]) => void;
  onSplit?: (clusterId: string) => void;
  onExpandMessages: (clusterId: string) => void;
  expandedClusterId: string | null;
  /** Contextual: add evidence to a specific pattern */
  onAddEvidenceToCluster?: (clusterId: string) => void;
  /** Contextual: generate a Customer Profile from this pattern */
  onGenerateProfileFromCluster?: (clusterId: string) => void;
  /** Contextual: see all evidence in a pattern */
  onViewAllEvidence?: (clusterId: string) => void;
  /** Contextual: remove / archive a pattern */
  onRemoveCluster?: (clusterId: string) => void;
}

export const ClusterReviewPanel: React.FC<Props> = ({
  clusters,
  messages,
  selectedIds,
  onToggleSelect,
  onValidate,
  onMerge,
  onSplit,
  onExpandMessages,
  expandedClusterId,
  onAddEvidenceToCluster,
  onGenerateProfileFromCluster,
  onViewAllEvidence,
  onRemoveCluster,
}) => {
  const active = clusters.filter(c => c.status !== 'merged');

  if (!active.length) {
    return (
      <div className="text-center py-10 text-[#86868B] text-[var(--text-base)]">
        {/* Addendum A Rule 2: empty states guide, not apologise */}
        Add 5 or more pieces of customer feedback to discover your first pattern.
        The system needs enough evidence to find a real signal — not just one person's opinion.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedIds.length >= 2 && (
        <button
          type="button"
          onClick={() => onMerge(selectedIds)}
          className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em]"
        >
          <GitMerge size={14} /> Merge selected ({selectedIds.length})
        </button>
      )}

      {active.map(cluster => {
        const expanded = expandedClusterId === cluster.id;
        const count = cluster.messageIds.length;
        const canValidate = count >= MIN_MESSAGES_FOR_VALIDATION;
        const integrityReport = analyzeClusterIntegrity(cluster, messages);

        // ── Contextual actions for this Pattern card (Addendum A §2.3) ──────
        const cardActions: CardAction[] = [
          ...(onAddEvidenceToCluster ? [{
            label: 'Add more evidence',
            icon: Plus as LucideIcon,
            onClick: () => onAddEvidenceToCluster(cluster.id),
          }] : []),
          ...(onSplit ? [{
            label: 'Split into two patterns',
            icon: Split as LucideIcon,
            onClick: () => onSplit(cluster.id),
          }] : []),
          ...(selectedIds.length >= 2 && selectedIds.includes(cluster.id) ? [{
            label: 'Merge with selected',
            icon: GitMerge as LucideIcon,
            onClick: () => onMerge(selectedIds),
          }] : []),
          ...(onGenerateProfileFromCluster && canValidate ? [{
            label: 'Generate Customer Profile',
            icon: User as LucideIcon,
            onClick: () => onGenerateProfileFromCluster(cluster.id),
          }] : []),
          ...(onViewAllEvidence ? [{
            label: 'See all evidence',
            icon: Eye as LucideIcon,
            onClick: () => onViewAllEvidence(cluster.id),
          }] : []),
          ...(onRemoveCluster ? [{
            label: 'Remove pattern',
            icon: Trash2 as LucideIcon,
            onClick: () => onRemoveCluster(cluster.id),
            destructive: true,
          }] : []),
        ];

        return (
          <motion.div
            key={cluster.id}
            layout
            className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] dark:border-white/10 overflow-hidden bg-[var(--color-card-bg)] dark:bg-[#222222]"
          >
            <div className="flex items-center gap-3 p-4">
              <input
                type="checkbox"
                checked={selectedIds.includes(cluster.id)}
                onChange={() => onToggleSelect(cluster.id)}
                className="rounded"
              />
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[var(--text-base)] font-bold text-[#1D1D1F] dark:text-white">
                    {cluster.label}
                  </span>
                  {/* Addendum A Rule 5: terminology never shown without meaning */}
                  <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">
                    {count} {count === 1 ? 'quote' : 'quotes'}
                  </span>
                  {cluster.validationStatus === 'validated' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[var(--text-xs)] font-semibold uppercase tracking-[0.04em]">
                      Confirmed
                    </span>
                  )}
                  {cluster.validationStatus === 'provisional' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[var(--text-xs)] font-semibold uppercase tracking-[0.04em]">
                      {count < MIN_MESSAGES_FOR_VALIDATION
                        ? `Early Signal — add ${MIN_MESSAGES_FOR_VALIDATION - count} more quotes to strengthen this`
                        : 'Early Insight — based on limited evidence'}
                    </span>
                  )}
                  {integrityReport?.reason && (
                    <span className="text-[var(--text-xs)] text-amber-600 dark:text-amber-400 font-medium">
                      ⚠ {integrityReport.reason}
                    </span>
                  )}
                </div>
              </div>

              {/* Contextual actions menu (Addendum A §2.3) */}
              {cardActions.length > 0 && <CardActionsMenu actions={cardActions} />}

              {/* Primary action: Confirm pattern */}
              {!['validated'].includes(cluster.validationStatus ?? '') && canValidate && (
                <button
                  type="button"
                  onClick={() => onValidate(cluster.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] transition-colors"
                >
                  <Check size={12} strokeWidth={3} />
                  Confirm
                </button>
              )}

              <button
                type="button"
                onClick={() => onExpandMessages(cluster.id)}
                className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-background-tertiary)] transition-colors"
              >
                {expanded
                  ? <ChevronDown size={16} className="text-[#86868B]" />
                  : <ChevronRight size={16} className="text-[#86868B]" />}
              </button>
            </div>

            {expanded && (
              <div className="px-4 pb-4 pt-0 space-y-2 border-t border-[var(--color-border-default)]">
                {cluster.messageIds.map(id => {
                  const msg = messages.find(m => m.id === id);
                  if (!msg) return null;
                  return (
                    <div
                      key={id}
                      className="text-[var(--text-sm)] text-[var(--color-text-secondary)] bg-[var(--color-background-secondary)] rounded-[var(--radius-sm)] p-3 leading-relaxed"
                    >
                      "{msg.rawText}"
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
