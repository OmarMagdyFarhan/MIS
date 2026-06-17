import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare } from 'lucide-react';
import { resolveEmotion } from '../../lib/emotionMap';
import type { SpecificEmotion, MidEmotion, CoreEmotion } from '../../types';
import type { EvidenceMessage } from '../../types/pipeline';

// ── Wheel data ────────────────────────────────────────────────────────────────

const CORE_COLORS: Record<CoreEmotion, { bg: string; light: string; text: string; mid: string }> = {
  Happy:     { bg: '#F5E642', light: '#FEFCE8', text: '#713F12', mid: '#CA8A04' },
  Surprised: { bg: '#A78BFA', light: '#F5F3FF', text: '#4C1D95', mid: '#7C3AED' },
  Bad:       { bg: '#6EE7B7', light: '#ECFDF5', text: '#064E3B', mid: '#059669' },
  Fearful:   { bg: '#FDE68A', light: '#FFFBEB', text: '#78350F', mid: '#D97706' },
  Angry:     { bg: '#FCA5A5', light: '#FEF2F2', text: '#7F1D1D', mid: '#DC2626' },
  Disgusted: { bg: '#CBD5E1', light: '#F8FAFC', text: '#1E293B', mid: '#64748B' },
  Sad:       { bg: '#93C5FD', light: '#EFF6FF', text: '#1E3A8A', mid: '#2563EB' },
};

// Mid emotions grouped under each core
const CORE_TO_MIDS: Record<CoreEmotion, MidEmotion[]> = {
  Happy:     ['Playful', 'Content', 'Interested', 'Proud', 'Accepted', 'Powerful', 'Peaceful', 'Trusting', 'Optimistic'],
  Surprised: ['Startled', 'Confused', 'Amazed', 'Excited'],
  Bad:       ['Bored', 'Busy', 'Stressed', 'Tired'],
  Fearful:   ['Scared', 'Anxious', 'Insecure', 'Weak', 'Rejected', 'Threatened'],
  Angry:     ['Mad', 'Aggressive', 'Frustrated', 'Distant', 'Critical'],
  Disgusted: ['Disapproving', 'Awful', 'Repelled'],
  Sad:       ['Disappointing', 'Hurt', 'Guilty', 'Despair', 'Vulnerable', 'Lonely'],
};

