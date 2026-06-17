import React from 'react';
import { Upload, Plus, CheckCircle, Clock, Globe, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useCorpusStore } from '../store';
import { detectAndNormalize, getLanguageLabel } from '../../../services/translationService';
import { analyzeMessages } from '../services/messageMiningService';
import { deltaCluster } from '../services/deltaClusteringService';
import type { Company, Offer } from '../../../types';
import { humanizeError } from '../../../lib/humanizeError';
import type { IngestSource, CorpusIngest, EvidenceMessage } from '../../../types/pipeline';
import { scoreBatch, type BatchQualitySummary } from '../../../lib/messageQualityScorer';

interface EvidenceInboxProps {
  company: Company;
  offer?: Offer;
  onComplete?: () => void;
}

const INGEST_SOURCE_LABELS: Record<IngestSource, string> = {
  amazon_reviews: 'Amazon Reviews',
  reddit: 'Reddit',
  support_chat: 'Support Chat',
  customer_interview: 'Customer Interview',
  survey_response: 'Survey Response',
  social_media: 'Social Media',
  manual_paste: 'Manual Paste',
  csv_import: 'CSV Import',
  unknown: 'Unknown',
};

type ProcessingStage = 'idle' | 'detecting' | 'translating' | 'analyzing' | 'clustering' | 'done' | 'error';

interface IngestResult {
  totalAdded: number;
  assignedToExisting: number;
  newClusters: number;
  newClusterLabels: string[];
  unassigned: number;
}

import { formatTimeAgo } from '../../../lib/timeUtils';

