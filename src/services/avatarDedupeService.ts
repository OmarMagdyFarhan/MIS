import type { Avatar } from '../types';
import { PIPELINE_THRESHOLDS } from '../constants/pipelineThresholds';

export interface AvatarSimilarityMatch {
  avatarA: Avatar;
  avatarB: Avatar;
  score: number;
  reasons: string[];
}

const SOURCE_PRIORITY: Record<string, number> = {
  mining: 4,
  manual: 3,
  ai: 2,
  competitor: 1,
  mixed: 2,
};

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export function similarityScore(a: Avatar, b: Avatar): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const nameSim = jaccard(tokenize(a.name || ''), tokenize(b.name || ''));
  const descSim = jaccard(
    tokenize(`${a.description || ''} ${a.definingCharacteristic || ''}`),
    tokenize(`${b.description || ''} ${b.definingCharacteristic || ''}`)
  );
  if (a.clusterId && b.clusterId && a.clusterId === b.clusterId) {
    reasons.push('Same cluster');
    return { score: 0.95, reasons };
  }
  const score = nameSim * 0.45 + descSim * 0.55;
  if (nameSim > 0.5) reasons.push('Similar names');
  if (descSim > 0.5) reasons.push('Similar descriptions');
  return { score, reasons };
}

export function findSimilarAvatars(
  avatars: Avatar[],
  threshold = PIPELINE_THRESHOLDS.AVATAR_DEDUPE_SIMILARITY
): AvatarSimilarityMatch[] {
  const active = avatars.filter(a => !a.mergedIntoAvatarId);
  const matches: AvatarSimilarityMatch[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const { score, reasons } = similarityScore(active[i], active[j]);
      if (score >= threshold) {
        matches.push({
          avatarA: active[i],
          avatarB: active[j],
          score,
          reasons,
        });
      }
    }
  }
  return matches.sort((x, y) => y.score - x.score);
}

/** Merge B into A; B marked deprecated with provenance redirect */
export function mergeAvatars(primary: Avatar, secondary: Avatar): Avatar {
  const pick = (field: keyof Avatar) => {
    const pPri = SOURCE_PRIORITY[primary.acquisitionSource || 'ai'] ?? 0;
    const pSec = SOURCE_PRIORITY[secondary.acquisitionSource || 'ai'] ?? 0;
    if (pPri >= pSec) return primary[field];
    return secondary[field] ?? primary[field];
  };

  return {
    ...primary,
    name: String(pick('name') || primary.name),
    description: [primary.description, secondary.description].filter(Boolean).join(' · '),
    definingCharacteristic:
      primary.definingCharacteristic || secondary.definingCharacteristic,
    clusterId: primary.clusterId || secondary.clusterId,
    validationStatus:
      primary.validationStatus === 'validated' || secondary.validationStatus === 'validated'
        ? 'validated'
        : 'provisional',
    acquisitionSource:
      primary.acquisitionSource === secondary.acquisitionSource
        ? primary.acquisitionSource
        : 'mixed',
    mergedFromAvatarIds: [
      ...(primary.mergedFromAvatarIds || []),
      secondary.id,
      ...(secondary.mergedFromAvatarIds || []),
    ],
  };
}

export function deprecateAvatar(avatar: Avatar, mergedIntoId: string): Avatar {
  return {
    ...avatar,
    mergedIntoAvatarId: mergedIntoId,
    validationStatus: 'provisional',
  };
}
