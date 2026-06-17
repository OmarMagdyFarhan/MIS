import { generateAIContent, generateAIContentStream } from "./aiService";
import { sanitizeForPrompt } from '../lib/sanitizePrompt';
import { Company, Offer, Avatar, SynthesisReport, normalizeClaim } from "../types";
import type { EvidenceMessage } from "../types/pipeline";
import { generateExecutionPlan } from "./planService";
import { buildFewShotContext, buildIndustryContext } from "./historyService";
import { buildMarketContext } from "./marketContext";

let sessionCacheName: string | null = null;

export const AVATAR_STRUCTURE = `{
  "synthesis": {
    "realPrimaryMotivation": {
      "claim": "",
      "supportingMessageIds": [],
      "confidence": 0
    },
    "realPrimaryBlocker": {
      "claim": "",
      "supportingMessageIds": [],
      "confidence": 0
    },
    "actualBuyingWindow": {
      "claim": "",
      "supportingMessageIds": [],
      "confidence": 0
    },
    "winningApproach": {
      "claim": "",
      "supportingMessageIds": [],
      "confidence": 0
    },
    "messagesToUse": [],
    "messagesToAvoid": [],
    "uniqueInsight": {
      "claim": "",
      "supportingMessageIds": [],
      "confidence": 0
    },
    "conflictsResolved": [{ "conflict": "", "resolution": "" }],
    "confidenceScore": 0
  },
  "marketIntelligence": {
    "pricePerception": "",
    "buyingBehavior": "",
    "culturalConsiderations": "",
    "offerFraming": ""
  },
  "elementsOfValue": [{ "category": "", "element": "", "reasonWhy": "" }],
  "valueAnalysis": "",
  "demographics": { "age": "", "income": "", "education": "", "location": "" },
  "traits": { "hobbies": "", "interests": "", "values": "" },
  "sources": { "brands": [], "books": [], "magazines": [], "podcasts": [], "influencers": [] },
  "questionnaire": { 
    "anxious": "", 
    "motivation": "", 
    "fondPast": "", 
    "complicated": "", 
    "valuableInfo": "", 
    "moneyMotivation": "", 
    "healthMotivation": "", 
    "designMotivation": "", 
    "fun": "", 
    "risk": "", 
    "proudRoles": "", 
    "aspiringRoles": "", 
    "averageDay": "", 
    "averageExpectation": "", 
    "appearanceMotivation": "" 
  },
  "transformation": { "beforeProblem": "", "beforeHave": "", "beforeFeelings": "", "beforeDay": "", "beforeStatus": "", "afterBenefit": "", "afterDeepBenefit": "", "afterHave": "", "afterFeelings": "", "afterDay": "", "afterStatus": "", "hook": "" },
  "transformationFramework": { "emotional": { "before": "", "after": "" }, "results": { "before": "", "after": "" }, "lifestyle": { "before": "", "after": "" }, "stress": { "before": "", "after": "" }, "identity": { "before": "", "after": "" }, "relationships": { "before": "", "after": "" }, "selfPerception": { "before": "", "after": "" } },
  "targetedOffer": { 
    "offerName": "", 
    "transformation": "", 
    "hook": "", 
    "reasoning": "", 
    "score": { 
      "total": 0, 
      "clarity": 0, 
      "clarityReasoning": "",
      "relevance": 0, 
      "relevanceReasoning": "",
      "urgency": 0, 
      "urgencyReasoning": "",
      "reasoning": "",
      "explanation": "",
      "improvementTip": "" 
    } 
  },
  "visualDescriptor": "",
  "hesitations": { "judgments": "", "reasoning": "", "addressing": "" },
  "behavioralAnalysis": [{ "category": "", "analysis": "" }],
  "deepContext": {
    "pathToPurchase": {
      "awareness": "",
      "consideration": "",
      "decision": ""
    },
    "beyondDemographics": {
      "valuesAndBeliefs": "",
      "painPoints": "",
      "goalsAndAspirations": "",
      "fearsAndObjections": "",
      "interestsAndHobbies": ""
    },
    "behavioralDetails": {
      "onlineHangouts": "",
      "contentConsumption": "",
      "communicationPreferences": "",
      "purchaseTriggers": ""
    }
  }
}`;