const CORE_ORDER: CoreEmotion[] = ['Happy', 'Surprised', 'Bad', 'Fearful', 'Angry', 'Disgusted', 'Sad'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmotionCount {
  core: CoreEmotion;
  mid: MidEmotion;
  specific: SpecificEmotion;
  count: number;
  messages: EvidenceMessage[];
}

interface FeelWheelProps {
  messages: EvidenceMessage[];
}

// ── Helper: build counts from messages ───────────────────────────────────────

function buildEmotionCounts(messages: EvidenceMessage[]): {
  byCoreEmotion: Record<CoreEmotion, number>;
  byMidEmotion: Record<string, number>;
  bySpecific: EmotionCount[];
  totalWithEmotion: number;
} {
  const byCoreEmotion: Record<string, number> = {};
  const byMidEmotion: Record<string, number> = {};
  const bySpecificMap: Record<string, { count: number; messages: EvidenceMessage[]; core: CoreEmotion; mid: MidEmotion; specific: SpecificEmotion }> = {};
  let totalWithEmotion = 0;

  for (const msg of messages) {
    const emotion = msg.analysis?.emotion;
    if (!emotion) continue;
    const resolved = resolveEmotion(emotion);
    totalWithEmotion++;

    byCoreEmotion[resolved.core] = (byCoreEmotion[resolved.core] ?? 0) + 1;
    byMidEmotion[resolved.mid] = (byMidEmotion[resolved.mid] ?? 0) + 1;

    const key = resolved.specific;
    if (!bySpecificMap[key]) {
      bySpecificMap[key] = { count: 0, messages: [], core: resolved.core, mid: resolved.mid, specific: resolved.specific };
    }
    bySpecificMap[key].count++;
    bySpecificMap[key].messages.push(msg);
  }

  return {
    byCoreEmotion: byCoreEmotion as Record<CoreEmotion, number>,
    byMidEmotion,
    bySpecific: Object.values(bySpecificMap).sort((a, b) => b.count - a.count),
    totalWithEmotion,
  };
}

// ── SVG Wheel ─────────────────────────────────────────────────────────────────

function polarToXY(angle: number, r: number, cx: number, cy: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = polarToXY(startAngle, r, cx, cy);
  const e = polarToXY(endAngle, r, cx, cy);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

function ringPath(cx: number, cy: number, r1: number, r2: number, startAngle: number, endAngle: number) {
  const s1 = polarToXY(startAngle, r1, cx, cy);
  const e1 = polarToXY(endAngle, r1, cx, cy);
  const s2 = polarToXY(startAngle, r2, cx, cy);
  const e2 = polarToXY(endAngle, r2, cx, cy);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s1.x} ${s1.y} A ${r1} ${r1} 0 ${large} 1 ${e1.x} ${e1.y} L ${e2.x} ${e2.y} A ${r2} ${r2} 0 ${large} 0 ${s2.x} ${s2.y} Z`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export const FeelWheel: React.FC<FeelWheelProps> = ({ messages }) => {
  const [selectedCore, setSelectedCore] = React.useState<CoreEmotion | null>(null);
  const [selectedSpecific, setSelectedSpecific] = React.useState<EmotionCount | null>(null);

  const { byCoreEmotion, byMidEmotion, bySpecific, totalWithEmotion } = React.useMemo(
    () => buildEmotionCounts(messages),
    [messages]
  );

  const maxCore = Math.max(...Object.values(byCoreEmotion), 1);

  const SIZE = 320;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R_INNER = 44;   // core label ring
  const R_MID   = 88;   // mid ring
  const R_OUTER = 130;  // specific ring (outer edge)
  const GAP = 1.5;      // degrees gap between segments

  // Build angle allocations per core (proportional to count, minimum slice for visibility)
  const totalAngle = 360;
  const coreAngles: { core: CoreEmotion; start: number; end: number; angle: number }[] = [];

  // Give each core at least 15° if it has any data, proportional otherwise
  const coreData = CORE_ORDER.map(c => ({ core: c, count: byCoreEmotion[c] ?? 0 }));
  const totalCount = coreData.reduce((s, c) => s + c.count, 0) || 1;
  // minimum 15° for cores with data, 8° for empty
  const MIN_WITH = 20;
  const MIN_WITHOUT = 6;
  let rawAngles = coreData.map(c => {
    if (c.count > 0) return Math.max(MIN_WITH, (c.count / totalCount) * totalAngle);
    return MIN_WITHOUT;
  });
  const rawSum = rawAngles.reduce((s, a) => s + a, 0);
  rawAngles = rawAngles.map(a => (a / rawSum) * totalAngle);

  let cursor = 0;
  coreData.forEach((c, i) => {
    const angle = rawAngles[i];
    coreAngles.push({ core: c.core, start: cursor + GAP / 2, end: cursor + angle - GAP / 2, angle });
    cursor += angle;
  });

  // For each core segment, split mid ring proportionally
  const midSegments: { core: CoreEmotion; mid: MidEmotion; start: number; end: number; count: number }[] = [];
  coreAngles.forEach(cs => {
    const mids = CORE_TO_MIDS[cs.core];
    const midCounts = mids.map(m => byMidEmotion[m] ?? 0);
    const total = midCounts.reduce((s, c) => s + c, 0) || 1;
    const coreSpan = cs.end - cs.start;
    let mCursor = cs.start;
    mids.forEach((mid, i) => {
      const mAngle = (midCounts[i] / total) * coreSpan;
      if (mAngle > 0.5) {
        midSegments.push({ core: cs.core, mid, start: mCursor + GAP / 4, end: mCursor + mAngle - GAP / 4, count: midCounts[i] });
      }
      mCursor += mAngle;
    });
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <span className="text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.3em]">Feel Wheel</span>
          <div className="text-[var(--text-xs)] text-[var(--color-text-secondary)] font-medium mt-0.5">
            {totalWithEmotion} messages mapped
          </div>
        </div>
        {selectedCore && (
          <button
            onClick={() => setSelectedCore(null)}
            className="text-[var(--text-xs)] font-semibold text-[#0A84FF] uppercase tracking-[0.06em] hover:bg-[#0A84FF]/5 px-3 py-1.5 rounded-full transition-all"
          >
            ← All
          </button>
        )}
      </div>

      {totalWithEmotion === 0 ? (
        <div className="flex flex-col items-center gap-3 p-10 border-2 border-dashed border-[var(--color-border-default)] rounded-[var(--radius-md)] text-center">
          <span className="text-3xl">🎡</span>
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] font-medium">
            Run the pipeline to map emotions from your evidence.
          </p>
        </div>
      ) : (
        <>
          {/* SVG Wheel */}
          <div className="flex justify-center">
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="overflow-visible">
              {/* Core segments (inner ring) */}
              {coreAngles.map(({ core, start, end, angle }) => {
                const count = byCoreEmotion[core] ?? 0;
                const colors = CORE_COLORS[core];
                const isSelected = selectedCore === core;
                const isDimmed = selectedCore && !isSelected;
                const mid = (start + end) / 2;
                const labelPos = polarToXY(mid, R_INNER * 0.62, CX, CY);

                return (
                  <g key={core}>
                    <motion.path
                      d={arcPath(CX, CY, R_INNER, start, end)}
                      fill={colors.bg}
                      stroke="var(--color-primary-bg)"
                      strokeWidth={1.5}
                      animate={{ opacity: isDimmed ? 0.25 : 1, scale: isSelected ? 1.04 : 1 }}
                      style={{ cursor: count > 0 ? 'pointer' : 'default', transformOrigin: `${CX}px ${CY}px` }}
                      onClick={() => count > 0 && setSelectedCore(isSelected ? null : core)}
                      whileHover={count > 0 ? { scale: 1.06 } : {}}
                      transition={{ duration: 0.2 }}
                    />
                    {angle > 25 && (
                      <text
                        x={labelPos.x} y={labelPos.y}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={count > 0 ? 7.5 : 6.5}
                        fontWeight="800"
                        fill={colors.text}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {core}
                      </text>
                    )}
                    {count > 0 && (
                      <text
                        x={labelPos.x} y={labelPos.y + 8}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={6}
                        fontWeight="700"
                        fill={colors.text}
                        opacity={0.7}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {count}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Mid ring */}
              {midSegments.map(({ core, mid, start, end, count }) => {
                const colors = CORE_COLORS[core];
                const isCoreSel = selectedCore === core;
                const isDimmed = selectedCore && !isCoreSel;
                const midAngle = (start + end) / 2;
                const labelPos = polarToXY(midAngle, (R_INNER + R_MID) / 2, CX, CY);
                const spanAngle = end - start;

                return (
                  <g key={`mid-${mid}`}>
                    <motion.path
                      d={ringPath(CX, CY, R_INNER, R_MID, start, end)}
                      fill={count > 0 ? colors.mid : '#E2E8F0'}
                      fillOpacity={count > 0 ? (0.35 + (count / Math.max(byMidEmotion[mid] ?? 1, 1)) * 0.5) : 0.2}
                      stroke="var(--color-primary-bg)"
                      strokeWidth={1}
                      animate={{ opacity: isDimmed ? 0.15 : 1 }}
                      transition={{ duration: 0.2 }}
                    />
                    {spanAngle > 12 && (
                      <text
                        x={labelPos.x} y={labelPos.y}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={5.5}
                        fontWeight="700"
                        fill={count > 0 ? colors.text : '#94A3B8'}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                        transform={`rotate(${midAngle - 90}, ${labelPos.x}, ${labelPos.y})`}
                      >
                        {mid}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Outer ring: specific emotions (dots for active) */}
              {coreAngles.map(({ core, start, end }) => {
                const colors = CORE_COLORS[core];
                const isCoreSel = selectedCore === core;
                const isDimmed = selectedCore && !isCoreSel;
                const specifics = bySpecific.filter(s => s.core === core);
                if (specifics.length === 0) return null;
                const coreSpan = end - start;
                const sliceAngle = coreSpan / specifics.length;

                return specifics.map((sp, i) => {
                  const a = start + i * sliceAngle + sliceAngle / 2;
                  const r = R_MID + 8 + Math.min((sp.count / maxCore) * (R_OUTER - R_MID - 16), R_OUTER - R_MID - 16);
                  const pos = polarToXY(a, r, CX, CY);

                  return (
                    <motion.circle
                      key={`sp-${sp.specific}`}
                      cx={pos.x} cy={pos.y}
                      r={3.5 + sp.count * 0.8}
                      fill={colors.bg}
                      stroke={colors.mid}
                      strokeWidth={1.5}
                      animate={{ opacity: isDimmed ? 0.1 : isCoreSel ? 1 : 0.7 }}
                      style={{ cursor: 'pointer', transformOrigin: `${pos.x}px ${pos.y}px` }}
                      whileHover={{ scale: 1.5 }}
                      onClick={() => setSelectedSpecific(selectedSpecific?.specific === sp.specific ? null : sp)}
                      transition={{ duration: 0.2 }}
                    />
                  );
                });
              })}

              {/* Center */}
              <circle cx={CX} cy={CY} r={18} fill="var(--color-card-elevated)" stroke="var(--color-border-default)" strokeWidth={1} />
              <text x={CX} y={CY - 4} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontWeight="900" fill="var(--color-text-secondary)" style={{ userSelect: 'none' }}>
                FEEL
              </text>
              <text x={CX} y={CY + 6} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontWeight="900" fill="var(--color-text-secondary)" style={{ userSelect: 'none' }}>
                WHEEL
              </text>
            </svg>
          </div>

          {/* Filtered emotion list */}
          <div className="space-y-2">
            {(selectedCore
              ? bySpecific.filter(s => s.core === selectedCore)
              : bySpecific.slice(0, 6)
            ).map(sp => {
              const colors = CORE_COLORS[sp.core];
              return (
                <button
                  key={sp.specific}
                  onClick={() => setSelectedSpecific(selectedSpecific?.specific === sp.specific ? null : sp)}
                  className="w-full flex items-center gap-3 p-3 rounded-[var(--radius-md)] hover:bg-[var(--color-slate-elevated)] transition-all text-left"
                  style={{ background: selectedSpecific?.specific === sp.specific ? colors.light : undefined }}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-xs)] font-semibold shrink-0" style={{ background: colors.bg, color: colors.text }}>
                    {sp.count}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[var(--text-sm)] font-bold text-[var(--color-text-primary)]">{sp.specific}</div>
                    <div className="text-[var(--text-xs)] text-[var(--color-text-secondary)] font-medium">{sp.mid} · {sp.core}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[var(--text-xs)] font-semibold text-[var(--color-text-secondary)]">
                    <MessageSquare size={10} />
                    {sp.count}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Message drawer */}
          <AnimatePresence>
            {selectedSpecific && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-[var(--radius-md)] border overflow-hidden"
                style={{ borderColor: CORE_COLORS[selectedSpecific.core].mid + '40' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: CORE_COLORS[selectedSpecific.core].light }}
                >
                  <div>
                    <span className="text-[var(--text-xs)] font-semibold" style={{ color: CORE_COLORS[selectedSpecific.core].text }}>
                      {selectedSpecific.specific}
                    </span>
                    <span className="text-[var(--text-xs)] font-medium ml-2" style={{ color: CORE_COLORS[selectedSpecific.core].mid }}>
                      {selectedSpecific.count} message{selectedSpecific.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedSpecific(null)}
                    className="w-6 h-6 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: CORE_COLORS[selectedSpecific.core].text }}
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="divide-y divide-[var(--color-border-default)] max-h-48 overflow-y-auto custom-scrollbar">
                  {selectedSpecific.messages.map(m => (
                    <div key={m.id} className="px-4 py-3">
                      <p className="text-[var(--text-sm)] text-[var(--color-text-primary)] leading-relaxed">
                        "{m.rawText?.slice(0, 200)}{(m.rawText?.length ?? 0) > 200 ? '…' : ''}"
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};
