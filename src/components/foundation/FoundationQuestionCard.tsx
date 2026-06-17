import React, { useState } from 'react';
import type { FoundationQuestion } from '../../types/foundation';
import type { FoundationAnswer, EvidenceQuality } from '../../types/foundation';
import type { InferenceResult } from '../../services/foundationInferenceService';

interface Props {
  question: FoundationQuestion;
  answer: FoundationAnswer | undefined;
  inferenceResult: InferenceResult;
  onDecide: (answer: FoundationAnswer) => void;
}

function EvidenceQualityBadge({ quality }: { quality: EvidenceQuality }) {
  const styles: Record<EvidenceQuality, string> = {
    low:    'bg-red-900/50 text-red-400 border border-red-800',
    medium: 'bg-amber-900/50 text-amber-400 border border-amber-800',
    high:   'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[quality]}`}>
      {quality.charAt(0).toUpperCase() + quality.slice(1)}
    </span>
  );
}

function SignalBar({ value }: { value: number }) {
  const filled = Math.round(value * 10);
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-2 rounded-sm ${i < filled ? 'bg-indigo-500' : 'bg-slate-700'}`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400">{pct}%</span>
    </div>
  );
}

export function FoundationQuestionCard({
  question,
  answer,
  inferenceResult,
  onDecide,
}: Props) {
  const [customInput, setCustomInput] = useState('');
  const [selected, setSelected] = useState<string>('primary');

  // ── State 4: validated or deferred ─────────────────────────────────────────
  if (answer?.status === 'validated' || answer?.status === 'deferred') {
    const display = answer.status === 'deferred'
      ? 'Deferred — research later'
      : (answer.chosenValue ?? '—');

    return (
      <div className="rounded-[var(--radius-sm)] border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">
              {question.label}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </p>
            <p className="text-sm text-slate-200 flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              {display}
            </p>
          </div>
          <button
            onClick={() => onDecide({ ...answer, status: 'inferred' })}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  // ── State 2: gap detected ───────────────────────────────────────────────────
  if (!inferenceResult.canInfer && inferenceResult.gaps.length > 0) {
    const gap = inferenceResult.gaps[0];
    const priorityColors: Record<string, string> = {
      critical: 'border-red-700 bg-red-900/20',
      high:     'border-amber-700 bg-amber-900/20',
      medium:   'border-amber-700/50 bg-amber-900/10',
      low:      'border-slate-700 bg-slate-800/40',
    };

    return (
      <div className={`rounded-[var(--radius-sm)] border p-4 space-y-3 ${priorityColors[gap.priority] ?? priorityColors.low}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            {question.label}
            {question.isRequired && <span className="text-red-500 ml-1">*</span>}
          </p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
            gap.priority === 'critical' ? 'bg-red-900/50 text-red-400 border-red-800' :
            gap.priority === 'high'     ? 'bg-amber-900/50 text-amber-400 border-amber-800' :
            'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {gap.priority}
          </span>
        </div>

        <div className="flex items-start gap-2">
          <span className="text-amber-400 text-sm">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-300">Research Required</p>
            <p className="text-xs text-slate-400 mt-0.5">
              What&apos;s missing: {gap.description}
            </p>
            <p className="text-xs text-slate-500 mt-1 italic">
              Suggested research: {gap.researchQuestion}
            </p>
          </div>
        </div>

        <GapInputRow
          question={question}
          customInput={customInput}
          setCustomInput={setCustomInput}
          onManual={() => {
            if (!customInput.trim()) return;
            onDecide({
              questionId: question.id,
              foundationId: question.foundationId,
              status: 'validated',
              overallSignalStrength: 0,
              overallEvidenceQuality: 'low',
              userChoice: 'custom',
              customValue: customInput,
              chosenValue: customInput,
              chosenAt: new Date().toISOString(),
              feedbackApplied: false,
            });
          }}
          onDefer={() => {
            onDecide({
              questionId: question.id,
              foundationId: question.foundationId,
              status: 'deferred',
              overallSignalStrength: 0,
              overallEvidenceQuality: 'low',
              userChoice: 'deferred',
              chosenAt: new Date().toISOString(),
              feedbackApplied: false,
            });
          }}
        />
      </div>
    );
  }

  // ── State 1: not inferable, no gap ─────────────────────────────────────────
  if (!inferenceResult.canInfer) {
    return (
      <div className="rounded-[var(--radius-sm)] border border-slate-700 bg-slate-800/40 p-4 space-y-3">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
          {question.label}
          {question.isRequired && <span className="text-red-500 ml-1">*</span>}
        </p>
        <p className="text-xs text-slate-500">{question.description}</p>
        <GapInputRow
          question={question}
          customInput={customInput}
          setCustomInput={setCustomInput}
          label="Enter manually"
          onManual={() => {
            if (!customInput.trim()) return;
            onDecide({
              questionId: question.id,
              foundationId: question.foundationId,
              status: 'validated',
              overallSignalStrength: 0,
              overallEvidenceQuality: 'low',
              userChoice: 'custom',
              customValue: customInput,
              chosenValue: customInput,
              chosenAt: new Date().toISOString(),
              feedbackApplied: false,
            });
          }}
          onDefer={() => {
            onDecide({
              questionId: question.id,
              foundationId: question.foundationId,
              status: 'deferred',
              overallSignalStrength: 0,
              overallEvidenceQuality: 'low',
              userChoice: 'deferred',
              chosenAt: new Date().toISOString(),
              feedbackApplied: false,
            });
          }}
        />
      </div>
    );
  }

  // ── State 3: hypothesis available ──────────────────────────────────────────
  const { primary, alternatives = [] } = inferenceResult;
  const options = [
    primary ? { key: 'primary', label: primary.value } : null,
    ...alternatives.map((a, i) => ({ key: `alternative_${i}`, label: a.value })),
    { key: 'custom', label: 'Custom answer...' },
    { key: 'deferred', label: 'Research later (defer)' },
  ].filter(Boolean) as { key: string; label: string }[];

  function handleConfirm() {
    if (selected === 'deferred') {
      onDecide({
        questionId: question.id,
        foundationId: question.foundationId,
        status: 'deferred',
        primarySuggestion: primary,
        alternatives,
        overallSignalStrength: inferenceResult.overallSignalStrength,
        overallEvidenceQuality: inferenceResult.overallEvidenceQuality,
        userChoice: 'deferred',
        chosenAt: new Date().toISOString(),
        feedbackApplied: false,
      });
      return;
    }

    let chosenValue = '';
    let userChoice: FoundationAnswer['userChoice'] = 'primary';

    if (selected === 'custom') {
      if (!customInput.trim()) return;
      chosenValue = customInput;
      userChoice = 'custom';
    } else if (selected === 'primary') {
      chosenValue = primary?.value ?? '';
      userChoice = 'primary';
    } else if (selected.startsWith('alternative_')) {
      const idx = parseInt(selected.replace('alternative_', ''), 10);
      chosenValue = alternatives[idx]?.value ?? '';
      userChoice = selected as FoundationAnswer['userChoice'];
    }

    onDecide({
      questionId: question.id,
      foundationId: question.foundationId,
      status: 'validated',
      primarySuggestion: primary,
      alternatives,
      overallSignalStrength: inferenceResult.overallSignalStrength,
      overallEvidenceQuality: inferenceResult.overallEvidenceQuality,
      userChoice,
      customValue: selected === 'custom' ? customInput : undefined,
      chosenValue,
      chosenAt: new Date().toISOString(),
      feedbackApplied: false,
    });
  }

  return (
    <div className="rounded-[var(--radius-sm)] border border-indigo-800/50 bg-slate-800/60 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
          {question.label}
          {question.isRequired && <span className="text-red-500 ml-1">*</span>}
        </p>
        <span className="text-xs font-semibold text-indigo-300 shrink-0">
          Current Best Hypothesis
        </span>
      </div>

      {/* Signal + Evidence Quality — always together */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Signal</span>
          <SignalBar value={inferenceResult.overallSignalStrength} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Evidence Quality</span>
          <EvidenceQualityBadge quality={inferenceResult.overallEvidenceQuality} />
        </div>
        {primary && (
          <span className="text-xs text-slate-600">
            Source: {primary.sources.join(', ')}
          </span>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2">
        {options.map(opt => (
          <label
            key={opt.key}
            className={`flex items-start gap-3 p-3 rounded-[var(--radius-sm)] cursor-pointer transition-colors ${
              selected === opt.key
                ? 'bg-indigo-900/40 border border-indigo-700'
                : 'bg-slate-700/30 border border-slate-700 hover:bg-slate-700/50'
            }`}
          >
            <input
              type="radio"
              name={`foundation-${question.id}`}
              value={opt.key}
              checked={selected === opt.key}
              onChange={() => setSelected(opt.key)}
              className="mt-0.5 accent-indigo-500"
            />
            <span className="text-sm text-slate-200">{opt.label}</span>
          </label>
        ))}
      </div>

      {/* Custom input */}
      {selected === 'custom' && (
        <input
          type={question.inputType === 'number' ? 'number' : 'text'}
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          placeholder={question.placeholder ?? 'Enter your answer…'}
          className="w-full px-3 py-2 text-sm rounded-[var(--radius-sm)] bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      )}

      {/* Reasoning */}
      {primary?.reasoning && (
        <p className="text-xs text-slate-500 italic">{primary.reasoning}</p>
      )}

      {/* Confirm */}
      <button
        onClick={handleConfirm}
        className="w-full py-2 text-sm font-medium rounded-[var(--radius-sm)] bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        Confirm hypothesis →
      </button>
    </div>
  );
}

// ── Shared gap/manual input row ──────────────────────────────────────────────

function GapInputRow({
  question,
  customInput,
  setCustomInput,
  label = 'Enter manually',
  onManual,
  onDefer,
}: {
  question: FoundationQuestion;
  customInput: string;
  setCustomInput: (v: string) => void;
  label?: string;
  onManual: () => void;
  onDefer: () => void;
}) {
  return (
    <div className="space-y-2">
      <input
        type={question.inputType === 'number' ? 'number' : 'text'}
        value={customInput}
        onChange={e => setCustomInput(e.target.value)}
        placeholder={question.placeholder ?? question.description}
        className="w-full px-3 py-2 text-sm rounded-[var(--radius-sm)] bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex gap-2">
        <button
          onClick={onManual}
          className="flex-1 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] bg-slate-600 hover:bg-slate-500 text-white transition-colors"
        >
          {label}
        </button>
        <button
          onClick={onDefer}
          className="flex-1 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] bg-slate-700/50 hover:bg-slate-700 text-slate-400 transition-colors"
        >
          Mark as unknown
        </button>
      </div>
    </div>
  );
}
