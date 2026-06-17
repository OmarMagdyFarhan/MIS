import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Loader2, ChevronDown, ChevronRight, ChevronUp, Sparkles, Copy, Check as CheckIcon } from 'lucide-react';
import { Avatar, Company, Offer, MinedMessage, ConversionFormulaAspect, PsychologicalSubAspect, ConversionSignalTag } from '../../../types';
import { cn } from '../../../lib/utils';
import { EvidenceSearchPanel } from './EvidenceSearchPanel';
import { useMessageMiningStore } from '../../../stores/messageMiningStore';
import { runPipelineIntent } from '../../../services/pipelineOrchestrator';
import { useCorpusStore, minedToEvidenceList } from '../store';
import { getHighScoringAvatars } from '../../../services/scoreService';
import { resolveEmotion } from '../../../lib/emotionMap';
import { EmotionBadge } from '../../../components/messageMining/EmotionBadge';

interface MessageMiningWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  avatar: Avatar;
  company: Company;
  offer: Offer;
  allAvatars: Avatar[];
  onAvatarCreated: (avatar: Avatar) => void;
  onAvatarImproved: (avatarId: string, patch: Partial<Avatar>) => void;
  onRequestOfferRegeneration?: (avatars: Avatar[]) => void;
  theme?: 'light' | 'dark';
}