export const ASSEMBLY_PROMPT_SYSTEM = `You are the final assembler and a deep-empathy consumer psychologist. 
Convert the multi-agent synthesis into a complete, exhaustive deep-dive.

Rules:
- Return ONLY valid JSON.
- Resolve conflicts using Researcher factual grounding.
- Sharpen every claim the Adversarial probe attacked.
- CRITICAL: Eliminate all generic buzzwords. No "comprehensive", "end-to-end", "solutions", or "packages".
- BE HYPER-SPECIFIC: If the avatar needs better makeup, find the exact chemical or application pain point. If they need business software, find the exact API or workflow friction.
- The "sources" must be REAL brands/books/podcasts.
- For "elementsOfValue", you MUST provide a "reasonWhy" that explains exactly how that element solves a psychological pain point for this specific avatar.
- For "targetedOffer" score, you MUST provide an "explanation" (how the score was calculated based on mental friction) and an "improvementTip" (how to reach a 100 score).
- MANDATORY: You MUST provide detailed, non-generic answers for EVERY SINGLE field in the "questionnaire". Do not leave any blank or "N/A".
- ENRICHED CONTEXT: You MUST populate the "deepContext" section with extreme psychological depth:
    * Path to Purchase: Explain the moment of Awareness, the alternatives they Consider, and the final Decision triggers.
    * Beyond Demographics: Drill into their Values/Beliefs, the real Pain Points keeping them awake, their deepest Goals, and the specific Fears stopping them.
    * Behavioral Details: Map their Online Hangouts (exact platforms/newsletters), Content consumed, and Communication preferences.
- AI Must learn from each avatar info and whole company offer to generate a great avatar offer.

CITATION RULE (MANDATORY): For the following synthesis fields, you MUST return
a CitedClaim object instead of a plain string:
  realPrimaryMotivation, realPrimaryBlocker, actualBuyingWindow,
  winningApproach, uniqueInsight

CitedClaim format:
{
  "claim": "The psychological insight statement",
  "supportingMessageIds": ["msg_id_1", "msg_id_2", "msg_id_3"],
  "confidence": 0.85
}

Rules for CitedClaim:
- supportingMessageIds must be real IDs from the evidence provided to you.
  Do NOT invent IDs. If you cannot find 3 supporting messages for a claim,
  set confidence below 0.5 and note it honestly.
- confidence 0.8-1.0: strong evidence (3+ messages, same aspect/sub-aspect)
- confidence 0.5-0.79: moderate evidence (1-2 messages, or different aspects)
- confidence 0.0-0.49: weak evidence (inferred, not directly stated)
- If you have NO supporting evidence for a claim, do NOT make the claim.
  Set the claim to "Insufficient evidence" and supportingMessageIds to [].`;

export const initAvatarSession = async (company: Company, offer: Offer): Promise<void> => {
  // Session context stored for future caching implementation
  sessionCacheName = null;
};

export const endAvatarSession = async (): Promise<void> => {
  sessionCacheName = null;
};

export const generateInitialAvatars = async (company: Company, offer: Offer, strategicReport?: SynthesisReport): Promise<Avatar[]> => {
  const fewShot = buildFewShotContext(company.industry, 'avatarName');
  const industryContext = buildIndustryContext(company.industry);
  const marketContext = buildMarketContext(company.country);

  const synthesisBrief = strategicReport ? `
  STRATEGIC CONSULTANT FINDINGS (PHASE 1):
  Rating: ${strategicReport.rating}/10
  Key Strengths to Leverage: ${strategicReport.strengths.join(', ')}
  Critical Gaps to Address: ${strategicReport.weaknesses.join(', ')}
  Strategic Recommendations: ${strategicReport.recommendations.join(', ')}
  Verdict: ${strategicReport.verdict}
  ` : "";

  const systemPrompt = `You are a world-class marketing specialist specializing in customer psychology and high-conversion avatars.
Your goal is to identify 10 unique, highly specific customer avatars for a brand based on its USP and core offer.
Avoid generic descriptions. Look for underserved niches or specific life situations.${fewShot}${industryContext}

${marketContext}
${synthesisBrief}

For each avatar, you MUST assign it to EXACTLY ONE of these 4 Major Categories. This is a mandatory flag:
1. Goals and Challenges - What do they desire and what is stopping them? What are they afraid of? What status change do they want?
2. Demographics - What is their age, race, and sex, job title, location, income, number of children, etc?
3. Interest - What are their hobbies? How do they spend their free time? What affiliations do they have? What values do they possess? What do they read, watch, or listen to? Who do they follow?
4. Triggering Events - What life changing event has occurred? What purchase was made? What knowledge has been acquired?

For each avatar, identify a "Single Defining Characteristic" — the one rule that defines if someone belongs to this group. This is a mandatory flag to identify the group.

Return the result as a JSON array of objects with:
"name", "description", "score" (1-10), "reasoning", 
"category" (One of the 4 full names above),
"definingCharacteristic": (The one rule/flag),
"visualDescriptor": (A physical description for image generation),
"canHaveSubAvatars": (boolean, true if this group can be broken down into more granular groups like 'Attorneys' -> 'Bankruptcy attorney')`;

  const companyName = company?.name || 'Unnamed Brand';
  const industry = company?.industry || 'Unspecified Industry';
  const usp = company?.usp || 'No USP Defined';
  const product = offer?.product || 'Unspecified Product';
  const transformation = offer?.transformation || 'No transformation defined';

  const userMessage = `Brand: ${sanitizeForPrompt(companyName)}
Industry: ${industry}
USP: ${sanitizeForPrompt(usp)}
Core Product: ${sanitizeForPrompt(product)}
Main Transformation: ${sanitizeForPrompt(transformation)}

Please list 10 unique avatars.`;

  let avatars: unknown = await generateAIContent({
    systemPrompt,
    userMessage,
    jsonResponse: true
  });

  // Handle cases where AI wraps the array in an object
  if (!Array.isArray(avatars) && avatars && typeof avatars === 'object') {
    const wrapped = avatars as Record<string, unknown>;
    const arrayKey = Object.keys(wrapped).find(key => Array.isArray(wrapped[key]));
    if (arrayKey) {
      avatars = wrapped[arrayKey];
    }
  }

  if (!Array.isArray(avatars)) {
    console.error("AI did not return an array of avatars:", avatars);
    return [];
  }

  return avatars.map((a: any, i: number) => ({
    id: `avatar_${Date.now()}_${i}`,
    companyId: company.id,
    ...a
  }));
};

