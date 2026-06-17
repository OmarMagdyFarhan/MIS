import React from 'react';
import { motion } from 'motion/react';
import { GitMerge, Users } from 'lucide-react';
import type { Avatar } from '../../types';
import {
  findSimilarAvatars,
  mergeAvatars,
  deprecateAvatar,
  type AvatarSimilarityMatch,
} from '../../services/avatarDedupeService';
import { PIPELINE_THRESHOLDS } from '../../constants/pipelineThresholds';
import { cn } from '../../lib/utils';

interface Props {
  avatars: Avatar[];
  onMergeComplete: (updated: Avatar[]) => void;
}

export const AvatarMergePanel: React.FC<Props> = ({ avatars, onMergeComplete }) => {
  const [matches, setMatches] = React.useState<AvatarSimilarityMatch[]>([]);
  const [comparing, setComparing] = React.useState<AvatarSimilarityMatch | null>(null);

  React.useEffect(() => {
    setMatches(findSimilarAvatars(avatars));
  }, [avatars]);

  const applyMerge = (match: AvatarSimilarityMatch, keep: 'a' | 'b') => {
    const primary = keep === 'a' ? match.avatarA : match.avatarB;
    const secondary = keep === 'a' ? match.avatarB : match.avatarA;
    const merged = mergeAvatars(primary, secondary);
    const deprecated = deprecateAvatar(secondary, merged.id);
    const next = avatars.map(a => {
      if (a.id === merged.id) return merged;
      if (a.id === secondary.id) return deprecateAvatar(a, merged.id);
      return a;
    });
    onMergeComplete(next.filter(a => !a.mergedIntoAvatarId));
    setComparing(null);
    setMatches(findSimilarAvatars(next.filter(a => !a.mergedIntoAvatarId)));
  };

  if (!matches.length) return null;

  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border p-6 space-y-4',
        'border-amber-500/30 bg-amber-900/10'
      )}
    >
      <div className="flex items-center gap-2">
        <Users size={18} className="text-amber-700" />
        <h4 className="text-[var(--text-base)] font-semibold uppercase tracking-[0.06em] text-amber-900">
          Possible duplicate segments ({matches.length})
        </h4>
      </div>
      <p className="text-[var(--text-sm)] text-amber-800/80">
        Similarity threshold: {Math.round(PIPELINE_THRESHOLDS.AVATAR_DEDUPE_SIMILARITY * 100)}%.
        Merge preserves validated mining evidence over AI bootstrap.
      </p>

      {matches.slice(0, 5).map(match => (
        <div
          key={`${match.avatarA.id}-${match.avatarB.id}`}
          className="p-4 rounded-[var(--radius-md)] bg-white/80 dark:bg-black/20 space-y-3"
        >
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-sm)] font-bold">
              {match.avatarA.name} ↔ {match.avatarB.name} ·{' '}
              {Math.round(match.score * 100)}% match
            </span>
            <button
              type="button"
              onClick={() => setComparing(comparing ? null : match)}
              className="text-[var(--text-xs)] font-semibold uppercase text-[#0A84FF]"
            >
              {comparing === match ? 'Hide' : 'Compare'}
            </button>
          </div>
          {match.reasons.length > 0 && (
            <p className="text-[var(--text-xs)] text-[#86868B]">{match.reasons.join(' · ')}</p>
          )}

          {comparing === match && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid md:grid-cols-2 gap-3 text-[var(--text-sm)]"
            >
              {(['a', 'b'] as const).map(side => {
                const av = side === 'a' ? match.avatarA : match.avatarB;
                return (
                  <div key={av.id} className="p-3 rounded-[var(--radius-sm)] border border-[#F5F5F7]">
                    <div className="font-semibold text-[var(--text-xs)] uppercase text-[#86868B] mb-2">
                      {av.name} ({av.acquisitionSource || 'unknown'})
                    </div>
                    <p className="text-[#515154]">{av.description?.slice(0, 120)}</p>
                    <p className="mt-2 text-[var(--text-xs)] text-[#86868B]">
                      {av.validationStatus === 'validated' ? 'Confirmed' : 'Early Insight'}
                      {av.clusterId ? ` · cluster ${av.clusterId.slice(0, 8)}…` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => applyMerge(match, side)}
                      className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[#1D1D1F] text-white text-[var(--text-xs)] font-semibold uppercase"
                    >
                      <GitMerge size={12} /> Keep this one
                    </button>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
};
