import React, { useEffect, useState } from 'react';
import { useActiveCompanyId, useCompanyStore } from '../stores/companyStore';
import { useFoundationStore } from '../stores/foundationStore';
import { useWorkflowActions } from '../stores/workflowStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { useCorpusStore } from '../features/corpus/store';
import { FOUNDATION_QUESTIONS } from '../constants/foundationQuestions';
import { inferAnswer } from '../services/foundationInferenceService';
import { applyFoundationAnswer } from '../services/foundationFeedbackService';
import { FoundationQuestionCard } from '../components/foundation/FoundationQuestionCard';
import type { FoundationId, FoundationAnswer } from '../types/foundation';
import type { InferenceResult } from '../services/foundationInferenceService';

type TabId = FoundationId;

const TABS: { id: TabId; label: string }[] = [
  { id: 'market',  label: 'Market' },
  { id: 'product', label: 'Product' },
  { id: 'brand',   label: 'Brand' },
  { id: 'model',   label: 'Model' },
];

export function FoundationView() {
  const [activeTab, setActiveTab] = useState<TabId>('market');
  const [inferenceResults, setInferenceResults] = useState<Record<string, InferenceResult>>({});
  const [feedbackMessages, setFeedbackMessages] = useState<Record<string, string[]>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [hypothesisCount, setHypothesisCount] = useState<number | null>(null);

  const companyId = useActiveCompanyId();
  const company = useCompanyStore(s => s.companies.find(c => c.id === companyId));
  const { getAnswer, setAnswer, hydrated, hydrate } = useFoundationStore();
  const { setCurrentView } = useWorkflowActions();
  const pipelineStore = usePipelineStore();
  const corpus = useCorpusStore(s => companyId ? s.corpora[companyId] : undefined);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  if (!companyId || !company) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">No active company. Please select or create a company first.</p>
      </div>
    );
  }

  const marketIntel = pipelineStore.marketIntelligence[companyId] ?? null;
  const messages = corpus?.messages ?? [];
  const analyzedCount = messages.filter(m => m.analyzed).length;

  const ctx = { company, avatars: [], messages, marketIntel, offer: null };

  const tabQuestions = FOUNDATION_QUESTIONS.filter(q => q.foundationId === activeTab);

  function runInference() {
    setIsRunning(true);
    const results: Record<string, InferenceResult> = {};
    let count = 0;

    for (const q of FOUNDATION_QUESTIONS) {
      const existing = getAnswer(companyId!, q.id);
      if (existing?.status === 'validated' || existing?.status === 'deferred') continue;
      const result = inferAnswer(q, ctx);
      results[q.id] = result;
      if (result.canInfer) {
        count++;
        setAnswer(companyId!, {
          questionId: q.id,
          foundationId: q.foundationId,
          status: 'inferred',
          primarySuggestion: result.primary,
          alternatives: result.alternatives,
          gaps: result.gaps,
          overallSignalStrength: result.overallSignalStrength,
          overallEvidenceQuality: result.overallEvidenceQuality,
          feedbackApplied: false,
        });
      }
    }

    setInferenceResults(prev => ({ ...prev, ...results }));
    setHypothesisCount(count);
    setIsRunning(false);
  }

  function getResultForQuestion(questionId: string): InferenceResult {
    if (inferenceResults[questionId]) return inferenceResults[questionId];
    return inferAnswer(FOUNDATION_QUESTIONS.find(q => q.id === questionId)!, ctx);
  }

  function handleDecide(answer: FoundationAnswer) {
    const finalAnswer = { ...answer, status: 'validated' as const };
    setAnswer(companyId!, finalAnswer);
    const feedback = applyFoundationAnswer(companyId!, finalAnswer);
    if (feedback.pipelineUpdates.length > 0) {
      setFeedbackMessages(prev => ({
        ...prev,
        [answer.questionId]: feedback.pipelineUpdates,
      }));
      setTimeout(() => {
        setFeedbackMessages(prev => {
          const next = { ...prev };
          delete next[answer.questionId];
          return next;
        });
      }, 4000);
    }
  }

  function getTabProgress(foundationId: FoundationId) {
    const qs = FOUNDATION_QUESTIONS.filter(q => q.foundationId === foundationId);
    const answered = qs.filter(q => {
      const a = getAnswer(companyId!, q.id);
      return a?.status === 'validated' || a?.status === 'deferred';
    }).length;
    const gaps = qs.filter(q => {
      const r = getResultForQuestion(q.id);
      return !r.canInfer && r.gaps.length > 0;
    }).length;
    return { total: qs.length, answered, gaps };
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Strategy Foundations</h1>
            <p className="text-sm text-slate-400 mt-1">
              Hypothesis-first intelligence for {company.name}. The system constructs strategy — you validate.
            </p>
          </div>
          <button
            onClick={() => setCurrentView('stage3')}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Back
          </button>
        </div>

        {/* Evidence Summary bar */}
        {messages.length > 0 && (
          <div className="rounded-[var(--radius-sm)] border border-slate-700 bg-slate-800/40 px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-sm text-slate-300">
                <span className="font-semibold text-white">{analyzedCount}</span> of{' '}
                <span className="font-semibold text-white">{messages.length}</span> evidence pieces analysed
              </span>
            </div>
            <button
              onClick={() => setCurrentView('stage2')}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Add more evidence →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800/60 rounded-[var(--radius-sm)] p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-[var(--radius-sm)] transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab progress + Run Inference */}
        <div className="flex items-center justify-between gap-4">
          {(() => {
            const { total, answered, gaps } = getTabProgress(activeTab as FoundationId);
            return (
              <p className="text-sm text-slate-400">
                <span className="text-white font-medium">{answered}</span> / {total} answered
                {gaps > 0 && (
                  <span className="ml-2 text-amber-400">· {gaps} need more evidence</span>
                )}
              </p>
            );
          })()}
          <div className="flex items-center gap-3">
            {hypothesisCount !== null && (
              <span className="text-xs text-emerald-400">
                ✓ {hypothesisCount} insights generated
              </span>
            )}
            <button
              onClick={runInference}
              disabled={isRunning}
              className="px-4 py-2 text-sm font-medium rounded-[var(--radius-sm)] bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
            >
              {isRunning ? 'Running…' : 'Generate Insights'}
            </button>
          </div>
        </div>

        {/* Question cards */}
        <div className="space-y-4">
          {tabQuestions.map(question => {
            const answer = getAnswer(companyId!, question.id);
            const result = getResultForQuestion(question.id);
            const fb = feedbackMessages[question.id];

            return (
              <div key={question.id} className="space-y-1">
                <FoundationQuestionCard
                  question={question}
                  answer={answer}
                  inferenceResult={result}
                  onDecide={handleDecide}
                />
                {fb && fb.length > 0 && (
                  <div className="ml-1 space-y-0.5">
                    {fb.map((msg, i) => (
                      <p key={i} className="text-xs text-emerald-400 flex items-center gap-1">
                        <span>↳</span> {msg}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Continue button */}
        <div className="flex justify-end pt-4 border-t border-slate-700">
          <button
            onClick={() => setCurrentView('stage4')}
            className="px-6 py-3 text-sm font-bold rounded-[var(--radius-sm)] bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2"
          >
            Continue to Intelligence →
          </button>
        </div>
      </div>
    </div>
  );
}