export const generateSubAvatars = async (parent: Avatar, company: Company, offer: Offer): Promise<Avatar[]> => {
  const parentName = parent?.name || 'Unnamed Avatar';
  const parentCategory = parent?.category || 'General';
  const parentDescription = parent?.description || 'No description';
  const parentCharacteristic = parent?.definingCharacteristic || 'No characteristics defined';

  const systemPrompt = `You are a specialist in niche market segmentation. 
You are drilling down into a specific customer avatar: "${parentName}".
Your goal is to create 5 even more granular sub-avatars.

Example:
Parent: Small Business Owner
Sub-avatars: Attorneys, Accountants, Financial Planners.

Example:
Parent: Attorneys
Sub-avatars: Bankruptcy Attorney, Family Law Attorney, Corporate Attorney.

Return a JSON array of objects with:
"name", 
"description", 
"category" (same as parent: ${parentCategory}),
"definingCharacteristic": (more specific characteristic),
"visualDescriptor": (physical description for image generation),
"canHaveSubAvatars": (true if even more granular breakdown is possible).`;

  const userMessage = `Parent Avatar: ${sanitizeForPrompt(parentName)}
Description: ${sanitizeForPrompt(parentDescription)}
Defining Characteristic: ${sanitizeForPrompt(parentCharacteristic)}

Generate 5 sub-avatars.`;

  let avatars: unknown = await generateAIContent({
    systemPrompt,
    userMessage,
    jsonResponse: true
  });

  if (!Array.isArray(avatars) && avatars && typeof avatars === 'object') {
    const wrapped = avatars as Record<string, unknown>;
    const arrayKey = Object.keys(wrapped).find(key => Array.isArray(wrapped[key]));
    if (arrayKey) avatars = wrapped[arrayKey];
  }

  if (!Array.isArray(avatars)) {
    console.error("AI did not return an array of sub-avatars:", avatars);
    return [];
  }

  return avatars.map((a: any, idx: number) => ({
    ...a,
    id: `sub_avatar_${Date.now()}_${idx}`,
    companyId: company.id,
    parentId: parent.id
  }));
};

export function buildAspectBreakdown(messages: EvidenceMessage[]): string {
  const analyzed = messages.filter(m => m.analysis);
  if (!analyzed.length) return 'No analyzed messages.';

  const byAspect = new Map<string, { count: number; subAspects: Map<string, number> }>();

  for (const m of analyzed) {
    const a = m.analysis!;
    const key = a.conversionFormulaAspect;
    if (!byAspect.has(key)) byAspect.set(key, { count: 0, subAspects: new Map() });
    const entry = byAspect.get(key)!;
    entry.count++;
    if (a.subAspect) {
      entry.subAspects.set(a.subAspect, (entry.subAspects.get(a.subAspect) ?? 0) + 1);
    }
  }

  return Array.from(byAspect.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([aspect, { count, subAspects }]) => {
      const subLine = subAspects.size
        ? ` → ${Array.from(subAspects.entries()).map(([s, n]) => `${s} (${n})`).join(', ')}`
        : '';
      return `  ${aspect}: ${count} messages${subLine}`;
    })
    .join('\n');
}

const MIN_MESSAGES_FOR_FULL_DEEPDIVE = 3;

