import { generateAIContent } from './aiService';
import { validateOfferFormulaResponse, SchemaValidationError } from '../types/determinism';
import type { Avatar, Company, Offer, MarketIntelligenceData } from '../types';
import type {
  AvatarOfferRecord,
  Cluster,
  EvidenceMessage,
  OfferFormula,
  OfferRendered,
} from '../types/pipeline';
import { defaultConfidence, emptyOfferFormula, mergeFormula } from '../lib/offerAdapters';
import { computeOfferAlignment } from './confidenceService';

type FormulaJson = OfferFormula;
type RenderedJson = { hook?: string; offerName?: string; longCopy?: string; generatedOffer?: string };

export async function synthesizeAvatarOfferFormula(
  company: Company,
  avatar: Avatar,
  cluster: Cluster,
  messages: EvidenceMessage[],
  marketIntel?: MarketIntelligenceData,
  coreDraft?: OfferFormula
): Promise<{ formula: OfferFormula; rendered: OfferRendered }> {
  const clusterMessages = messages.filter(m => cluster.messageIds.includes(m.id));
  const evidence = clusterMessages
    .filter(m => m.analyzed)
    .map(m => `- "${m.rawText}" [${m.analysis?.topic}]`)
    .join('\n');

  const systemPrompt = `You are a direct-response strategist. Return ONLY valid JSON.`;

  const userMessage = `Company: ${company.name} (${company.industry})
Segment: ${cluster.label}
Avatar: ${avatar.name} — ${avatar.description}

Evidence:
${evidence || 'Limited evidence — use avatar description.'}

${marketIntel ? `Market intel: ${marketIntel.coreProblem} → ${marketIntel.desiredOutcome}` : ''}

Return structured avatar offer (NOT final marketing fluff as canonical):
{
  "formula": {
    "audience": "specific avatar audience",
    "product": "product/service for them",
    "transformation": "transformation for THIS avatar's problem",
    "reasonToActNow": "urgency for this avatar",
    "specificity": "concrete specifics, numbers, constraints"
  },
  "rendered": {
    "hook": "one-line hook",
    "offerName": "offer name",
    "longCopy": "2-3 sentence segment-specific pitch"
  }
}`;

  // Retry once on schema validation failure (Lock 3 — Schema Lock)
  let lastError: unknown;
  let currentUserMessage = userMessage;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateAIContent({ systemPrompt, userMessage: currentUserMessage, taskType: 'structure' });
      const clean = String(raw).replace(/```json|```/g, '').trim();
      const parsedRaw = JSON.parse(clean);
      const result = validateOfferFormulaResponse(parsedRaw);
      const formula = mergeFormula(emptyOfferFormula(), {
        ...result.formula,
        audience: result.formula.audience || avatar.name,
      });
      return { formula, rendered: result.rendered || {} };
    } catch (err) {
      lastError = err;
      if (err instanceof SchemaValidationError && attempt === 0) {
        currentUserMessage = currentUserMessage + `

IMPORTANT: Return ONLY the exact JSON structure with "formula" and "rendered" keys. No markdown, no extra fields.`;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export function buildAvatarOfferRecord(
  companyId: string,
  avatar: Avatar,
  cluster: Cluster,
  corpusVersion: number,
  runId: string,
  formula: OfferFormula,
  rendered: OfferRendered,
  messages: EvidenceMessage[]
): AvatarOfferRecord {
  const alignment = computeOfferAlignment(formula, messages, cluster.id);
  return {
    id: `ao_${avatar.id}`,
    companyId,
    avatarId: avatar.id,
    clusterId: cluster.id,
    formula,
    validationStatus: cluster.validationStatus,
    confidence: defaultConfidence(alignment, cluster.validationStatus, cluster.messageIds.length),
    derivedFrom: {
      corpusVersion,
      messageIds: cluster.messageIds,
      clusterId: cluster.id,
      avatarId: avatar.id,
      runId,
    },
    rendered,
    updatedAt: new Date().toISOString(),
  };
}
