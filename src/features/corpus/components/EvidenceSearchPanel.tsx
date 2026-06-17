import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { searchEvidence, groupSearchResultsByAspect } from '../../../services/evidenceSearchService';
import type { EvidenceSearchResult } from '../../../services/evidenceSearchService';
import type { EvidenceMessage, Cluster } from '../../../types/pipeline';
import type { ConversionFormulaAspect } from '../../../types';

interface EvidenceSearchPanelProps {
  messages: EvidenceMessage[];
  clusters: Cluster[];
}

const ASPECT_COLORS: Record<string, string> = {
  Anxiety:    'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  Motivation: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  Friction:   'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  Incentive:  'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  Trust:      'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  Urgency:    'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  Value:      'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300',
};

const ALL_ASPECTS: ConversionFormulaAspect[] = ['Anxiety', 'Motivation', 'Value', 'Friction', 'Incentive', 'Trust', 'Urgency'];

export const EvidenceSearchPanel: React.FC<EvidenceSearchPanelProps> = ({ messages, clusters }) => {
  const [textQuery, setTextQuery] = React.useState('');
  const [selectedAspect, setSelectedAspect] = React.useState<ConversionFormulaAspect | null>(null);
  const [highQualityOnly, setHighQualityOnly] = React.useState(false);
  const [emotionOnly, setEmotionOnly] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const results = React.useMemo(() => {
    const hasFilter = textQuery.trim() || selectedAspect || highQualityOnly || emotionOnly;
    if (!hasFilter) return null;
    return searchEvidence(messages, clusters, {
      text: textQuery.trim() || undefined,
      aspect: selectedAspect ?? undefined,
      minQualityScore: highQualityOnly ? 0.7 : undefined,
      hasEmotion: emotionOnly || undefined,
    });
  }, [messages, clusters, textQuery, selectedAspect, highQualityOnly, emotionOnly]);

  const grouped = React.useMemo(() => {
    if (!results || textQuery.trim()) return null;
    return groupSearchResultsByAspect(results);
  }, [results, textQuery]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const hasAnyQuery = textQuery.trim() || selectedAspect || highQualityOnly || emotionOnly;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="shrink-0 p-4 border-b border-[var(--color-border-default)] dark:border-white/5 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
          <input
            type="text"
            value={textQuery}
            onChange={e => setTextQuery(e.target.value)}
            placeholder="Search evidence corpus…"
            className="w-full pl-9 pr-8 py-2.5 text-sm rounded-[var(--radius-sm)] bg-[var(--color-card-bg)] dark:bg-white/5 text-[var(--color-text-primary)] dark:text-white placeholder:text-[#86868B] border-none outline-none focus:ring-1 focus:ring-[#1D1D1F] dark:focus:ring-white/20"
          />
          {textQuery && (
            <button
              onClick={() => setTextQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[var(--color-text-primary)] dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <div className="flex items-center gap-1 text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">
            <Filter className="w-3 h-3" />
          </div>
          <button
            onClick={() => setSelectedAspect(null)}
            className={cn(
              'px-2.5 py-1 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] transition-all',
              !selectedAspect
                ? 'bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-[var(--color-text-primary)]'
                : 'text-[#86868B] hover:text-[var(--color-text-primary)] dark:hover:text-white bg-[var(--color-card-bg)] dark:bg-white/5'
            )}
          >
            All
          </button>
          {ALL_ASPECTS.map(aspect => (
            <button
              key={aspect}
              onClick={() => setSelectedAspect(prev => prev === aspect ? null : aspect)}
              className={cn(
                'px-2.5 py-1 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] transition-all',
                selectedAspect === aspect
                  ? ASPECT_COLORS[aspect]
                  : 'text-[#86868B] hover:text-[var(--color-text-primary)] dark:hover:text-white bg-[var(--color-card-bg)] dark:bg-white/5'
              )}
            >
              {aspect}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setHighQualityOnly(v => !v)}
            className={cn(
              'px-2.5 py-1 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] transition-all',
              highQualityOnly
                ? 'bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-[var(--color-text-primary)]'
                : 'text-[#86868B] bg-[var(--color-card-bg)] dark:bg-white/5 hover:text-[var(--color-text-primary)] dark:hover:text-white'
            )}
          >
            High quality only (&gt;0.7)
          </button>
          <button
            onClick={() => setEmotionOnly(v => !v)}
            className={cn(
              'px-2.5 py-1 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] transition-all',
              emotionOnly
                ? 'bg-[#1D1D1F] dark:bg-[var(--color-card-bg)] text-white dark:text-[var(--color-text-primary)]'
                : 'text-[#86868B] bg-[var(--color-card-bg)] dark:bg-white/5 hover:text-[var(--color-text-primary)] dark:hover:text-white'
            )}
          >
            Emotion tagged only
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasAnyQuery ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Search className="w-8 h-8 text-[#86868B] mb-3 opacity-50" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-white mb-1">Search your evidence corpus</p>
            <p className="text-xs text-[#86868B] max-w-xs">
              Type a keyword or select a filter to find relevant messages.
            </p>
            <p className="text-xs text-[#86868B] mt-2">
              Examples: &quot;price objections&quot; · &quot;fear of&quot; · aspect: Anxiety
            </p>
          </div>
        ) : results === null || results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <p className="text-sm text-[#86868B]">No results found. Try a different query.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B]">
              {results.length} result{results.length !== 1 ? 's' : ''}
              {textQuery.trim() ? ` for "${textQuery.trim()}"` : ''}
            </p>

            {/* Grouped by aspect when no text query */}
            {grouped ? (
              [...grouped.entries()].map(([aspect, items]) => (
                <div key={aspect} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-0.5 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]', ASPECT_COLORS[aspect] ?? 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]')}>
                      {aspect}
                    </span>
                    <span className="text-[var(--text-xs)] text-[#86868B]">({items.length})</span>
                  </div>
                  {items.map(r => <ResultRow key={r.message.id} result={r} expanded={expandedIds.has(r.message.id)} onToggle={() => toggleExpand(r.message.id)} />)}
                </div>
              ))
            ) : (
              results.map(r => <ResultRow key={r.message.id} result={r} expanded={expandedIds.has(r.message.id)} onToggle={() => toggleExpand(r.message.id)} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface ResultRowProps {
  result: EvidenceSearchResult;
  expanded: boolean;
  onToggle: () => void;
}

const ResultRow: React.FC<ResultRowProps> = ({ result, expanded, onToggle }) => {
  const { message, cluster } = result;
  const text = message.rawText;
  const truncated = text.length > 100 && !expanded;
  const displayText = truncated ? text.slice(0, 100) + '…' : text;
  const aspect = message.analysis?.conversionFormulaAspect;
  const subAspect = message.analysis?.subAspect;
  const quality = message.analysis?.qualityScore;
  const emotion = message.analysis?.emotion;

  return (
    <div
      className="p-3 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] dark:border-white/10 bg-[var(--color-card-bg)] dark:bg-white/3 hover:border-[#1D1D1F]/20 dark:hover:border-white/20 transition-all cursor-pointer"
      onClick={onToggle}
    >
      <p className="text-sm text-[var(--color-text-primary)] dark:text-white leading-relaxed">
        &ldquo;{displayText}&rdquo;
        {truncated && <span className="text-[var(--text-xs)] text-[#86868B] ml-1">[expand]</span>}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {aspect && (
          <span className={cn('px-1.5 py-0.5 rounded-md text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em]', ASPECT_COLORS[aspect] ?? 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]')}>
            {aspect}
          </span>
        )}
        {subAspect && (
          <span className="px-1.5 py-0.5 rounded-md text-[var(--text-xs)] font-medium text-[#86868B] bg-[var(--color-card-bg)] dark:bg-white/5">
            {subAspect}
          </span>
        )}
        {emotion && (
          <span className="px-1.5 py-0.5 rounded-md text-[var(--text-xs)] font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300">
            {emotion}
          </span>
        )}
        {cluster && (
          <span className="px-1.5 py-0.5 rounded-md text-[var(--text-xs)] font-medium text-[#86868B] bg-[var(--color-card-bg)] dark:bg-white/5">
            {cluster.label}
          </span>
        )}
        {quality !== undefined && (
          <span className="px-1.5 py-0.5 rounded-md text-[var(--text-xs)] font-medium text-[#86868B] bg-[var(--color-card-bg)] dark:bg-white/5">
            quality: {quality.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
};