export const deepDiveAvatar = async (
  company: Company,
  avatar: Avatar,
  corpusMessages: EvidenceMessage[] = [],
  clusterMessages: EvidenceMessage[] = [],
): Promise<Avatar> => {
  const companyName = company?.name || 'Unnamed Brand';
  const industry = company?.industry || 'Unspecified Industry';
  const avatarName = avatar?.name || 'Unnamed';
  const avatarDesc = avatar?.description || 'No description';
  const avatarChar = avatar?.definingCharacteristic || 'No characteristics';

  if (clusterMessages.filter(m => m.analyzed).length < MIN_MESSAGES_FOR_FULL_DEEPDIVE) {
    return {
      ...avatar,
      synthesis: {
        realPrimaryMotivation: { claim: 'Insufficient evidence — fewer than 3 analyzed messages in cluster.', supportingMessageIds: [], confidence: 0, lowConfidence: true },
        realPrimaryBlocker: { claim: 'Low confidence proto-avatar. Add more evidence to improve.', supportingMessageIds: [], confidence: 0, lowConfidence: true },
        confidenceScore: 0.2,
      } as any,
      pipelineMetadata: {
        totalCalls: 0,
        retriesUsed: 0,
        synthesisConfidence: 0.2,
        scoreGateDecision: 'insufficient_evidence',
        adversarialAttacksResolved: 0,
      },
    };
  }

  const clusterQuotes = clusterMessages
    .filter(m => m.analyzed && m.rawText)
    .map(m => {
      const a = m.analysis;
      const subAspectLabel = a?.subAspect ? ` [${a.subAspect}]` : '';
      const signalTags = a?.conversionSignalTags?.length
        ? ` {${a.conversionSignalTags.join(', ')}}`
        : '';
      return `"${m.rawText}" → ${a?.conversionFormulaAspect ?? 'Unknown'}${subAspectLabel}${signalTags} | ${a?.topic ?? ''} | ${a?.emotion ?? ''}`;
    })
    .join('\n');

  const aspectBreakdown = buildAspectBreakdown(clusterMessages);

  const context = `
COMPANY: ${sanitizeForPrompt(companyName)} | Industry: ${industry}
AVATAR HYPOTHESIS: ${avatarName} — ${avatarDesc}
DEFINING TRAIT: ${avatarChar}

REAL CUSTOMER EVIDENCE (${clusterMessages.length} messages from this segment):
${clusterQuotes || 'No cluster messages available.'}

ASPECT SIGNAL BREAKDOWN:
${aspectBreakdown}

INSTRUCTION: Build this avatar EXCLUSIVELY from the evidence above.
Every psychological claim must be traceable to at least one real quote.
Do NOT invent personas, do NOT extrapolate beyond the evidence.
If the evidence is insufficient to support a claim, mark it as "Low confidence — limited evidence".
`;
  const fewShot = buildFewShotContext(company.industry, 'hook');
  const marketContext = buildMarketContext(company.country);

  const STRICT_EVIDENCE_RULE = `\nSTRICT EVIDENCE RULE: Every psychological claim you make MUST cite a specific customer quote from the evidence provided. If you cannot ground a claim in the evidence, do not make it. Generic marketing language is forbidden.\n`;

  const ADVOCATE_PROMPT = `You are the Advocate agent in a multi-agent marketing intelligence system. Your job: assume this avatar is a PERFECT customer. Build the strongest possible psychological case for why they buy. \n\n${marketContext}\n${STRICT_EVIDENCE_RULE}\nReturn ONLY valid JSON.${fewShot}`;
  const SKEPTIC_PROMPT = `You are the Skeptic agent in a multi-agent marketing intelligence system. Your job: assume this avatar will NEVER buy. Be ruthless and specific. \n\n${marketContext}\n${STRICT_EVIDENCE_RULE}\nReturn ONLY valid JSON.${fewShot}`;
  const RESEARCHER_PROMPT = `You are the Researcher agent in a multi-agent marketing intelligence system. Your job: ignore opinion. Report only factually observable data. \n\n${marketContext}\n${STRICT_EVIDENCE_RULE}\nReturn ONLY valid JSON.`;
  const SYNTHESIS_PROMPT = `You are the Synthesis layer. Synthesize 3 perspectives (Advocate, Skeptic, Researcher) into one coherent picture. \n\n${marketContext}\n${STRICT_EVIDENCE_RULE}\nReturn ONLY valid JSON.`;
  const ADVERSARIAL_PROMPT = `You are the Adversarial Probe. You are a customer who would NEVER buy. Attack the synthesis profile from the inside. Find every generic or over-optimistic claim. Return ONLY valid JSON.`;
  const SCORE_GATE_PROMPT = `You are the Score Gate. Evaluate if the synthesis is strong enough (pass) or needs another pass (retry) with adversarial feedback. Return ONLY valid JSON.`;
  let injectedFeedback = "";
  let totalCalls = 0;
  let retriesUsed = 0;
  let synthesisResult: any;
  let adversarialResult: any;
  let gateResult: any;

  for (let attempt = 0; attempt <= 2; attempt++) {
    // LAYER 1 — Parallel Thinking
    const [advocateRes, skepticRes, researcherRes] = await Promise.all([
      generateAIContent({ systemPrompt: ADVOCATE_PROMPT, userMessage: context + (injectedFeedback ? `\n\nFEEDBACK TO ADDRESS:\n${injectedFeedback}` : ""), jsonResponse: true }),
      generateAIContent({ systemPrompt: SKEPTIC_PROMPT, userMessage: context + (injectedFeedback ? `\n\nFEEDBACK TO ADDRESS:\n${injectedFeedback}` : ""), jsonResponse: true }),
      generateAIContent({ systemPrompt: RESEARCHER_PROMPT, userMessage: context, jsonResponse: true })
    ]);
    totalCalls += 3;

    // LAYER 2 — Synthesis
    synthesisResult = await generateAIContent({
      systemPrompt: SYNTHESIS_PROMPT,
      userMessage: `Advocate: ${JSON.stringify(advocateRes)}\nSkeptic: ${JSON.stringify(skepticRes)}\nResearcher: ${JSON.stringify(researcherRes)}`,
      jsonResponse: true
    });
    totalCalls++;

    // LAYER 3 — Adversarial Probe
    adversarialResult = await generateAIContent({
      systemPrompt: ADVERSARIAL_PROMPT,
      userMessage: `Profile to attack: ${JSON.stringify(synthesisResult)}`,
      jsonResponse: true
    });
    totalCalls++;

    // LAYER 4 — Score Gate
    gateResult = await generateAIContent({
      systemPrompt: SCORE_GATE_PROMPT,
      userMessage: `Synthesis: ${JSON.stringify(synthesisResult)}\nAdversarial: ${JSON.stringify(adversarialResult)}
      Return JSON:
      {
        "scores": { "specificity": 0, "psychologicalAccuracy": 0, "actionability": 0, "resistanceAddressed": 0, "overall": 0 },
        "decision": "pass | retry",
        "retryReason": "",
        "injectionForRetry": "feedback for Layer 1"
      }`,
      jsonResponse: true
    });
    totalCalls++;

    if (gateResult.decision === "pass" || attempt === 2) {
      break;
    }

    injectedFeedback = gateResult.injectionForRetry;
    retriesUsed++;
  }

  const assemblyResult = await generateAIContent<Partial<Avatar>>({
    systemPrompt: ASSEMBLY_PROMPT_SYSTEM,
    userMessage: `Synthesis: ${JSON.stringify(synthesisResult)}\nAdversarial: ${JSON.stringify(adversarialResult)}\nGate Decision: ${JSON.stringify(gateResult)}\n\nFollow this structure:\n${AVATAR_STRUCTURE}`,
    jsonResponse: true,
    tools: [{ googleSearch: {} }]
  });
  totalCalls++;

  const details = assemblyResult;
  if (details?.synthesis) {
    const s = details.synthesis;
    details.synthesis = {
      ...s,
      realPrimaryMotivation: normalizeClaim(s.realPrimaryMotivation) ?? s.realPrimaryMotivation,
      realPrimaryBlocker:    normalizeClaim(s.realPrimaryBlocker) ?? s.realPrimaryBlocker,
      actualBuyingWindow:    normalizeClaim(s.actualBuyingWindow) ?? s.actualBuyingWindow,
      winningApproach:       normalizeClaim(s.winningApproach) ?? s.winningApproach,
      uniqueInsight:         normalizeClaim(s.uniqueInsight) ?? s.uniqueInsight,
    };
  }
  const executionPlan = await generateExecutionPlan(company, undefined, { ...avatar, ...details });

  return {
    ...avatar,
    ...details,
    executionPlan,
    pipelineMetadata: {
      totalCalls,
      retriesUsed,
      synthesisConfidence: synthesisResult.synthesisConfidence || gateResult.scores.overall,
      scoreGateDecision: gateResult.decision,
      adversarialAttacksResolved: adversarialResult.attackedClaims?.length || 0
    }
  };
};

