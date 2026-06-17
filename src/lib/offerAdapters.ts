import type { Avatar, Offer } from '../types';
import type { AvatarOfferRecord, OfferFormula, OfferRendered } from '../types/pipeline';

export function emptyOfferFormula(): OfferFormula {
  return {
    audience: '',
    product: '',
    transformation: '',
    reasonToActNow: '',
    specificity: '',
  };
}

/** Avatar targetedOffer → AvatarOfferRecord */
export function avatarToOfferRecord(
  avatar: Avatar,
  clusterId: string,
  corpusVersion: number
): AvatarOfferRecord | null {
  if (!avatar.targetedOffer) return null;
  const t = avatar.targetedOffer;
  return {
    id: `ao_${avatar.id}`,
    companyId: avatar.companyId,
    avatarId: avatar.id,
    clusterId,
    formula: {
      audience: avatar.name,
      product: t.offerName || '',
      transformation: t.transformation || '',
      reasonToActNow: t.reasoning || '',
      specificity: t.hook || '',
    },
    validationStatus: avatar.validationStatus || 'provisional',
    confidence: defaultConfidence(
      typeof avatar.score === 'number' ? avatar.score / 10 : 0.4,
      avatar.validationStatus || 'provisional',
      0
    ),
    derivedFrom: {
      corpusVersion,
      avatarId: avatar.id,
      clusterId,
    },
    rendered: {
      hook: t.hook,
      offerName: t.offerName,
      longCopy: t.transformation,
    },
    score: t.score,
    updatedAt: new Date().toISOString(),
  };
}

/** AvatarOfferRecord formula → avatar.targetedOffer shape */
export function offerRecordToTargetedOffer(record: AvatarOfferRecord): Avatar['targetedOffer'] {
  const f = record.formula;
  const r = record.rendered;
  return {
    offerName: r?.offerName || f.product,
    transformation: f.transformation,
    hook: r?.hook || f.specificity,
    reasoning: f.reasonToActNow,
    score: record.score,
  };
}

export function defaultConfidence(
  overall: number,
  status: 'provisional' | 'validated',
  messageCount: number
): import('../types/pipeline').ConfidenceSnapshot {
  const vol = Math.min(1, messageCount / 15);
  return {
    overall: Math.min(1, Math.max(0, overall)),
    dimensions: {
      evidenceVolume: vol,
      clusterCohesion: overall * 0.9,
      offerEvidenceAlignment: overall * 0.85,
      crossSegmentAgreement: overall * 0.8,
    },
    status,
    reasons: messageCount < 3 ? ['Limited evidence volume'] : [],
    computedAt: new Date().toISOString(),
    corpusVersion: 0,
  };
}

export function mergeFormula(base: OfferFormula, patch: Partial<OfferFormula>): OfferFormula {
  return { ...base, ...patch };
}
