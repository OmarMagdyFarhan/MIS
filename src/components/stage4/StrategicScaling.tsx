import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  HelpCircle, ArrowRight, X, Shield, Loader2,
  Copy, Check, Target, Lightbulb, MessageSquare
} from 'lucide-react';
import { Company, Offer, Avatar } from '../../types';
import { cn } from '../../lib/utils';
import { DotNav } from '../DotNav';
import { usePipelineStore } from '../../stores/pipelineStore';

interface StrategicScalingProps {
  company: Company;
  offer: Offer;
  avatars: Avatar[];
  onComplete: () => void;
}

interface AvatarPriorityItem {
  avatarName: string;
  whyFirst: string;
  messageAngle: string;
  watchOut: string;
}

interface IntelligenceOutput {
  strategicReading: string;
  primaryLever: {
    what: string;
    why: string;
    evidenceBasis: string;
  };
  avatarPriority: AvatarPriorityItem[];
  messagingHypothesis: {
    leadWith: string;
    avoid: string;
    proofPoint: string;
  };
  openQuestions: string[];
}

export const StrategicScaling: React.FC<StrategicScalingProps> = ({ company, offer, avatars, onComplete }) => {
  const [phase, setPhase] = React.useState<'idle' | 'generating' | 'complete' | 'error'>('idle');
  const [output, setOutput] = React.useState<IntelligenceOutput | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const avatarOffersMap = usePipelineStore(s => s.avatarOffers);
  const avatarOffers = React.useMemo(
    () => Object.values(avatarOffersMap).filter(o => o.companyId === company.id),
    [avatarOffersMap, company.id]
  );
  const marketIntel = usePipelineStore(s => s.marketIntelligence[company.id]);
  const mvaProfile = usePipelineStore(s => s.mvaProfiles[company.id]);
  const conversionIntel = usePipelineStore(s => s.conversionIntelligence?.[company.id]);

  const topAvatars = avatars.slice(0, 3);

  const generate = React.useCallback(async () => {
    setPhase('generating');
    setError(null);

    const avatarSummaries = topAvatars.map(av => {
      const offerRecord = avatarOffers.find(o => o.avatarId === av.id);
      return {
        name: av.name,
        formula: offerRecord?.formula,
        emotionalProfile: av.emotionalProfile,
        primaryValueElement: (av as any).primaryValueElement,
      };
    });

    const systemPrompt = `You are a world-class marketing strategist. Your job is to synthesize customer intelligence into actionable strategic output.
Respond ONLY with valid JSON matching the exact schema provided. No markdown, no commentary.`;

    const userMessage = `Company: ${company.name} — ${company.industry}
Offer transformation: ${offer.transformation}

Top avatars (with their offer intelligence):
${JSON.stringify(avatarSummaries, null, 2)}

Market intelligence:
- Core problem: ${marketIntel?.coreProblem ?? 'Unknown'}
- Desired outcome: ${marketIntel?.desiredOutcome ?? 'Unknown'}
- Problem awareness: ${marketIntel?.problemAwarenessLevel ?? 'Unknown'}
- Buyer description: ${marketIntel?.buyerDescription ?? 'Unknown'}

Conversion intelligence:
- Top frustrations: ${JSON.stringify(conversionIntel?.frictionPoints?.slice(0, 5) ?? [])}
- Top trust drivers: ${JSON.stringify(conversionIntel?.trustDrivers?.slice(0, 5) ?? [])}

Respond with this exact JSON:
{
  "strategicReading": "2-3 sentence honest synthesis of what the evidence reveals about this market position",
  "primaryLever": {
    "what": "The single most important strategic lever",
    "why": "Why this lever matters given the evidence",
    "evidenceBasis": "Which specific avatar/insight this is grounded in"
  },
  "avatarPriority": [
    {
      "avatarName": "string",
      "whyFirst": "One sentence grounded in their offer formula and buying triggers",
      "messageAngle": "The specific emotional/rational angle that will resonate",
      "watchOut": "The specific objection or friction most likely to kill conversion"
    }
  ],
  "messagingHypothesis": {
    "leadWith": "The single thing to lead every piece of communication with",
    "avoid": "What to stop saying or emphasizing based on the evidence",
    "proofPoint": "What form of social proof will be most trusted given the trust drivers"
  },
  "openQuestions": ["string", "string", "string"]
}`;

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userMessage, jsonResponse: true }),
      });

      if (!res.ok) throw new Error(`AI call failed: ${res.status}`);
      const raw = await res.json();
      const text = raw.text ?? raw;
      const parsed: IntelligenceOutput = typeof text === 'string' ? JSON.parse(text.replace(/```json|```/g, '').trim()) : text;

      if (!parsed.strategicReading || !parsed.primaryLever) {
        throw new Error('Incomplete AI response — missing required fields');
      }

      setOutput(parsed);
      setPhase('complete');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setPhase('error');
    }
  }, [company, offer, topAvatars, avatarOffers, marketIntel, conversionIntel]);

  React.useEffect(() => {
    if (phase === 'idle') generate();
  }, []);

  const handleCopy = () => {
    if (!output) return;
    const md = [
      `# Strategic Intelligence: ${company.name}`,
      ``,
      `## Strategic Reading`,
      output.strategicReading,
      ``,
      `## Primary Lever`,
      `**${output.primaryLever.what}**`,
      output.primaryLever.why,
      `_Evidence basis: ${output.primaryLever.evidenceBasis}_`,
      ``,
      `## Avatar Priority`,
      ...output.avatarPriority.map((a, i) => [
        `### ${i + 1}. ${a.avatarName}`,
        `Why first: ${a.whyFirst}`,
        `Message angle: ${a.messageAngle}`,
        `Watch out: ${a.watchOut}`,
      ].join('\n')),
      ``,
      `## Messaging Hypothesis`,
      `Lead with: ${output.messagingHypothesis.leadWith}`,
      `Avoid: ${output.messagingHypothesis.avoid}`,
      `Proof point: ${output.messagingHypothesis.proofPoint}`,
      ``,
      `## Open Questions`,
      ...output.openQuestions.map(q => `- ${q}`),
    ].join('\n');

    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="max-w-[960px] mx-auto px-6 py-16 font-sans text-[var(--color-text-primary)]">
      <div className="mb-16">
        <DotNav
          totalSteps={4}
          currentStep={4}
          stepName="INTELLIGENCE SYNTHESIS"
          onStepClick={() => {}}
          isStageComplete={phase === 'complete'}
        />
      </div>

      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A84FF]/8 text-[#0A84FF] rounded-full text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] mb-5">
          <Target size={12} /> Intelligence Output
        </div>
        <h2 className="text-[var(--text-xl)] font-bold tracking-tight leading-tight">
          What the evidence says.
        </h2>
        <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] mt-3 max-w-[600px] leading-relaxed">
          Synthesized from {avatars.length} customer segment{avatars.length !== 1 ? 's' : ''} and {marketIntel ? 'full' : 'partial'} market intelligence.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'generating' && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6 py-24"
          >
            <Loader2 size={32} className="animate-spin text-[#0A84FF]" />
            <div className="text-center">
              <p className="text-[var(--text-base)] font-semibold text-[var(--color-text-primary)]">Synthesizing intelligence…</p>
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-1">Reading your evidence and building strategic output</p>
            </div>
          </motion.div>
        )}

        {phase === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 p-6 flex items-start gap-4">
              <X className="text-rose-500 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-semibold text-rose-700 dark:text-rose-300">Generation failed</p>
                <p className="text-[var(--text-sm)] text-rose-600 dark:text-rose-400 mt-1">{error}</p>
                <button
                  onClick={generate}
                  className="mt-3 text-[var(--text-sm)] font-semibold uppercase tracking-[0.06em] text-rose-600 hover:text-rose-800 transition-colors"
                >
                  Retry →
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {phase === 'complete' && output && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="space-y-8"
          >
            {/* Section 1 — Strategic Reading */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-8">
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Intelligence Synthesis</span>
              <blockquote className="mt-4 text-[var(--text-lg)] font-semibold leading-relaxed text-[var(--color-text-primary)] border-l-4 border-[#0A84FF] pl-6">
                {output.strategicReading}
              </blockquote>
            </div>

            {/* Section 2 — Primary Lever */}
            <div className="rounded-[var(--radius-md)] border border-[#0A84FF]/20 bg-[#0A84FF]/4 p-8">
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[#0A84FF]">Primary Lever</span>
              <h3 className="mt-3 text-[var(--text-xl)] font-bold tracking-tight leading-tight">
                {output.primaryLever.what}
              </h3>
              <p className="mt-3 text-[var(--text-base)] text-[var(--color-text-secondary)] leading-relaxed">
                {output.primaryLever.why}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A84FF]/10 rounded-full">
                <Shield size={12} className="text-[#0A84FF]" />
                <span className="text-[var(--text-xs)] font-semibold text-[#0A84FF]">{output.primaryLever.evidenceBasis}</span>
              </div>
            </div>

            {/* Section 3 — Avatar Priority */}
            <div>
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-secondary)] block mb-4">Avatar Priority</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {output.avatarPriority.map((item, i) => (
                  <motion.div
                    key={item.avatarName}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={cn(
                      'rounded-[var(--radius-md)] border p-6 space-y-4',
                      i === 0
                        ? 'border-[#0A84FF]/30 bg-[#0A84FF]/4 shadow-md'
                        : 'border-[var(--color-border-default)] bg-[var(--color-card-bg)]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-[var(--text-xs)] font-semibold rounded-full w-5 h-5 flex items-center justify-center shrink-0',
                        i === 0 ? 'bg-[#0A84FF] text-white' : 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]'
                      )}>{i + 1}</span>
                      <p className="font-bold text-[var(--text-base)]">{item.avatarName}</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Why first</span>
                        <p className="text-[var(--text-sm)] text-[var(--color-text-primary)] mt-0.5 leading-relaxed">{item.whyFirst}</p>
                      </div>
                      <div>
                        <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">Message angle</span>
                        <p className="text-[var(--text-sm)] text-[var(--color-text-primary)] mt-0.5 leading-relaxed">{item.messageAngle}</p>
                      </div>
                      <div className="rounded-[var(--radius-sm)] bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3">
                        <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-rose-600 dark:text-rose-400">Watch out</span>
                        <p className="text-[var(--text-sm)] text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">{item.watchOut}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Section 4 — Messaging Hypothesis */}
            <div>
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-secondary)] block mb-4">Messaging Hypothesis</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Lead with', value: output.messagingHypothesis.leadWith, icon: <ArrowRight size={14} className="text-emerald-600" />, color: 'emerald' },
                  { label: 'Avoid', value: output.messagingHypothesis.avoid, icon: <X size={14} className="text-rose-600" />, color: 'rose' },
                  { label: 'Proof point', value: output.messagingHypothesis.proofPoint, icon: <Shield size={14} className="text-blue-600" />, color: 'blue' },
                ].map(item => (
                  <div key={item.label} className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-6">
                    <div className="flex items-center gap-2 mb-3">
                      {item.icon}
                      <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">{item.label}</span>
                    </div>
                    <p className="text-[var(--text-base)] font-semibold leading-relaxed">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5 — Open Questions */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-8">
              <div className="flex items-center gap-2 mb-5">
                <HelpCircle size={16} className="text-[var(--color-text-secondary)]" />
                <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">What the evidence doesn't yet answer</span>
              </div>
              <ul className="space-y-3">
                {output.openQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <HelpCircle size={14} className="text-[var(--color-text-secondary)] mt-0.5 shrink-0" />
                    <p className="text-[var(--text-base)] text-[var(--color-text-primary)] leading-relaxed">{q}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 6 — Copy + Done actions */}
            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={handleCopy}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-[var(--radius-md)] border font-semibold text-[var(--text-base)] transition-all',
                  copied
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                    : 'border-[var(--color-border-default)] bg-[var(--color-card-bg)] text-[var(--color-text-primary)] hover:border-[#0A84FF]/40 hover:bg-[#0A84FF]/4'
                )}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy the Strategy'}
              </button>
              <button
                onClick={generate}
                className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] text-[var(--text-sm)] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <Loader2 size={14} />
                Regenerate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