/**
 * Regenerate a targeted offer for an avatar.
 *
 * Architecture note: this function is evidence-first. It derives context
 * from the avatar's own synthesis, the company profile, and - if available -
 * the synthesised core offer. It does NOT require a core offer to be present;
 * the core offer is optional enrichment only.
 *
 * @param company   - Company profile (always available after Stage 1)
 * @param avatar    - Avatar whose targeted offer should be regenerated
 */
export const regenerateTargetedOffer = async (
  company: Company,
  avatar: Avatar
): Promise<Avatar> => {
  const avatarName = avatar?.name || 'Unnamed';
  const avatarDesc = avatar?.description || 'No description';
  const hook = avatar?.transformation?.hook || 'No hook';
  const usp = company?.usp || 'No USP';

  // Derive product context from the core offer formula when available,
  // otherwise fall back to the company profile alone.
  const product = company?.name || 'Unspecified Product';

  // FIX #7: Extract the 3 most important synthesis insights explicitly instead of
  // JSON.stringify-ing the entire synthesis object (which wastes ~8000 tokens and
  // buries the signal). Prioritise synthesis evidence over company USP so the
  // regenerated offer reflects real customer voice, not marketing copy.
  const synth = avatar?.synthesis as any;
  const synthesisEvidence = synth
    ? `AVATAR SYNTHESIS (derived from real customer evidence — use this FIRST):
- Primary motivation: ${synth.realPrimaryMotivation?.claim ?? 'Unknown'}
- Primary blocker: ${synth.realPrimaryBlocker?.claim ?? 'Unknown'}
- Winning approach: ${synth.winningApproach?.claim ?? synth.recommendedApproach?.claim ?? 'Unknown'}`
    : 'No synthesis available — use Company USP as fallback only.';

  const systemPrompt = `You are a high-conversion offer architect.
  Your goal is to write a hyper-targeted offer for a specific avatar, grounded in their
  psychological profile and pain points - not in a pre-existing company offer.

  Avatar: ${avatarName} - ${avatarDesc}
  Transformation Hook: ${hook}

  ${synthesisEvidence}

  Company USP (context only — do not lead with this): ${usp}
  Product/Service: ${product}

  PRIORITY ORDER: derive the targetedOffer from the synthesis evidence above FIRST.
  Only fall back to the Company USP if no synthesis is available.
  Do not copy the USP verbatim.

  Return ONLY valid JSON for the targetedOffer field:
  {
    "targetedOffer": {
      "offerName": "",
      "transformation": "",
      "hook": "",
      "reasoning": "",
      "score": {
        "total": 0,
        "clarity": 0,
        "clarityReasoning": "Why this clarity score?",
        "relevance": 0,
        "relevanceReasoning": "Why this relevance score?",
        "urgency": 0,
        "urgencyReasoning": "Why this urgency score?",
        "reasoning": "",
        "explanation": "",
        "improvementTip": ""
      }
    }
  }`;

  const result = await generateAIContent<{ targetedOffer?: Avatar["targetedOffer"] }>({
    systemPrompt,
    userMessage: `Please regenerate the hyper-targeted offer for ${sanitizeForPrompt(avatar.name)}.`,
    jsonResponse: true
  });

  return {
    ...avatar,
    targetedOffer: result.targetedOffer
  };
};