const ASPECT_COLORS: Record<ConversionFormulaAspect, string> = {
  Anxiety: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Motivation: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Friction: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Incentive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  Trust: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Urgency: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Value: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export const MessageMiningWorkspace: React.FC<MessageMiningWorkspaceProps> = ({
  isOpen,
  onClose,
  avatar,
  company,
  offer,
  allAvatars,
  onAvatarCreated,
  onAvatarImproved,
  onRequestOfferRegeneration,
  theme = 'light',
}) => {
  const initSession = useMessageMiningStore(s => s.initSession);
  const updateMessages = useMessageMiningStore(s => s.updateMessages);
  const setAnalyzed = useMessageMiningStore(s => s.setAnalyzed);
  const setAnalyzing = useMessageMiningStore(s => s.setAnalyzing);
  const setAnalysisError = useMessageMiningStore(s => s.setAnalysisError);
  const setMarketIntelligence = useMessageMiningStore(s => s.setMarketIntelligence);
  const sessionMessages = useMessageMiningStore(s => s.sessions[avatar.id]?.messages);

  const [rows, setRows] = React.useState<MinedMessage[]>([]);
  const [activeTab, setActiveTab] = React.useState<'input' | 'results' | 'pivot' | 'evidence-map' | 'search'>('input');
  const [processingIndex, setProcessingIndex] = React.useState<number | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [analyzedRows, setAnalyzedRows] = React.useState<MinedMessage[]>([]);
  const [stats, setStats] = React.useState({ newAvatars: 0, updatedAvatars: 0 });
  const [expandedTopics, setExpandedTopics] = React.useState<Record<string, boolean>>({});
  const [highScoreBanner, setHighScoreBanner] = React.useState<Avatar[] | null>(null);
  const [workingAvatars, setWorkingAvatars] = React.useState<Avatar[]>(allAvatars);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setWorkingAvatars(allAvatars);
  }, [allAvatars]);

  // Cleanup debounce timer on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    initSession(company.id, avatar.id);
  }, [isOpen, company.id, avatar.id, initSession]);

  React.useEffect(() => {
    if (sessionMessages?.length) {
      setRows(sessionMessages);
    }
  }, [sessionMessages]);

  const persistRows = React.useCallback(
    (next: MinedMessage[]) => {
      setRows(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Keep session store in sync for legacy display state only
        updateMessages(avatar.id, next);
        // Single authoritative write to corpusStore (no bridge write in store)
        useCorpusStore.getState().ensureCorpus(company.id);
        useCorpusStore.getState().setMessages(company.id, minedToEvidenceList(next, company.id));
      }, 300);
    },
    [avatar.id, company.id, updateMessages]
  );

  const handleRowChange = (index: number, text: string) => {
    const next = rows.map((r, i) => (i === index ? { ...r, text, analyzed: false } : r));
    persistRows(next);
  };

  const handleAddRow = () => {
    persistRows([
      ...rows,
      { id: `msg_${Date.now()}`, text: '', analyzed: false },
    ]);
  };

  const handleDeleteRow = (index: number) => {
    if (rows.length <= 1) return;
    persistRows(rows.filter((_, i) => i !== index));
  };

  const runAnalysis = async () => {
    setIsRunning(true);
    setAnalyzing(true);
    setAnalysisError(null);
    setHighScoreBanner(null);
    setStats({ newAvatars: 0, updatedAvatars: 0 });
    let newCount = 0;
    let updatedCount = 0;
    const avatarAccumulator = [...workingAvatars];

    try {
      const corpusStore = useCorpusStore.getState();
      corpusStore.ensureCorpus(company.id);
      corpusStore.setMessages(company.id, minedToEvidenceList(rows, company.id));

      const pipelineResult = await runPipelineIntent(company, 'legacy_mining_run', {
        legacyMessages: rows,
        existingAvatars: avatarAccumulator,
        callbacks: {
          onMessageAnalyzed: (index, message) => {
            setProcessingIndex(index);
            setAnalyzedRows(prev => {
              const copy = [...prev];
              copy[index] = message;
              return copy;
            });
          },
          onAvatarCreated: newAvatar => {
            newCount += 1;
            avatarAccumulator.push(newAvatar);
            setWorkingAvatars([...avatarAccumulator]);
            onAvatarCreated(newAvatar);
          },
          onAvatarImproved: (avatarId, patch) => {
            updatedCount += 1;
            const idx = avatarAccumulator.findIndex(a => a.id === avatarId);
            if (idx >= 0) {
              avatarAccumulator[idx] = { ...avatarAccumulator[idx], ...patch };
              setWorkingAvatars([...avatarAccumulator]);
            }
            onAvatarImproved(avatarId, patch);
          },
          onMarketIntelligenceReady: data => {
            setMarketIntelligence(company.id, data);
          },
          onError: err => setAnalysisError(err),
        },
      });

      if (!pipelineResult.success) {
        throw new Error(pipelineResult.error || 'Pipeline run failed');
      }

      const corpusMessages = useCorpusStore.getState().getCorpus(company.id).messages;
      const result = corpusMessages.map(m => ({
        id: m.id,
        text: m.rawText,
        topic: m.analysis?.topic,
        conversionFormulaAspect: m.analysis?.conversionFormulaAspect,
        messageType: m.analysis?.messageType,
        analyzed: m.analyzed,
      }));

      const enrichedMap = new Map(result.map(m => [m.id, m]));
      const finalRows = rows.map(r => enrichedMap.get(r.id) ?? r);

      setRows(finalRows);
      setAnalyzed(avatar.id, finalRows);
      setAnalyzedRows(finalRows.filter(m => m.analyzed && m.text.trim().length > 5));
      setStats({ newAvatars: newCount, updatedAvatars: updatedCount });
      setActiveTab('results');

      const highScore = getHighScoringAvatars(avatarAccumulator);
      if (highScore.length > 0) {
        setHighScoreBanner(highScore);
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setProcessingIndex(null);
      setIsRunning(false);
      setAnalyzing(false);
    }
  };

  const pivotGroups = React.useMemo(() => {
    const analyzed = analyzedRows.filter(m => m.analyzed && m.topic);
    const map = new Map<string, MinedMessage[]>();
    for (const m of analyzed) {
      const key = m.topic!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [analyzedRows]);

  if (!isOpen) return null;

  const analyzedCount = analyzedRows.filter(m => m.analyzed).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn('fixed inset-0 z-50', theme === 'dark' && 'dark')}
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-4 md:inset-8 bg-[var(--color-card-bg)] dark:bg-[#1D1D1F] rounded-[var(--radius-md)] overflow-hidden flex flex-col shadow-2xl z-10"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border-default)] dark:border-white/5 shrink-0">
            <div>
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B] block mb-1">
                Message Mining
              </span>
              <h2 className="text-[var(--text-lg)] font-bold text-[var(--color-text-primary)] dark:text-white">{avatar.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-[var(--radius-sm)] hover:bg-[var(--color-card-bg)] dark:hover:bg-white/5 flex items-center justify-center text-[#86868B] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-1 px-6 py-3 border-b border-[var(--color-border-default)] dark:border-white/5 shrink-0">
            {(['input', 'results', 'pivot', 'evidence-map', 'search'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] rounded-[var(--radius-sm)] transition-all',
                  activeTab === tab
                    ? 'bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-[var(--color-text-primary)]'
                    : 'text-[#86868B] hover:text-[var(--color-text-primary)] dark:hover:text-white'
                )}
              >
                {tab === 'pivot' ? 'Pivot Table' : tab === 'input' ? 'Input' : tab === 'evidence-map' ? 'Evidence Map' : tab === 'search' ? 'Search' : 'Results'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {activeTab === 'input' && (
              <div className="flex-1 overflow-y-auto p-6">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B] pb-3 pl-3">
                        What exactly did the prospect say?
                      </th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.id}
                        className="group border-b border-[var(--color-border-default)] dark:border-white/5"
                      >
                        <td className="py-1 pr-2">
                          <div className="flex items-center gap-2">
                            {isRunning && processingIndex === i && (
                              <Loader2 size={14} className="animate-spin text-violet-500 shrink-0" />
                            )}
                            <input
                              value={row.text}
                              onChange={e => handleRowChange(i, e.target.value)}
                              disabled={isRunning}
                              placeholder="Paste a customer/prospect quote here..."
                              className="w-full p-3 text-[var(--text-base)] bg-transparent border-0 outline-none focus:bg-[var(--color-card-bg)] dark:focus:bg-white/5 rounded-[var(--radius-sm)] transition-colors placeholder:text-[#86868B]/40 text-[var(--color-text-primary)] dark:text-white"
                            />
                          </div>
                        </td>
                        <td className="w-8">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(i)}
                            disabled={isRunning || rows.length <= 1}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-[var(--radius-sm)] hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-all disabled:opacity-30"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={handleAddRow}
                  disabled={isRunning}
                  className="mt-3 ml-3 text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-[#86868B] hover:text-[var(--color-text-primary)] dark:hover:text-white flex items-center gap-2 transition-colors disabled:opacity-40"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {analyzedCount === 0 ? (
                  <p className="text-center text-[#86868B] text-[var(--text-base)] py-12">
                    Run analysis on the Input tab to see results.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border-default)] dark:border-white/5">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-[var(--color-border-default)] dark:border-white/5">
                            {['Quote', 'Main Topic', 'Conversion Formula Aspect', 'Message Type'].map(h => (
                              <th
                                key={h}
                                className="px-4 py-3 text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#86868B]"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analyzedRows
                            .filter(m => m.analyzed)
                            .map(m => (
                              <tr
                                key={m.id}
                                className="border-b border-[var(--color-border-default)] dark:border-white/5 last:border-0"
                              >
                                <td className="px-4 py-3 text-[var(--text-base)] text-[var(--color-text-primary)] dark:text-white max-w-[200px]">
                                  {truncate(m.text, 60)}
                                </td>
                                <td className="px-4 py-3 text-[var(--text-base)] font-medium text-[#515154] dark:text-white/70">
                                  {m.topic}
                                </td>
                                <td className="px-4 py-3">
                                  {m.conversionFormulaAspect && (
                                    <span
                                      className={cn(
                                        'px-3 py-1 rounded-full text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]',
                                        ASPECT_COLORS[m.conversionFormulaAspect]
                                      )}
                                    >
                                      {m.conversionFormulaAspect}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-[var(--text-sm)] text-[#86868B]">{m.messageType}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-5 rounded-[var(--radius-md)] bg-[var(--color-card-bg)] dark:bg-white/5 text-[var(--text-base)] font-medium text-[#515154] dark:text-white/70">
                      {analyzedCount} messages analyzed · {stats.newAvatars} new avatars created ·{' '}
                      {stats.updatedAvatars} existing avatars updated
                    </div>

                    {highScoreBanner && highScoreBanner.length > 0 && (
                      <div className="p-5 rounded-[var(--radius-md)] border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 space-y-3">
                        <p className="text-[var(--text-base)] font-bold text-violet-900 dark:text-violet-200">
                          {highScoreBanner.length} high-confidence avatar
                          {highScoreBanner.length > 1 ? 's' : ''} found — Core Offer regeneration
                          recommended
                        </p>
                        {onRequestOfferRegeneration && (
                          <button
                            type="button"
                            onClick={() => onRequestOfferRegeneration(highScoreBanner)}
                            className="rounded-[var(--radius-sm)] px-4 py-2 font-semibold uppercase tracking-[0.06em] text-[var(--text-sm)] bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 transition-opacity"
                          >
                            Regenerate Targeted Offers
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'pivot' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {pivotGroups.length === 0 ? (
                  <p className="text-center text-[#86868B] text-[var(--text-base)] py-12">
                    No analyzed topics yet. Complete analysis first.
                  </p>
                ) : (
                  pivotGroups.map(([topic, messages]) => {
                    const expanded = expandedTopics[topic] ?? false;
                    return (
                      <div
                        key={topic}
                        className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] dark:border-white/5 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTopics(prev => ({ ...prev, [topic]: !expanded }))
                          }
                          className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-card-bg)] dark:bg-white/5 hover:bg-[#EBEBED] dark:hover:bg-white/10 transition-colors text-left"
                        >
                          <span className="text-[var(--text-base)] font-bold text-[var(--color-text-primary)] dark:text-white">
                            {topic}
                          </span>
                          <span className="flex items-center gap-2 text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">
                            COUNTA: {messages.length}
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        </button>
                        {expanded && (
                          <ul className="px-4 py-3 space-y-2 border-t border-[var(--color-border-default)] dark:border-white/5">
                            {messages.map(m => (
                              <li
                                key={m.id}
                                className="text-[var(--text-sm)] text-[#515154] dark:text-white/60 italic pl-2 border-l-2 border-violet-300 dark:border-violet-700"
                              >
                                {truncate(m.text, 120)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {activeTab === 'evidence-map' && (
              <EvidenceMapTab messages={analyzedRows} />
            )}
            {activeTab === 'search' && (
              <EvidenceSearchPanel
                messages={minedToEvidenceList(analyzedRows, company.id)}
                clusters={[]}
              />
            )}
          </div>

          {activeTab === 'input' && (
            <div className="shrink-0 px-6 py-4 border-t border-[var(--color-border-default)] dark:border-white/5 flex justify-end">
              <button
                type="button"
                onClick={runAnalysis}
                disabled={isRunning}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] px-6 py-3 font-semibold uppercase tracking-[0.06em] text-[var(--text-sm)] bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-[var(--color-text-primary)] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isRunning ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Analyze
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Evidence Map Tab ─────────────────────────────────────────────────────────

const ASPECT_COLORS_MAP: Record<string, string> = {
  Anxiety:    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300',
  Motivation: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300',
  Friction:   'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300',
  Incentive:  'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300',
  Trust:      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300',
  Urgency:    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300',
  Value:      'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300',
};

const PSYCH_CORE_ASPECTS = new Set(['Anxiety', 'Motivation', 'Value']);

interface EvidenceMapTabProps {
  messages: MinedMessage[];
}

const EvidenceMapTab: React.FC<EvidenceMapTabProps> = ({ messages }) => {
  const [expandedMsgs, setExpandedMsgs] = React.useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const analyzed = messages.filter(m => m.analyzed && m.conversionFormulaAspect);

  // Group by aspect → sub-aspect / signal tags
  const byAspect = React.useMemo(() => {
    const map = new Map<string, MinedMessage[]>();
    for (const m of analyzed) {
      const key = m.conversionFormulaAspect!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [analyzed]);

  const toggleMsg = (id: string) => {
    setExpandedMsgs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyQuote = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (analyzed.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <p className="text-[var(--text-base)] text-[#86868B] text-center">
          No analyzed messages yet. Run analysis on the Input tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {byAspect.map(([aspect, msgs]) => {
        const isPsychCore = PSYCH_CORE_ASPECTS.has(aspect);

        // Group by sub-aspect (psych core) or signal tags (conversion dynamics)
        const subGroups: Map<string, MinedMessage[]> = new Map();
        for (const m of msgs) {
          if (isPsychCore) {
            const key = (m.subAspect as string) || '(unclassified)';
            if (!subGroups.has(key)) subGroups.set(key, []);
            subGroups.get(key)!.push(m);
          } else {
            const tags: string[] = (m.conversionSignalTags as string[] | undefined) ?? [];
            if (tags.length === 0) {
              const key = '(no signal tags)';
              if (!subGroups.has(key)) subGroups.set(key, []);
              subGroups.get(key)!.push(m);
            } else {
              for (const tag of tags) {
                if (!subGroups.has(tag)) subGroups.set(tag, []);
                subGroups.get(tag)!.push(m);
              }
            }
          }
        }

        return (
          <div
            key={aspect}
            className="rounded-[var(--radius-md)] border border-[#E8E8ED] dark:border-white/5 overflow-hidden"
          >
            {/* Aspect header */}
            <div className={cn(
              'px-5 py-3 flex items-center gap-3 border-b border-[#E8E8ED] dark:border-white/5',
              'bg-[var(--color-card-bg)] dark:bg-white/5'
            )}>
              <span className={cn(
                'px-3 py-1 rounded-full text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] border',
                ASPECT_COLORS_MAP[aspect] ?? 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]'
              )}>
                {aspect}
              </span>
              <span className="text-[var(--text-sm)] font-bold text-[#86868B]">{msgs.length} messages</span>
            </div>

            {/* Sub-groups */}
            <div className="divide-y divide-[#F5F5F7] dark:divide-white/5">
              {Array.from(subGroups.entries()).map(([subKey, subMsgs]) => (
                <div key={subKey} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#515154] dark:text-white/50">
                      └─ {subKey}
                    </span>
                    <span className="text-[var(--text-xs)] text-[#86868B]">({subMsgs.length})</span>
                  </div>

                  <div className="space-y-2 ml-4">
                    {subMsgs.map(m => {
                      const expanded = expandedMsgs.has(m.id);
                      const emotion = m.resolvedEmotion ?? (m.emotion ? resolveEmotion(m.emotion) : null);

                      return (
                        <div
                          key={m.id}
                          className="rounded-[var(--radius-sm)] border border-[#F0F0F5] dark:border-white/5 bg-[var(--color-card-bg)] dark:bg-white/2 overflow-hidden"
                        >
                          {/* Collapsed row */}
                          <button
                            type="button"
                            onClick={() => toggleMsg(m.id)}
                            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#F9F9FB] dark:hover:bg-white/5 transition-colors"
                          >
                            <span className="flex-1 text-[var(--text-sm)] text-[var(--color-text-primary)] dark:text-white/80 leading-snug">
                              {truncate(m.text, 80)}
                            </span>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {/* Aspect badge */}
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-[var(--text-xs)] font-bold',
                                ASPECT_COLORS_MAP[aspect] ?? 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]'
                              )}>
                                {aspect}
                                {m.subAspect ? ` · ${m.subAspect}` : ''}
                              </span>
                              {/* Emotion badge */}
                              {emotion && <EmotionBadge emotion={emotion} compact />}
                              {/* Secondary aspect */}
                              {m.secondaryAspect && (
                                <span className="px-2 py-0.5 rounded-full text-[var(--text-xs)] font-medium bg-[var(--color-background-tertiary)] text-[var(--color-text-tertiary)] dark:bg-white/10 dark:text-white/40 opacity-70">
                                  {m.secondaryAspect}
                                </span>
                              )}
                              {expanded ? <ChevronUp size={14} className="text-[#86868B]" /> : <ChevronDown size={14} className="text-[#86868B]" />}
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {expanded && (
                            <div className="border-t border-[#F0F0F5] dark:border-white/5 px-4 py-4 space-y-3 bg-[#FAFAFA] dark:bg-white/3">
                              {/* Full quote */}
                              <blockquote className="text-[var(--text-sm)] text-[var(--color-text-primary)] dark:text-white/80 italic border-l-2 border-[#0A84FF] pl-3 leading-relaxed">
                                {m.text}
                              </blockquote>

                              {/* Analysis fields grid */}
                              <div className="grid grid-cols-2 gap-2 text-[var(--text-xs)]">
                                {m.conversionFormulaAspect && (
                                  <div>
                                    <span className="font-semibold uppercase tracking-[0.06em] text-[#86868B]">Aspect</span>
                                    <p className="text-[var(--color-text-primary)] dark:text-white">{m.conversionFormulaAspect}</p>
                                  </div>
                                )}
                                {m.subAspect && (
                                  <div>
                                    <span className="font-semibold uppercase tracking-[0.06em] text-[#86868B]">Sub-aspect</span>
                                    <p className="text-[var(--color-text-primary)] dark:text-white">{m.subAspect}</p>
                                  </div>
                                )}
                                {m.secondaryAspect && (
                                  <div>
                                    <span className="font-semibold uppercase tracking-[0.06em] text-[#86868B]">Secondary</span>
                                    <p className="text-[var(--color-text-primary)] dark:text-white">{m.secondaryAspect}{m.secondarySubAspect ? ` · ${m.secondarySubAspect}` : ''}</p>
                                  </div>
                                )}
                                {m.messageType && (
                                  <div>
                                    <span className="font-semibold uppercase tracking-[0.06em] text-[#86868B]">Message Type</span>
                                    <p className="text-[var(--color-text-primary)] dark:text-white">{m.messageType}</p>
                                  </div>
                                )}
                                {m.topic && (
                                  <div>
                                    <span className="font-semibold uppercase tracking-[0.06em] text-[#86868B]">Topic</span>
                                    <p className="text-[var(--color-text-primary)] dark:text-white">{m.topic}</p>
                                  </div>
                                )}
                                {emotion && (
                                  <div className="col-span-2">
                                    <span className="font-semibold uppercase tracking-[0.06em] text-[#86868B]">Emotion</span>
                                    <div className="mt-1">
                                      <EmotionBadge emotion={emotion} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Signal tags */}
                              {m.conversionSignalTags && m.conversionSignalTags.length > 0 && (
                                <div>
                                  <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">Signal Tags</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(m.conversionSignalTags as string[]).map(tag => (
                                      <span key={tag} className="px-2 py-0.5 rounded-full text-[var(--text-xs)] font-medium bg-[#F0F0F5] dark:bg-white/10 text-[#515154] dark:text-white/60">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Copy button */}
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => copyQuote(m.text, m.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#0A84FF] hover:bg-[#0A84FF]/5 transition-colors"
                                >
                                  {copiedId === m.id ? (
                                    <><CheckIcon size={12} /> Copied</>
                                  ) : (
                                    <><Copy size={12} /> Copy quote</>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
