import React from 'react';
import { motion } from 'motion/react';
import { Plus, Loader2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Company, Avatar, MinedMessage } from '../../../types';
import { cn } from '../../../lib/utils';
import {
  useCorpusStore,
  evidenceToMined,
  minedToEvidenceList,
} from '../store';
import { humanizeError } from '../../../lib/humanizeError';
import { usePipelineStore } from '../../../stores/pipelineStore';
import { ClusterReviewPanel } from './ClusterReviewPanel';
import { ClusterSplitModal } from './ClusterSplitModal';
import { AvatarMergePanel } from '../../../components/stage3/AvatarMergePanel';
import { runPipelineIntent, validateClustersAuto, recalculateDownstream } from '../../../services/pipelineOrchestrator';
import { evolveAvatars } from '../../../services/avatarEvolutionService';
import { computeCorpusConfidence } from '../../../services/confidenceService';
import { FeelWheel } from '../../../components/intel/FeelWheel';
import { CorpusHealthPanel } from './CorpusHealthPanel';
import { SourceRecommenderPanel } from './SourceRecommenderPanel';
import { ConversionAspectsPanel } from './ConversionAspectsPanel';
import type { AcquisitionMode } from '../../../types/pipeline';
import { getHighScoringAvatars } from '../../../services/scoreService';

interface Props {
  company: Company;
  avatars: Avatar[];
  onAvatarsUpdated: (avatars: Avatar[]) => void;
  onContinue?: () => void;
}