export const deepDiveAvatarStream = async (
  company: Company,
  offer: Offer,
  avatar: Avatar,
  corpusMessages: EvidenceMessage[] = [],
  clusterMessages: EvidenceMessage[] = [],
  onChunk: (partial: string) => void
): Promise<Avatar> => {
  const companyName = company?.name || 'Unnamed Brand';
  const industry = company?.industry || 'Unspecified Industry';
  const avatarName = avatar?.name || 'Unnamed';
  const avatarDesc = avatar?.description || 'No description';
  const avatarChar = avatar?.definingCharacteristic || 'No characteristics';

  if (clusterMessages.filter(m => m.analyzed).length < MIN_MESSAGES_FOR_FULL_DEEPDIVE) {
    return {
      ...avatar,
      synthesis: {
        realPrimaryMotivation: { claim: 'Insufficient evidence — fewer than 3 analyzed messages in cluster.', supportingMessageIds: [], confidence: 0, lowConfidence: true },
        realPrimaryBlocker: { claim: 'Low confidence proto-avatar. Add more evidence to improve.', supportingMessageIds: [], confidence: 0, lowConfidence: true },
        confidenceScore: 0.2,
      } as any,
      pipelineMetadata: {
        totalCalls: 0,
        retriesUsed: 0,
        synthesisConfidence: 0.2,
        scoreGateDecision: 'insufficient_evidence',
        adversarialAttacksResolved: 0,
      },
    };
  }

  const clusterQuotes = clusterMessages
    .filter(m => m.analyzed && m.rawText)
    .map(m => {
      const a = m.analysis;
      const subAspectLabel = a?.subAspect ? ` [${a.subAspect}]` : '';
      const signalTags = a?.conversionSignalTags?.length
        ? ` {${a.conversionSignalTags.join(', ')}}`
        : '';
      return `"${m.rawText}" → ${a?.conversionFormulaAspect ?? 'Unknown'}${subAspectLabel}${signalTags} | ${a?.topic ?? ''} | ${a?.emotion ?? ''}`;
    })
    .join('\n');

  const aspectBreakdown = buildAspectBreakdown(clusterMessages);

  const context = `
COMPANY: ${sanitizeForPrompt(companyName)} | Industry: ${industry}
AVATAR HYPOTHESIS: ${avatarName} — ${avatarDesc}
DEFINING TRAIT: ${avatarChar}

REAL CUSTOMER EVIDENCE (${clusterMessages.length} messages from this segment):
${clusterQuotes || 'No cluster messages available.'}

ASPECT SIGNAL BREAKDOWN:
${aspectBreakdown}

INSTRUCTION: Build this avatar EXCLUSIVELY from the evidence above.
Every psychological claim must be traceable to at least one real quote.
Do NOT invent personas, do NOT extrapolate beyond the evidence.
If the evidence is insufficient to support a claim, mark it as "Low confidence — limited evidence".
`;

  const fewShot = buildFewShotContext(company.industry, 'hook');
  const marketContext = buildMarketContext(company.country);

  const STRICT_EVIDENCE_RULE = `\nSTRICT EVIDENCE RULE: Every psychological claim you make MUST cite a specific customer quote from the evidence provided. If you cannot ground a claim in the evidence, do not make it. Generic marketing language is forbidden.\n`;

  const ADVOCATE_PROMPT = `You are the Advocate agent in a multi-agent marketing intelligence system. Your job: assume this avatar is a PERFECT customer. Build the strongest possible psychological case for why they buy. \n\n${marketContext}\n${STRICT_EVIDENCE_RULE}\nReturn ONLY valid JSON.${fewShot}`;
  const SKEPTIC_PROMPT = `You are the Skeptic agent in a multi-agent marketing intelligence system. Your job: assume this avatar will NEVER buy. Be ruthless and specific. \n\n${marketContext}\n${STRICT_EVIDENCE_RULE}\nReturn ONLY valid JSON.${fewShot}`;
  const RESEARCHER_PROMPT = `You are the Researcher agent in a multi-agent marketing intelligence system. Your job: ignore opinion. Report only factually observable data. \n\n${marketContext}\n${STRICT_EVIDENCE_RULE}\nReturn ONLY valid JSON.`;
  const SYNTHESIS_PROMPT = `You are the Synthesis layer. Synthesize 3 perspectives (Advocate, Skeptic, Researcher) into one coherent picture. \n\n${marketContext}\n${STRICT_EVIDENCE_RULE}\nReturn ONLY valid JSON.`;
  const ADVERSARIAL_PROMPT = `You are the Adversarial Probe. You are a customer who would NEVER buy. Attack the synthesis profile from the inside. Find every generic or over-optimistic claim. Return ONLY valid JSON.`;
  const SCORE_GATE_PROMPT = `You are the Score Gate. Evaluate if the synthesis is strong enough (pass) or needs another pass (retry) with adversarial feedback. Return ONLY valid JSON.`;

  let injectedFeedback = "";
  let totalCalls = 0;
  let retriesUsed = 0;
  let synthesisResult: any;
  let adversarialResult: any;
  let gateResult: any;

  for (let attempt = 0; attempt <= 1; attempt++) {
    const [advocateRes, skepticRes, researcherRes] = await Promise.all([
      generateAIContent({ systemPrompt: ADVOCATE_PROMPT, userMessage: context + (injectedFeedback ? `\n\nFEEDBACK TO ADDRESS:\n${injectedFeedback}` : ""), jsonResponse: true }),
      generateAIContent({ systemPrompt: SKEPTIC_PROMPT, userMessage: context + (injectedFeedback ? `\n\nFEEDBACK TO ADDRESS:\n${injectedFeedback}` : ""), jsonResponse: true }),
      generateAIContent({ systemPrompt: RESEARCHER_PROMPT, userMessage: context, jsonResponse: true })
    ]);
    totalCalls += 3;

    synthesisResult = await generateAIContent({
      systemPrompt: SYNTHESIS_PROMPT,
      userMessage: `Advocate: ${JSON.stringify(advocateRes)}\nSkeptic: ${JSON.stringify(skepticRes)}\nResearcher: ${JSON.stringify(researcherRes)}`,
      jsonResponse: true
    });
    totalCalls++;

    adversarialResult = await generateAIContent({
      systemPrompt: ADVERSARIAL_PROMPT,
      userMessage: `Profile to attack: ${JSON.stringify(synthesisResult)}`,
      jsonResponse: true
    });
    totalCalls++;

    gateResult = await generateAIContent({
      systemPrompt: SCORE_GATE_PROMPT,
      userMessage: `Synthesis: ${JSON.stringify(synthesisResult)}\nAdversarial: ${JSON.stringify(adversarialResult)}
      Return JSON:
      {
        "scores": { "specificity": 0, "psychologicalAccuracy": 0, "actionability": 0, "resistanceAddressed": 0, "overall": 0 },
        "decision": "pass | retry",
        "retryReason": "",
        "injectionForRetry": "feedback for Layer 1"
      }`,
      jsonResponse: true
    });
    totalCalls++;

    if (gateResult.decision === "pass" || attempt === 1) {
      break;
    }

    injectedFeedback = gateResult.injectionForRetry;
    retriesUsed++;
  }

  const assemblyResult = await generateAIContentStream<Partial<Avatar>>({
    systemPrompt: ASSEMBLY_PROMPT_SYSTEM,
    userMessage: `Avatar to analyze: ${sanitizeForPrompt(avatar.name)} - ${sanitizeForPrompt(avatar.description)}\n\nSynthesis from multi-agent session: ${JSON.stringify(synthesisResult)}\nAdversarial: ${JSON.stringify(adversarialResult)}\nGate Decision: ${JSON.stringify(gateResult)}\n\nFollow this structure:\n${AVATAR_STRUCTURE}`,
    onChunk: (text) => onChunk(text),
    jsonResponse: true,
  });
  totalCalls++;

  const details = assemblyResult;
  if (details?.synthesis) {
    const s = details.synthesis;
    details.synthesis = {
      ...s,
      realPrimaryMotivation: normalizeClaim(s.realPrimaryMotivation) ?? s.realPrimaryMotivation,
      realPrimaryBlocker:    normalizeClaim(s.realPrimaryBlocker) ?? s.realPrimaryBlocker,
      actualBuyingWindow:    normalizeClaim(s.actualBuyingWindow) ?? s.actualBuyingWindow,
      winningApproach:       normalizeClaim(s.winningApproach) ?? s.winningApproach,
      uniqueInsight:         normalizeClaim(s.uniqueInsight) ?? s.uniqueInsight,
    };
  }
  const executionPlan = await generateExecutionPlan(company, undefined, { ...avatar, ...details });

  return {
    ...avatar,
    ...details,
    executionPlan,
    pipelineMetadata: {
      totalCalls,
      retriesUsed,
      synthesisConfidence: synthesisResult.synthesisConfidence || gateResult.scores.overall,
      scoreGateDecision: gateResult.decision,
      adversarialAttacksResolved: adversarialResult.attackedClaims?.length || 0
    }
  };
};

