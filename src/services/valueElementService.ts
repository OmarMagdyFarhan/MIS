/**
 * valueElementService — AI-powered assignment of a single Primary Element of Value
 * per avatar. The system uses a two-tier selection strategy:
 *   Layer 1: 12 curated marketing-relevant elements (attempted first)
 *   Layer 2: Full 30-element fallback (rare, logged)
 *
 * Design principle: "AI suggests meaning, human finalizes intent."
 * The AI proposes; the user confirms or overrides. The avatar is fully
 * usable while in 'proposed' state — confirmation is encouraged, not a gate.
 */
import type { Avatar } from '../types';
import type { AvatarOfferRecord, EvidenceMessage } from '../types/pipeline';
import {
  type PrimaryValueElement,
  type ValueElement,
  TIER1_ELEMENTS,
  VALUE_ELEMENT_LABELS,
} from '../types/valueElements';

/**
 * Requests an AI assignment of the Primary Element of Value for one avatar.
 * Always attempts Tier 1 first. Falls back to Tier 2 only if the AI
 * explicitly indicates no Tier 1 element fits with high confidence.
 */
export async function assignValueElement(
  avatar: Avatar,
  offerRecord: AvatarOfferRecord | undefined,
  clusterMessages: EvidenceMessage[]
): Promise<PrimaryValueElement> {
  const representativeQuotes = clusterMessages
    .sort((a, b) => (b.analysis?.qualityScore ?? 0) - (a.analysis?.qualityScore ?? 0))
    .slice(0, 5)
    .map(m => `"${m.rawText.slice(0, 200)}"`)
    .join('\n');

  const tier1List = TIER1_ELEMENTS
    .map(e => `- ${e}: ${VALUE_ELEMENT_LABELS[e]}`)
    .join('\n');

  const systemPrompt = `You are an expert marketing strategist specializing in the Bain Elements of Value framework.
Your task: assign exactly ONE Primary Element of Value to a customer avatar based solely on their evidence.
RULES:
1. Try the Tier 1 list first (12 elements). Only use the Tier 2 fallback if you cannot find a Tier 1 match with confidence >= 0.6.
2. The element must reflect THIS avatar's actual buying trigger and emotional driver — not the product's general value.
3. Output only valid JSON. No markdown, no explanation outside the JSON.`;

  const userMessage = `Avatar name: ${avatar.name}
Avatar synthesis: ${JSON.stringify(avatar.synthesis ?? {}, null, 2)}
Offer formula: ${JSON.stringify(offerRecord?.formula ?? {}, null, 2)}
Representative customer quotes:
${representativeQuotes}
TIER 1 ELEMENTS (attempt these first):
${tier1List}
Respond with this exact JSON shape:
{
  "element": "<element_key>",
  "tier": 1,
  "usedFallback": false,
  "rationale": "One sentence grounded in the evidence above — cite a specific quote or signal",
  "confidence": 0.0
}
If NO Tier 1 element fits with confidence >= 0.6, set "usedFallback": true, "tier": 2, and select the best Tier 2 element.`;

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userMessage, jsonResponse: true }),
  });

  if (!response.ok) throw new Error(`Value element assignment failed: ${response.status}`);
  const raw = await response.json();
  const result = raw.text ? JSON.parse(raw.text) : raw;

  if (!result.element || !VALUE_ELEMENT_LABELS[result.element as ValueElement]) {
    throw new Error(`AI returned unknown value element: ${result.element}`);
  }

  if (result.usedFallback) {
    console.warn(`[valueElementService] Tier 2 fallback used for avatar "${avatar.name}": ${result.element}`);
  }

  return {
    element: result.element as ValueElement,
    tier: result.tier ?? (TIER1_ELEMENTS.includes(result.element as any) ? 1 : 2),
    usedFallback: result.usedFallback ?? false,
    rationale: result.rationale ?? '',
    confidence: Math.max(0, Math.min(1, result.confidence ?? 0.5)),
    status: 'proposed',
  };
}
