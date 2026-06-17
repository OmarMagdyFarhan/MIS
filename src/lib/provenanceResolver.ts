import type { Avatar } from '../types';
import { getClaimSources } from '../types';
import type {
  AvatarOfferRecord,
  Cluster,
  ConfidenceSnapshot,
  EvidenceMessage,
  ProvenanceLink,
} from '../types/pipeline';

export interface EvidenceQuoteRef {
  id: string;
  displayIndex: number;
  excerpt: string;
  source?: EvidenceMessage['source'];
}

export interface ProvenanceExplainability {
  field: string;
  label: string;
  value: string;
  evidenceQuotes: EvidenceQuoteRef[];
  cluster?: { id: string; label: string; cohesionScore?: number };
  confidence?: ConfidenceSnapshot;
  acquisitionSource?: string;
  derivationPath: string[];
  provenanceLinks: ProvenanceLink[];
}

function quoteIndex(messages: EvidenceMessage[], id: string): number {
  const idx = messages.findIndex(m => m.id === id);
  return idx >= 0 ? idx + 1 : 0;
}

function quotesFromIds(
  messageIds: string[] | undefined,
  messages: EvidenceMessage[]
): EvidenceQuoteRef[] {
  if (!messageIds?.length) return [];
  const refs: EvidenceQuoteRef[] = [];
  for (const id of messageIds) {
    const m = messages.find(x => x.id === id);
    if (!m) continue;
    refs.push({
      id,
      displayIndex: quoteIndex(messages, id),
      excerpt: m.rawText.slice(0, 200) + (m.rawText.length > 200 ? '…' : ''),
      source: m.source,
    });
  }
  return refs;
}

export function resolveAvatarProvenance(
  avatar: Avatar,
  messages: EvidenceMessage[],
  clusters: Cluster[],
  links: ProvenanceLink[],
  avatarOffer?: AvatarOfferRecord | null
): ProvenanceExplainability[] {
  const cluster = avatar.clusterId
    ? clusters.find(c => c.id === avatar.clusterId)
    : clusters.find(c => c.avatarId === avatar.id);

  const clusterMessageIds =
    cluster?.messageIds ||
    avatarOffer?.derivedFrom?.messageIds ||
    messages.filter(m => m.clusterId === cluster?.id).map(m => m.id);

  const artifactLinks = links.filter(
    l => l.artifactId === avatar.id || l.artifactId === avatarOffer?.id
  );

  const basePath = [
    'Company profile',
    'Mining corpus',
    cluster ? `Cluster: ${cluster.label}` : 'Segment (no cluster linked)',
    `Avatar: ${avatar.name}`,
  ];

  const items: ProvenanceExplainability[] = [];

  if (avatar.transformation?.hook) {
    items.push({
      field: 'transformation.hook',
      label: 'Transformation hook',
      value: avatar.transformation.hook,
      evidenceQuotes: quotesFromIds(clusterMessageIds, messages),
      cluster: cluster
        ? { id: cluster.id, label: cluster.label, cohesionScore: cluster.cohesionScore }
        : undefined,
      confidence: avatarOffer?.confidence,
      acquisitionSource: avatar.acquisitionSource || cluster?.source,
      derivationPath: [...basePath, 'Transformation synthesis'],
      provenanceLinks: artifactLinks.filter(l => l.fieldPath?.includes('hook')),
    });
  }

  if (avatar.targetedOffer?.hook || avatar.targetedOffer?.offerName) {
    const offerLinks = links.filter(l => l.artifactId === avatarOffer?.id);
    items.push({
      field: 'targetedOffer',
      label: 'Segment offer (rendered)',
      value: avatar.targetedOffer.hook || avatar.targetedOffer.offerName || '',
      evidenceQuotes: quotesFromIds(
        avatarOffer?.derivedFrom?.messageIds || clusterMessageIds,
        messages
      ),
      cluster: cluster
        ? { id: cluster.id, label: cluster.label, cohesionScore: cluster.cohesionScore }
        : undefined,
      confidence: avatarOffer?.confidence,
      acquisitionSource: avatar.acquisitionSource || 'mining',
      derivationPath: avatarOffer
        ? [...basePath, 'OfferFormula (canonical)', 'Rendered copy']
        : [...basePath, 'Legacy targetedOffer'],
      provenanceLinks: offerLinks,
    });
  }

  if (avatarOffer?.formula) {
    const formulaLinks = links.filter(l => l.artifactId === avatarOffer.id);
    items.push({
      field: 'formula.transformation',
      label: 'Canonical transformation (formula)',
      value: avatarOffer.formula.transformation,
      evidenceQuotes: quotesFromIds(avatarOffer.derivedFrom?.messageIds, messages),
      cluster: cluster
        ? { id: cluster.id, label: cluster.label, cohesionScore: cluster.cohesionScore }
        : undefined,
      confidence: avatarOffer.confidence,
      acquisitionSource: avatar.acquisitionSource,
      derivationPath: [...basePath, 'AvatarOfferRecord.formula'],
      provenanceLinks: formulaLinks,
    });
  }

  items.push({
    field: 'segment',
    label: 'Segment definition',
    value: avatar.description || avatar.definingCharacteristic || avatar.name,
    evidenceQuotes: quotesFromIds(clusterMessageIds, messages),
    cluster: cluster
      ? { id: cluster.id, label: cluster.label, cohesionScore: cluster.cohesionScore }
      : undefined,
    confidence: avatarOffer?.confidence,
    acquisitionSource: avatar.acquisitionSource || cluster?.source || 'unknown',
    derivationPath: basePath,
    provenanceLinks: artifactLinks,
  });

  return items;
}