import type { Cluster } from '../types/pipeline';
import { buildEvidenceSnapshot } from './avatarEvolutionService';

export async function generateAvatarsFromClusters(
  company: Company,
  clusters: Cluster[],
  messages: EvidenceMessage[],
  offer?: Offer
): Promise<Avatar[]> {
  const validClusters = clusters.filter(
    c => c.status !== 'merged' && c.status !== 'archived' && c.messageIds.length >= 3
  );

  if (!validClusters.length) return [];

  const avatars: Avatar[] = [];

  for (const cluster of validClusters) {
    const clusterMessages = messages.filter(
      m => cluster.messageIds.includes(m.id) && m.analyzed
    );
    if (!clusterMessages.length) continue;

    const topQuotes = clusterMessages
      .sort((a, b) => (b.analysis?.qualityScore ?? 0) - (a.analysis?.qualityScore ?? 0))
      .slice(0, 5)
      .map(m => `"${(m.normalizedText ?? m.rawText).slice(0, 200)}"`)
      .join('\n');

    const aspectBreakdown = buildAspectBreakdown(clusterMessages);

    const systemPrompt = `You are a customer avatar architect. 
Build a persona hypothesis EXCLUSIVELY from real customer quotes provided.
Every claim must be traceable to the evidence. No invention. No generic marketing language.
Respond ONLY with valid JSON.`;

    const userMessage = `Company: ${sanitizeForPrompt(company.name)} (${company.industry})
${offer ? `Product context: ${offer.product}` : ''}

Cluster: "${cluster.label}" — ${cluster.messageIds.length} messages
Dominant aspects: ${(cluster.dominantAspects ?? []).join(', ')}

Top customer quotes from this segment:
${topQuotes}

Aspect signal breakdown:
${aspectBreakdown}

Create a customer avatar for this segment. The name and every psychological claim
must emerge from the quotes above — not from the company description.

Return JSON:
{
  "name": "Evidence-based persona name (e.g. Sensitive Skin Owner)",
  "description": "2-3 sentences using language from the quotes",
  "definingCharacteristic": "The one trait that puts someone in this segment",
  "visualDescriptor": "Physical/contextual description",
  "category": "Goals and Challenges",
  "canHaveSubAvatars": false,
  "score": 7,
  "reasoning": "Which quotes most define this avatar"
}`;

    try {
      const raw = await generateAIContent({ systemPrompt, userMessage, jsonResponse: true });
      const data = raw as Record<string, unknown>;

      const snapshot = buildEvidenceSnapshot(cluster, messages, 0);

      avatars.push({
        id: `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        companyId: company.id,
        clusterId: cluster.id,
        acquisitionSource: 'mining',
        validationStatus: cluster.validationStatus,
        lifecycleStatus: cluster.messageIds.length >= 10 ? 'active' : 'emerging',
        evidenceSnapshot: snapshot,
        name: (data['name'] as string) ?? cluster.label,
        description: (data['description'] as string) ?? '',
        definingCharacteristic: (data['definingCharacteristic'] as string) ?? '',
        visualDescriptor: (data['visualDescriptor'] as string) ?? '',
        category: (data['category'] as Avatar['category']) ?? 'Goals and Challenges',
        canHaveSubAvatars: (data['canHaveSubAvatars'] as boolean) ?? false,
        score: (data['score'] as number) ?? 5,
        reasoning: (data['reasoning'] as string) ?? '',
      });
    } catch {
      continue;
    }
  }

  return avatars;
}