export const CompanyMiningWorkspace: React.FC<Props> = ({
  company,
  avatars,
  onAvatarsUpdated,
  onContinue
}) => {
  const companyId = company.id;
  const corpus = useCorpusStore(s => s.corpora[companyId]);
  const ensureCorpus = useCorpusStore(s => s.ensureCorpus);
  const setMessages = useCorpusStore(s => s.setMessages);
  const setMode = useCorpusStore(s => s.setMode);
  const mergeClusters = useCorpusStore(s => s.mergeClusters);
  const splitCluster = useCorpusStore(s => s.splitCluster);
  const upsertCluster = useCorpusStore(s => s.upsertCluster);

  const pipeline = usePipelineStore(s => s.byCompany[companyId]);
  const activeRun = usePipelineStore(s => s.getActiveRun(companyId));
  const stale = pipeline?.stale;
  const isPipelineStale = stale && Object.values(stale).some(Boolean);

  const [activeTab, setActiveTab] = React.useState<'input' | 'clusters' | 'feel' | 'status' | 'health'>('input');
  const [rows, setRows] = React.useState<MinedMessage[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedClusterIds, setSelectedClusterIds] = React.useState<string[]>([]);
  const [expandedClusterId, setExpandedClusterId] = React.useState<string | null>(null);
  const [splitClusterId, setSplitClusterId] = React.useState<string | null>(null);
  const [workingAvatars, setWorkingAvatars] = React.useState<Avatar[]>(avatars);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    ensureCorpus(companyId, pipeline?.acquisitionMode || 'hybrid');
  }, [companyId, ensureCorpus, pipeline?.acquisitionMode]);

  React.useEffect(() => {
    if (corpus?.messages?.length) {
      setRows(evidenceToMined(corpus.messages));
    } else {
      setRows([{ id: `msg_${Date.now()}`, text: '', analyzed: false }]);
    }
  }, [corpus?.messages, corpus?.version]);

  React.useEffect(() => {
    setWorkingAvatars(avatars);
  }, [avatars]);

  // Cleanup debounce timer on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const persistRows = (next: MinedMessage[]) => {
    setRows(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setMessages(companyId, minedToEvidenceList(next, companyId));
      usePipelineStore.getState().markLayerStale(companyId, 'messages');
    }, 300);
  };

  const mode = corpus?.mode || 'hybrid';
  const confidence = corpus
    ? computeCorpusConfidence(corpus.messages, corpus.clusters, mode)
    : null;

  const runFullPipeline = async () => {
    setIsRunning(true);
    setError(null);
    let avs = [...workingAvatars];
    try {
      persistRows(rows);
      await runPipelineIntent(company, 'analyze_corpus', {
        existingAvatars: avs,
        callbacks: {
          onProgress: () => {},
        },
      });
      await runPipelineIntent(company, 'propose_clusters', { existingAvatars: avs });
      validateClustersAuto(companyId);
      await runPipelineIntent(company, 'materialize_avatars', {
        existingAvatars: avs,
        callbacks: {
          onAvatarCreated: a => {
            avs = [...avs, a];
            setWorkingAvatars(avs);
            onAvatarsUpdated(avs);
          },
          onAvatarsUpdated: (updatedAvatars) => {
            avs = updatedAvatars;
            setWorkingAvatars(avs);
          },
        },
      });

      // ✅ Phase 11: Evolve existing avatars with new evidence
      const updatedCorpus = useCorpusStore.getState().getCorpus(companyId);
      const evolvedAvatars = evolveAvatars(
        avs,
        updatedCorpus.clusters,
        updatedCorpus.messages,
        updatedCorpus.version
      );

      // Show which avatars changed lifecycle status
      const evolved = evolvedAvatars.filter((a, i) =>
        a.lifecycleStatus !== avs[i]?.lifecycleStatus
      );
      if (evolved.length > 0) {
        console.log('[Phase 11] Avatars evolved:', evolved.map(a =>
          `${a.name}: ${avs.find(x => x.id === a.id)?.lifecycleStatus} → ${a.lifecycleStatus}`
        ));
      }

      avs = evolvedAvatars;
      setWorkingAvatars(avs);
      onAvatarsUpdated(avs);

      await runPipelineIntent(company, 'synthesize_avatar_offers', {
        existingAvatars: avs,
        callbacks: {
          onAvatarImproved: (id, patch) => {
            avs = avs.map(a => (a.id === id ? { ...a, ...patch } : a));
            setWorkingAvatars(avs);
            onAvatarsUpdated(avs);
          },
        },
      });
      await runPipelineIntent(company, 'synthesize_market_intel', { existingAvatars: avs });
      setActiveTab('clusters');
      usePipelineStore.getState().setPhase(companyId, 'avatar_offers_ready');
      usePipelineStore.getState().setPhase(companyId, 'pipeline_complete');
      // 5.2: zero-avatar feedback
      if (workingAvatars.length === 0) {
        setError(
          'No segments were generated. Try adding more messages (aim for 5+ per topic) ' +
          'or check that messages describe real customer problems.'
        );
      }
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setIsRunning(false);
    }
  };

  const handleValidateCluster = (clusterId: string) => {
    const c = corpus?.clusters.find(x => x.id === clusterId);
    if (!c) return;
    upsertCluster(companyId, {
      ...c,
      status: 'validated',
      validationStatus: 'validated',
      updatedAt: new Date().toISOString(),
    });
    usePipelineStore.getState().setPhase(companyId, 'clusters_validated');
  };

  const handleMerge = (sourceIds: string[]) => {
    mergeClusters(companyId, sourceIds);
    setSelectedClusterIds([]);
    usePipelineStore.getState().markLayerStale(companyId, 'clusters');
  };

  const handleSplit = (messageIds: string[], newLabel: string) => {
    if (!splitClusterId) return;
    splitCluster(companyId, splitClusterId, messageIds, newLabel);
    usePipelineStore.getState().markLayerStale(companyId, 'clusters');
    setSplitClusterId(null);
  };

  return (
    <div className={cn('max-w-[1000px] mx-auto px-4 pb-24', 'dark')}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 pt-8"
      >
        {isPipelineStale && (
          <div style={{
            background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '8px',
            padding: '12px 16px', marginBottom: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ color: '#92400e', fontSize: '14px' }}>
              ⚠️ Foundation answers changed — pipeline data is outdated.
            </span>
            <button onClick={runFullPipeline} style={{
              background: '#f59e0b', color: 'white', border: 'none',
              borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px'
            }}>
              Re-run pipeline
            </button>
          </div>
        )}
        <div className="space-y-3">
          <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B]">
            Evidence Foundation
          </span>
          <h2 className="text-[var(--text-xl)] font-display font-bold tracking-tight text-[#1D1D1F] dark:text-white">
            Message Mining
          </h2>
          <p className="text-[var(--text-base)] text-[#86868B] max-w-[640px]">
            Company-level corpus → clusters → segments. Core offer synthesizes later from validated
            intelligence.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {(['evidence_first', 'hybrid', 'bootstrap'] as AcquisitionMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(companyId, m)}
              className={cn(
                'px-4 py-2 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] transition-colors',
                mode === m
                  ? 'bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F]'
                  : 'bg-[var(--color-card-bg)] dark:bg-white/10 text-[#86868B]'
              )}
            >
              {m === 'evidence_first' ? 'Start with Research' : m === 'hybrid' ? 'Research + Context' : 'Start with Knowledge'}
            </button>
          ))}
          {confidence && (
            <span
              className={cn(
                'px-3 py-1.5 rounded-full text-[var(--text-xs)] font-semibold uppercase',
                confidence.status === 'validated'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              )}
            >
              {confidence.status} · {Math.round(confidence.overall * 100)}% confidence
            </span>
          )}
        </div>

        {stale?.avatarOffers && (
          <div className="p-4 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 flex flex-wrap items-center gap-3">
            <AlertCircle size={18} className="text-amber-600" />
            <span className="text-[var(--text-sm)] font-medium text-amber-900 flex-1">
              Downstream artifacts may be stale after corpus changes.
            </span>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => recalculateDownstream(company, 'all_segments', workingAvatars)}
              className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] bg-amber-700 text-white text-[var(--text-xs)] font-semibold uppercase"
            >
              <RefreshCw size={12} /> Recalculate downstream
            </button>
          </div>
        )}

        {activeRun && (
          <div className="p-4 rounded-[var(--radius-md)] bg-violet-50 dark:bg-violet-900/20 flex items-center gap-3">
            <Loader2 className="animate-spin text-violet-600" size={18} />
            <span className="text-[var(--text-sm)] font-bold text-violet-800 dark:text-violet-200">
              {activeRun.progress.step} ({activeRun.progress.current}/{activeRun.progress.total})
            </span>
          </div>
        )}

        <div className="flex gap-2 border-b border-[var(--color-border-default)] dark:border-white/10 pb-2">
          {(['input', 'clusters', 'feel', 'status', 'health'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] rounded-[var(--radius-sm)]',
                activeTab === tab
                  ? 'bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F]'
                  : 'text-[#86868B]'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'input' && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)]/40 dark:border-white/10 overflow-hidden bg-white dark:bg-[#222222] shadow-sm">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B] p-4">
                    What exactly did the prospect say?
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className="group border-t border-[var(--color-border-default)] dark:border-white/5">
                    <td className="p-2">
                      <input
                        value={row.text}
                        disabled={isRunning}
                        onChange={e => {
                          const next = rows.map((r, j) =>
                            j === i ? { ...r, text: e.target.value, analyzed: false } : r
                          );
                          persistRows(next);
                        }}
                        placeholder="Paste customer quote..."
                        className="w-full p-3 text-[var(--text-base)] bg-transparent outline-none focus:bg-[var(--color-card-bg)] dark:focus:bg-white/5 rounded-[var(--radius-sm)]"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={rows.length <= 1 || isRunning}
                        onClick={() => persistRows(rows.filter((_, j) => j !== i))}
                        className="opacity-0 group-hover:opacity-100 text-red-400 text-[var(--text-sm)] p-2"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 flex flex-wrap gap-3 border-t border-[var(--color-border-default)] dark:border-white/5">
              <button
                type="button"
                onClick={() =>
                  persistRows([...rows, { id: `msg_${Date.now()}`, text: '', analyzed: false }])
                }
                className="flex items-center gap-2 text-[var(--text-sm)] font-semibold uppercase text-[#86868B]"
              >
                <Plus size={14} /> Add Row
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={runFullPipeline}
                className="ml-auto flex items-center gap-2 px-6 py-3 rounded-[var(--radius-sm)] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] text-[var(--text-sm)] font-semibold uppercase"
              >
                {isRunning ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Analyze & Cluster
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-[var(--radius-md)]"
            style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
            <span style={{ color: '#DC2626', fontSize: '16px', flexShrink: 0 }}>⚠️</span>
            <div className="flex-1">
              <p className="text-[var(--text-sm)] font-bold" style={{ color: '#7F1D1D' }}>{error}</p>
            </div>
            <button onClick={() => setError(null)}
              className="text-[#DC2626] opacity-60 hover:opacity-100 transition-opacity text-lg font-bold shrink-0">
              ✕
            </button>
          </div>
        )}

        {activeTab === 'clusters' && (
          <AvatarMergePanel
            avatars={workingAvatars.filter(a => !a.mergedIntoAvatarId)}
            onMergeComplete={updated => {
              setWorkingAvatars(updated);
              onAvatarsUpdated(updated);
            }}
          />
        )}

        {activeTab === 'clusters' && corpus && (
          <ClusterReviewPanel
            clusters={corpus.clusters}
            messages={corpus.messages}
            selectedIds={selectedClusterIds}
            onToggleSelect={id =>
              setSelectedClusterIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
              )
            }
            onValidate={handleValidateCluster}
            onMerge={handleMerge}
            onSplit={id => setSplitClusterId(id)}
            onExpandMessages={id =>
              setExpandedClusterId(prev => (prev === id ? null : id))
            }
            expandedClusterId={expandedClusterId}
          />
        )}

        {activeTab === 'feel' && corpus && (
          <div className="space-y-6">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] dark:border-white/10 bg-[var(--color-card-bg)] dark:bg-white/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--color-border-default)] dark:border-white/10">
                <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">Emotional Landscape</span>
              </div>
              <FeelWheel messages={corpus.messages.filter(m => m.analyzed && m.analysis?.emotion)} />
            </div>
            <ConversionAspectsPanel messages={corpus.messages} />
          </div>
        )}

        {activeTab === 'status' && pipeline && (
          <div className="p-6 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] dark:bg-white/5 space-y-2 text-[var(--text-base)]">
            <div>
              <span className="font-semibold text-[#86868B] uppercase text-[var(--text-xs)]">Phase </span>
              {pipeline.phase}
            </div>
            <div>Research Library · {corpus?.messages.length ?? 0} evidence pieces</div>
            <div>{corpus?.clusters.filter(c => c.status !== 'merged').length ?? 0} clusters</div>
            <div>{workingAvatars.length} avatars</div>
          </div>
        )}

        {activeTab === 'health' && corpus && (
          <div className="space-y-6">
            <CorpusHealthPanel corpus={corpus} />
            <SourceRecommenderPanel corpus={corpus} />
          </div>
        )}

        <ClusterSplitModal
          open={!!splitClusterId}
          cluster={corpus?.clusters.find(c => c.id === splitClusterId) ?? null}
          messages={corpus?.messages ?? []}
          onClose={() => setSplitClusterId(null)}
          onSplit={handleSplit}
        />

        {error && <p className="text-red-500 text-[var(--text-base)]">{error}</p>}

        {onContinue && (
          <div className="flex justify-end pt-8">
            <button
              type="button"
              onClick={onContinue}
              className="px-8 py-4 rounded-[var(--radius-sm)] bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em]"
            >
              Continue to Segments →
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