export function resolveClaimProvenance(
  avatar: Avatar,
  messages: EvidenceMessage[],
  clusters: Cluster[]
): Array<{
  fieldPath: string;
  label: string;
  claim: string;
  quotes: EvidenceQuoteRef[];
  confidence?: number;
  lowConfidence?: boolean;
}> {
  const synthesis = avatar.synthesis;
  if (!synthesis) return [];

  const cluster = clusters.find(c => c.id === avatar.clusterId);

  const CLAIM_FIELDS: Array<{
    key: keyof typeof synthesis;
    label: string;
    fieldPath: string;
  }> = [
    { key: 'realPrimaryMotivation', label: 'Primary Motivation', fieldPath: 'synthesis.realPrimaryMotivation' },
    { key: 'realPrimaryBlocker',    label: 'Primary Blocker',    fieldPath: 'synthesis.realPrimaryBlocker' },
    { key: 'actualBuyingWindow',    label: 'Buying Window',      fieldPath: 'synthesis.actualBuyingWindow' },
    { key: 'winningApproach',       label: 'Winning Approach',   fieldPath: 'synthesis.winningApproach' },
    { key: 'uniqueInsight',         label: 'Unique Insight',     fieldPath: 'synthesis.uniqueInsight' },
  ];

  return CLAIM_FIELDS
    .map(({ key, label, fieldPath }) => {
      const field = synthesis[key] as unknown;
      if (!field) return null;

      const isCited = typeof field === 'object' && field !== null && 'claim' in (field as object);
      const claimText = isCited
        ? (field as { claim: string }).claim
        : (field as string);
      const sourceIds = isCited
        ? getClaimSources(field as { claim: string; supportingMessageIds: string[]; confidence: number })
        : [];
      const confidence = isCited ? (field as { confidence: number }).confidence : undefined;
      const lowConfidence = isCited
        ? ((field as { lowConfidence?: boolean }).lowConfidence ?? sourceIds.length < 3)
        : true;

      const quotes = quotesFromIds(
        sourceIds.length > 0 ? sourceIds : cluster?.messageIds,
        messages
      );

      return { fieldPath, label, claim: claimText, quotes, confidence, lowConfidence };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.claim.length > 0);
}