export function EvidenceInbox({ company, offer, onComplete }: EvidenceInboxProps) {
  const [source, setSource] = React.useState<IngestSource>('manual_paste');
  const [sourceLabel, setSourceLabel] = React.useState('');
  const [rawInput, setRawInput] = React.useState('');
  const [detectedLangs, setDetectedLangs] = React.useState<Record<string, number>>({});
  const [stage, setStage] = React.useState<ProcessingStage>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<IngestResult | null>(null);
  const [qualitySummary, setQualitySummary] = React.useState<BatchQualitySummary | null>(null);

  const store = useCorpusStore();
  const corpus = store.getCorpus(company.id);
  const recentIngests = (corpus.ingests ?? []).slice(-5).reverse();

  const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);

  React.useEffect(() => {
    if (lines.length === 0) { setQualitySummary(null); return; }
    const { summary } = scoreBatch(lines);
    setQualitySummary(summary);
  }, [rawInput]);


  function getReadinessColor(readiness: string) {
    if (readiness === 'strong') return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' };
    if (readiness === 'acceptable') return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' };
    return { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' };
  }

  function getFlagHint(flag: string | null): string {
    if (!flag) return '';
    const hints: Record<string, string> = {
      too_short: 'Many quotes are under 25 characters. Longer, specific quotes produce better avatars.',
      too_generic: 'Quotes use too many generic words. Add specifics: numbers, "because", "when I tried".',
      no_emotional_signal: 'Quotes lack emotional vocabulary. Look for frustrated, anxious, excited, or relieved quotes.',
      no_pain_or_outcome: "Quotes don't mention problems or results. Add quotes about what frustrated them or what changed.",
      filler_only: 'Some quotes are filler ("great", "love it"). These contribute almost nothing to segmentation.',
    };
    return hints[flag] ?? '';
  }

  async function handleDetectLanguages() {
    if (!lines.length) return;
    setStage('detecting');
    try {
      const results = await detectAndNormalize(lines.slice(0, 20));
      const counts: Record<string, number> = {};
      for (const r of results) {
        counts[r.originalLanguage] = (counts[r.originalLanguage] ?? 0) + 1;
      }
      setDetectedLangs(counts);
    } finally {
      setStage('idle');
    }
  }

  async function handleAnalyzeAndAdd() {
    if (!lines.length) return;
    setError(null);
    setResult(null);

    try {
      const versionBefore = corpus.version;
      const now = new Date().toISOString();

      // Step 1: Translate
      setStage('translating');
      const translated = await detectAndNormalize(lines);
      const langs = [...new Set(translated.map(t => t.originalLanguage))];
      const translatedCount = translated.filter(t => t.wasTranslated).length;

      // Step 2: Add raw messages to store
      const addedIds: string[] = [];
      for (const t of translated) {
        const msg = store.addMessage(company.id, t.originalText, 'paste');
        store.updateMessage(company.id, msg.id, {
          normalizedText: t.normalizedText,
          originalLanguage: t.originalLanguage,
          sourceLabel: sourceLabel || INGEST_SOURCE_LABELS[source],
          addedAt: now,
        });
        addedIds.push(msg.id);
      }

      // Step 3: Analyze (requires offer context)
      setStage('analyzing');
      if (offer) {
        const normalizedTexts = translated.map(t => t.normalizedText);
        const analysisResults = await analyzeMessages(normalizedTexts, company, offer);
        const freshCorpus = useCorpusStore.getState().getCorpus(company.id);

        for (let i = 0; i < addedIds.length; i++) {
          const analysis = analysisResults[i];
          if (analysis) {
            const { emotion, ...rest } = analysis;
            store.updateMessage(company.id, addedIds[i], {
              analyzed: true,
              analysis: { ...rest, emotion, qualityScore: 0.5 },
            });
          }
        }
        // Reload after analysis updates
        const analyzedCorpus = useCorpusStore.getState().getCorpus(company.id);
        const newMessages: EvidenceMessage[] = analyzedCorpus.messages.filter(m => addedIds.includes(m.id));

        // Step 4: Delta cluster
        setStage('clustering');
        const deltaResult = await deltaCluster(
          company,
          analyzedCorpus.clusters,
          newMessages,
          analyzedCorpus.messages,
          analyzedCorpus.version + 1
        );

        for (const updated of deltaResult.updatedClusters) {
          store.upsertCluster(company.id, updated);
        }
        for (const newCluster of deltaResult.newClusters) {
          store.upsertCluster(company.id, newCluster);
        }
        store.bumpVersion(company.id);

        // Record ingest
        const versionAfter = useCorpusStore.getState().getCorpus(company.id).version;
        const ingest: CorpusIngest = {
          id: `ingest_${Date.now()}`,
          companyId: company.id,
          source,
          sourceLabel: sourceLabel || INGEST_SOURCE_LABELS[source],
          messageCount: lines.length,
          addedAt: now,
          corpusVersionBefore: versionBefore,
          corpusVersionAfter: versionAfter,
          languagesDetected: langs,
          translatedCount,
        };
        store.addIngest(company.id, ingest);

        const assignedCount = deltaResult.updatedClusters.reduce(
          (sum, c) => {
            const prev = freshCorpus.clusters.find(fc => fc.id === c.id);
            return sum + (c.messageIds.length - (prev?.messageIds.length ?? 0));
          },
          0
        );

        setResult({
          totalAdded: lines.length,
          assignedToExisting: assignedCount,
          newClusters: deltaResult.newClusters.length,
          newClusterLabels: deltaResult.newClusters.map(c => c.label),
          unassigned: deltaResult.unassigned.length,
        });
      } else {
        // No offer — just record the ingest without analysis
        const ingest: CorpusIngest = {
          id: `ingest_${Date.now()}`,
          companyId: company.id,
          source,
          sourceLabel: sourceLabel || INGEST_SOURCE_LABELS[source],
          messageCount: lines.length,
          addedAt: now,
          corpusVersionBefore: versionBefore,
          corpusVersionAfter: versionBefore,
          languagesDetected: langs,
          translatedCount,
        };
        store.addIngest(company.id, ingest);
        setResult({
          totalAdded: lines.length,
          assignedToExisting: 0,
          newClusters: 0,
          newClusterLabels: [],
          unassigned: lines.length,
        });
      }

      setStage('done');
      setRawInput('');
      setDetectedLangs({});
      onComplete?.();
    } catch (err) {
      console.error('[EvidenceInbox] Error:', err);
      setError(humanizeError(err, "We couldn't process these quotes. They may be too short or unclear — try adding more detail."));
      setStage('error');
    }
  }

  const isProcessing: boolean = ['detecting', 'translating', 'analyzing', 'clustering'].includes(stage);

  const stageLabel: Record<ProcessingStage, string> = {
    idle: '',
    detecting: 'Detecting languages...',
    translating: 'Translating messages...',
    analyzing: 'Analyzing signals...',
    clustering: 'Clustering into segments...',
    done: 'Done',
    error: 'Error',
  };

  return (
    <div className="space-y-6">
      {/* Input Panel */}
      <div className="bg-[var(--color-card-bg)] dark:bg-gray-900 border border-[var(--color-border-default)] dark:border-gray-700 rounded-[var(--radius-sm)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-100 flex items-center gap-2">
          <Upload className="w-4 h-4 text-violet-500" />
          Add Evidence
        </h3>

        {/* Source controls */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] mb-1 block">Source</label>
            <select
              value={source}
              onChange={e => setSource(e.target.value as IngestSource)}
              className="w-full text-sm border border-[var(--color-border-default)] dark:border-gray-600 rounded-[var(--radius-sm)] px-3 py-1.5 bg-[var(--color-card-bg)] dark:bg-gray-800 text-[var(--color-text-primary)] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {(Object.keys(INGEST_SOURCE_LABELS) as IngestSource[]).map(s => (
                <option key={s} value={s}>{INGEST_SOURCE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] mb-1 block">Label (optional)</label>
            <input
              type="text"
              value={sourceLabel}
              onChange={e => setSourceLabel(e.target.value)}
              placeholder="e.g. Reddit r/dogs"
              className="w-full text-sm border border-[var(--color-border-default)] dark:border-gray-600 rounded-[var(--radius-sm)] px-3 py-1.5 bg-[var(--color-card-bg)] dark:bg-gray-800 text-[var(--color-text-primary)] dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Language detection result */}
        {Object.keys(detectedLangs).length > 0 && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-tertiary)]">
            <Globe className="w-3.5 h-3.5 text-violet-400" />
            <span>
              Detected:{' '}
              {Object.entries(detectedLangs)
                .map(([lang, count]) => `${getLanguageLabel(lang)} (${count})`)
                .join(', ')}
            </span>
          </div>
        )}

        {/* Text area */}
        <div>
          <label className="text-xs text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] mb-1 block">
            Messages — one per line (max 500)
          </label>
          <textarea
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder="Paste customer messages here, one per line..."
            rows={8}
            className="w-full text-sm border border-[var(--color-border-default)] dark:border-gray-600 rounded-[var(--radius-sm)] px-3 py-2 bg-[var(--color-card-bg)] dark:bg-gray-800 text-[var(--color-text-primary)] dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y font-mono"
          />
          {lines.length > 0 && (
            <p className="text-xs text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] mt-1">
              {lines.length} message{lines.length !== 1 ? 's' : ''} detected
            </p>
          )}
          {qualitySummary && (() => {
            const colors = getReadinessColor(qualitySummary.readiness);
            const topFlag = qualitySummary.dominantFlag ?? null;
            const hint = getFlagHint(topFlag);
            return (
              <div className={cn('mt-2 px-3 py-2 rounded-[var(--radius-sm)] border text-xs flex flex-col gap-1', colors.bg, colors.border)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('font-semibold uppercase tracking-[0.06em]', colors.text)}>
                    {qualitySummary.readiness === 'strong' ? '✓ Strong corpus' : qualitySummary.readiness === 'acceptable' ? '⚠ Acceptable corpus' : '✗ Weak corpus'}
                  </span>
                  <span className={cn('opacity-70', colors.text)}>
                    avg {Math.round(qualitySummary.overallScore * 100)}% quality · {qualitySummary.highCount} strong / {qualitySummary.totalQuotes} quotes
                  </span>
                </div>
                {hint && <p className={cn('text-[var(--text-xs)] leading-snug opacity-80', colors.text)}>{hint}</p>}
              </div>
            );
          })()}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleDetectLanguages}
            disabled={!lines.length || isProcessing}
            className={cn(
              'text-sm px-4 py-1.5 rounded-[var(--radius-sm)] border font-medium transition-colors',
              'border-[var(--color-border-default)] dark:border-gray-600 text-[var(--color-text-secondary)] dark:text-gray-300',
              'hover:bg-[var(--color-background-tertiary)] dark:hover:bg-gray-800',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            <Globe className="w-3.5 h-3.5 inline mr-1.5" />
            Detect Languages
          </button>
          <button
            onClick={handleAnalyzeAndAdd}
            disabled={!lines.length || isProcessing}
            className={cn(
              'text-sm px-4 py-1.5 rounded-[var(--radius-sm)] font-medium transition-colors flex items-center gap-2',
              'bg-violet-600 hover:bg-violet-700 text-white',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {stageLabel[stage]}
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Analyze &amp; Add
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {stage === 'error' && error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-[var(--radius-sm)] px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Result summary */}
      {result && stage === 'done' && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-[var(--radius-sm)] p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            {result.totalAdded} messages added
          </div>
          <ul className="text-sm text-green-700 dark:text-green-300 space-y-0.5 pl-6 list-disc">
            <li>{result.assignedToExisting} assigned to existing clusters</li>
            {result.newClusters > 0 && (
              <li>
                {result.newClusters} new cluster{result.newClusters !== 1 ? 's' : ''} formed
                {result.newClusterLabels.length > 0 && (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {': '}
                    {result.newClusterLabels.map(l => `"${l}"`).join(', ')}
                  </span>
                )}
              </li>
            )}
            {result.unassigned > 0 && (
              <li className="text-green-600 dark:text-green-500">
                {result.unassigned} unassigned (need more evidence to cluster)
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Recent ingests */}
      {recentIngests.length > 0 && (
        <div className="bg-[var(--color-card-bg)] dark:bg-gray-900 border border-[var(--color-border-default)] dark:border-gray-700 rounded-[var(--radius-sm)] p-4">
          <h4 className="text-xs font-semibold text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">
            Recent ingests
          </h4>
          <ul className="space-y-2">
            {recentIngests.map(ingest => (
              <li key={ingest.id} className="flex items-center gap-3 text-sm">
                <Clock className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] flex-shrink-0" />
                <span className="font-medium text-[var(--color-text-primary)] dark:text-gray-200">
                  {ingest.sourceLabel ?? INGEST_SOURCE_LABELS[ingest.source]}
                </span>
                <span className="text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)]">·</span>
                <span className="text-[var(--color-text-secondary)] dark:text-[var(--color-text-tertiary)]">{ingest.messageCount} msgs</span>
                <span className="text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)]">·</span>
                <span className="text-[var(--color-text-secondary)] dark:text-[var(--color-text-tertiary)]">
                  {ingest.languagesDetected.map(l => getLanguageLabel(l)).join('/')}
                </span>
                <span className="text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)]">·</span>
                <span className="text-[var(--color-text-tertiary)] dark:text-[var(--color-text-tertiary)]">{formatTimeAgo(ingest.addedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
