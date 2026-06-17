import { generateAIContent } from '../../../services/aiService';
import { validateClusterResponse, SchemaValidationError } from '../../../types/determinism';
import type { Company, Offer } from '../../../types';
import type { Cluster, EvidenceMessage } from '../../../types/pipeline';
import type { ConversionFormulaAspect, MessageType } from '../../../types';
import { computeClusterCohesion } from '../../../services/confidenceService';

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Propose clusters from analyzed evidence messages (LLM + heuristic fallback).
 */
export async function proposeClustersFromMessages(
  company: Company,
  messages: EvidenceMessage[],
  corpusVersion: number,
  offer?: Offer
): Promise<Cluster[]> {
  const analyzed = messages.filter(m => m.analyzed && m.analysis && m.rawText.trim().length > 5);
  if (!analyzed.length) return [];

  const summaries = analyzed.map(m => ({
    id: m.id,
    text: m.rawText.slice(0, 200),
    topic: m.analysis!.topic,
    aspect: m.analysis!.conversionFormulaAspect,
    type: m.analysis!.messageType,
  }));

  const systemPrompt = `You are a market segmentation analyst. Respond ONLY with valid JSON.`;

  let userMessage = `Company: ${company.name} (${company.industry})
${offer?.generatedOffer ? `Core offer: ${offer.generatedOffer}` : offer?.product ? `Product: ${offer.product}` : ''}
Group these analyzed customer quotes into distinct segments relevant to this company's offer.
Each cluster needs: label (2-5 words), messageIds (array of ids), dominantAspects (array), dominantTypes (array).

Quotes:
${JSON.stringify(summaries, null, 2)}

Return JSON:
{
  "clusters": [
    {
      "label": "...",
      "messageIds": ["id1", "id2"],
      "dominantAspects": ["Anxiety"],
      "dominantTypes": ["Objection"]
    }
  ]
}`;

  // Retry once on schema validation failure (Lock 3 — Schema Lock)
  for (let attempt = 0; attempt < 2; attempt++) {
  try {
    const raw = await generateAIContent({ systemPrompt, userMessage, taskType: 'structure' });
    const clean = String(raw).replace(/```json|```/g, '').trim();
    const parsedRaw = JSON.parse(clean);
    const parsed = validateClusterResponse(parsedRaw);

    const now = new Date().toISOString();
    return parsed.clusters.map(c => {
      const cluster: Cluster = {
        id: uid('cl'),
        companyId: company.id,
        corpusVersion,
        label: c.label,
        status: 'proposed',
        // NOTE: cluster.id is canonical identity — label is display only (Addendum A §1.1 Source 4)
        messageIds: (c.messageIds as string[]).filter(id => analyzed.some(m => m.id === id)),
        dominantAspects: c.dominantAspects as ConversionFormulaAspect[] | undefined,
        dominantTypes: c.dominantTypes as MessageType[] | undefined,
        source: 'mining',
        validationStatus: 'provisional',
        createdAt: now,
        updatedAt: now,
      };
      cluster.cohesionScore = computeClusterCohesion(cluster, messages);
      return cluster;
    });
  } catch (err) {
    if (err instanceof SchemaValidationError && attempt === 0) {
      // Retry once with a corrective prompt (Lock 3 — Schema Lock)
      userMessage = userMessage + `

IMPORTANT: Your previous response failed schema validation. Return ONLY the exact JSON structure requested. No extra fields, no markdown.`;
      continue;
    }
    return heuristicClusters(company.id, analyzed, corpusVersion, messages);
  }
  } // end retry loop
  return heuristicClusters(company.id, analyzed, corpusVersion, messages);
}

function heuristicClusters(
  companyId: string,
  analyzed: EvidenceMessage[],
  corpusVersion: number,
  allMessages: EvidenceMessage[]
): Cluster[] {
  const byTopic = new Map<string, EvidenceMessage[]>();
  for (const m of analyzed) {
    const key = m.analysis?.topic || 'General';
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key)!.push(m);
  }
  const now = new Date().toISOString();
  return Array.from(byTopic.entries()).map(([label, msgs]) => {
    const cluster: Cluster = {
      id: uid('cl'),
      companyId,
      corpusVersion,
      label,
      status: 'proposed',
      messageIds: msgs.map(m => m.id),
      dominantAspects: [...new Set(msgs.map(m => m.analysis!.conversionFormulaAspect))],
      dominantTypes: [...new Set(msgs.map(m => m.analysis!.messageType))],
      source: 'mining',
      validationStatus: 'provisional',
      createdAt: now,
      updatedAt: now,
    };
    cluster.cohesionScore = computeClusterCohesion(cluster, allMessages);
    return cluster;
  });
}

export function assignMessagesToClusters(
  messages: EvidenceMessage[],
  clusters: Cluster[]
): EvidenceMessage[] {
  const idToCluster = new Map<string, string>();
  for (const c of clusters) {
    for (const id of c.messageIds) idToCluster.set(id, c.id);
  }
  return messages.map(m => ({
    ...m,
    clusterId: idToCluster.get(m.id) ?? m.clusterId ?? null,
  }));
}

import { PIPELINE_THRESHOLDS } from '../../../constants/pipelineThresholds';

export const MIN_MESSAGES_FOR_VALIDATION =
  PIPELINE_THRESHOLDS.MIN_MESSAGES_VALIDATED_CLUSTER;
export const AUTO_VALIDATE_COHESION = PIPELINE_THRESHOLDS.AUTO_VALIDATE_COHESION;
