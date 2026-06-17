import { Company, Offer, Avatar, MarketIntelligenceData } from '../types';
import { generateAIContent, generateWithSelfCorrection } from './aiService';
import type { AvatarOfferRecord, EvidenceMessage, Cluster } from '../types/pipeline';

export interface SynthesisReport {
  rating: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  verdict: string;
}

/**
 * Evidence context passed to generateStage2Synthesis.
 * All fields are optional — the function degrades gracefully to company profile alone.
 */
export interface Stage2EvidenceContext {
  messages?: EvidenceMessage[];
  clusters?: Cluster[];
  avatarOffers?: AvatarOfferRecord[];
  marketIntel?: MarketIntelligenceData | null;
}

export async function generateStage1Synthesis(company: Company, signal?: AbortSignal): Promise<SynthesisReport> {
  const name = company?.name || 'Unnamed Brand';
  const industry = company?.industry || 'Unspecified Industry';
  const specializations = company?.specializations?.map(s => s.name).join(', ') || 'General';
  const usp = company?.usp || 'No USP defined';
  const country = company?.country || 'Global';

  const systemPrompt = `You are a high-level strategic brand consultant. 
  You are analyzing a brand identity to ensure it has enough "flesh on the bones" to support high-converting marketing campaigns.
  
  RETURN ONLY JSON in this format:
  {
    "rating": number (1-10),
    "strengths": string[],
    "weaknesses": string[],
    "recommendations": string[],
    "verdict": "short punchy quote"
  }`;
  
  const userMessage = `
    Analyze this Brand Profile:
    - Name: ${name}
    - Industry: ${industry}
    - Specializations: ${specializations}
    - USP: ${usp}
    - Market: ${country}
  `;

  return (await generateAIContent({
    systemPrompt,
    userMessage,
    jsonResponse: true,
    signal
  })) as unknown as SynthesisReport;
}

/**
 * Evidence-first Stage 2 synthesis.
 *
 * Derives its strategic assessment from the corpus intelligence pipeline:
 *   clusters → avatar offers → market intel → core offer (each optional).
 * Falls back gracefully to company profile alone when no evidence exists yet.
 * Never requires a pre-existing Offer object — that was the old offer-first path.
 */
export async function generateStage2Synthesis(
  company: Company,
  context: Stage2EvidenceContext,
  signal?: AbortSignal
): Promise<SynthesisReport> {
  const companyName = company?.name || 'Unnamed Brand';
  const industry = company?.industry || 'Unspecified Industry';
  const usp = company?.usp || 'Not specified';

  // Build a rich evidence digest from whatever the pipeline has produced so far
  const clusterSummary =
    context.clusters && context.clusters.length > 0
      ? context.clusters
          .filter(c => c.status !== 'merged')
          .map(c => `  • "${c.label}" (${c.validationStatus}, ${c.messageIds.length} messages)`)
          .join('\n')
      : null;

  const avatarOfferSummary =
    context.avatarOffers && context.avatarOffers.length > 0
      ? context.avatarOffers
          .map(
            ao =>
              `  • Segment "${ao.formula.audience}": ${ao.formula.transformation} → urgency: ${ao.formula.reasonToActNow}`
          )
          .join('\n')
      : null;

  const intelSummary = context.marketIntel
    ? `Core problem: ${context.marketIntel.coreProblem || 'unknown'} | Desired outcome: ${context.marketIntel.desiredOutcome || 'unknown'}`
    : null;

  const messageSample =
    context.messages && context.messages.length > 0
      ? context.messages
          .filter(m => m.analyzed && m.rawText.trim().length > 20)
          .slice(0, 6)
          .map(m => `  – "${m.rawText.slice(0, 120)}"`)
          .join('\n')
      : null;

  // Assemble only the sections that have data — never pass empty placeholders
  const evidenceSections: string[] = [];
  if (clusterSummary) evidenceSections.push(`Validated customer segments:\n${clusterSummary}`);
  if (avatarOfferSummary) evidenceSections.push(`Avatar-level offer intelligence:\n${avatarOfferSummary}`);
  if (intelSummary) evidenceSections.push(`Market intelligence: ${intelSummary}`);
  if (messageSample) evidenceSections.push(`Sample customer voice:\n${messageSample}`);

  const evidenceBlock =
    evidenceSections.length > 0
      ? evidenceSections.join('\n\n')
      : `No corpus evidence yet. Evaluate readiness based on the company profile alone and flag what evidence is still needed.`;

  const systemPrompt = `You are a world-class evidence-based conversion strategist.
You evaluate marketing intelligence pipelines — corpus evidence, validated customer segments, synthesised offer formulas — to assess strategic depth and conversion readiness.

Your job is NOT to evaluate a pre-written offer copy.
Your job IS to evaluate whether the evidence pipeline so far gives sufficient depth to drive high-converting, segment-specific offers.

RETURN ONLY JSON in this format:
{
  "rating": number (1-10),
  "strengths": string[],
  "weaknesses": string[],
  "recommendations": string[],
  "verdict": "short punchy quote — evidence-based, specific, no fluff"
}`;

  const userMessage = `
Brand: ${companyName}
Industry: ${industry}
USP: ${usp}

PIPELINE INTELLIGENCE SNAPSHOT:
${evidenceBlock}

Assess:
1. How evidence-rich is this pipeline? (volume, diversity, cluster quality)
2. Are the segment formulas specific enough to drive conversion?
3. What is the biggest gap between available evidence and conversion-ready messaging?
4. What single action would most improve output quality?
`.trim();

  return (await generateAIContent({
    systemPrompt,
    userMessage,
    jsonResponse: true,
    signal,
  })) as unknown as SynthesisReport;
}

export async function generateStage3Synthesis(company: Company, avatars: Avatar[], signal?: AbortSignal): Promise<SynthesisReport> {
  const companyName = company?.name || 'Unnamed Brand';
  const avatarList = (avatars || []).map(a => `- ${a.name || 'Unnamed'} (${a.category || 'General'}): ${a.definingCharacteristic || 'No characteristics defined'}`).join('\n');

  const systemPrompt = `You are a psychological profiling expert and market researcher.
  You are evaluating the depth and accuracy of the customer avatars generated.
  
  RETURN ONLY JSON in this format:
  {
    "rating": number (1-10),
    "strengths": string[],
    "weaknesses": string[],
    "recommendations": string[],
    "verdict": "short punchy quote"
  }`;

  const userMessage = `
    Company: ${companyName}
    Avatars:
    ${avatarList || 'No avatars generated yet.'}
  `;

  return (await generateAIContent({
    systemPrompt,
    userMessage,
    jsonResponse: true,
    signal
  })) as unknown as SynthesisReport;
}
