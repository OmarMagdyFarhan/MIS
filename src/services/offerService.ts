import { Avatar, Company, Offer, OfferScore } from '../types';
import { generateAIContent } from './aiService';
import { buildFewShotContext } from './historyService';

type ConsolidatedOfferJson = {
  product?: string;
  transformation?: string;
  audience?: string;
  generatedOffer?: string;
  score?: OfferScore;
};

type OfferScoreJson = {
  score?: OfferScore;
};

export async function consolidateOffer(company: Company, currentOffer: Offer, avatars: Avatar[]): Promise<Offer> {
  const avatarsWithOffers = avatars.filter(a => a.targetedOffer);
  const fewShot = buildFewShotContext(company.industry, 'hook');
  
  // Graceful Degradation: Use basic descriptions if targeted offers are missing
  const learningSource = avatarsWithOffers.length > 0 
    ? avatarsWithOffers.map(a => `* ${a.targetedOffer?.hook} (Resonated with ${a.name})`).join('\n')
    : avatars.slice(0, 3).map(a => `* ${a.description} (Needs resonance strategy for this profile)`).join('\n');

  const promptContent = `
    Global Company Offer (Current):
    - Product: ${currentOffer.product}
    - Relevance: ${currentOffer.relevance}
    - Hook/Copy: ${currentOffer.generatedOffer}

    Identified Segment Wins (Learn from these hooks):
    ${learningSource}

    Instruction for the NEW Global Core Offer:
    - CRITICAL: Avoid broad, generic, or "marketing-fluff" phrases like "comprehensive retail package", "tailored solutions", or "one-stop shop".
    - BE SPECIFIC: Name the tangible products/services and the actual visceral outcome. (e.g. Instead of "retail package", use "Inventory tracking system that cuts beauty store shrinkage by 15%").
    - USE PROVEN HOOKS: Extract the highest-resonance psychological triggers found in the avatar offers.
    - STRUCTURE: Follow a direct, high-impact structure.
    
    Return the final consolidated offer as a JSON object with these fields:
    - product: (updated product description if needed)
    - transformation: (the unified transformation description)
    - audience: (the unified broad audience definition)
    - generatedOffer: (the new, improved, professional marketing copy for the landing page)
    - reasoning: (one sentence explaining what specifically it learned from the avatars)
    - score: {
        total: number (0-100),
        clarity: number (0-100),
        clarityReasoning: "Short explanation for clarity score",
        relevance: number (0-100),
        relevanceReasoning: "Short explanation for relevance score",
        urgency: number (0-100),
        urgencyReasoning: "Short explanation for urgency score",
        reasoning: "Brief explanation of how the score was calculated compared to the segment-specific insights"
      }
  `;

  try {
    const parsed = await generateAIContent<ConsolidatedOfferJson>({
      systemPrompt: "You are a master of strategic marketing. Return ONLY valid JSON.",
      userMessage: promptContent,
      jsonResponse: true
    });

    const history = currentOffer.history || [];
    
    // Save current as history before replacing (Bounded to 10 entries)
    const updatedHistory = [
      ...history,
      { ...currentOffer, history: undefined }
    ].slice(-10);
    
    return {
      ...currentOffer,
      product: parsed.product || currentOffer.product,
      transformation: parsed.transformation || currentOffer.transformation,
      audience: parsed.audience || currentOffer.audience,
      generatedOffer: parsed.generatedOffer || currentOffer.generatedOffer,
      score: parsed.score,
      history: updatedHistory,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error consolidating offer:', error);
    throw error;
  }
}

export async function computeOfferScore(company: Company, offer: Offer): Promise<Offer> {
  const promptContent = `
    Analyze this marketing offer and provide a precise score (0-100).
    
    Company: ${company.name} (${company.industry})
    Product: ${offer.product}
    Offer Copy: "${offer.generatedOffer}"
    
    Return a JSON object with this exact field:
    - score: {
        total: number (0-100),
        clarity: number (0-100),
        clarityReasoning: "Why this clarity score?",
        relevance: number (0-100),
        relevanceReasoning: "Why this relevance score?",
        urgency: number (0-100),
        urgencyReasoning: "Why this urgency score?",
        reasoning: "Brief explanation of how the score was calculated",
        explanation: "Strategic analysis of the score",
        improvementTip: "One actionable tip to improve the score"
      }
  `;

  try {
    const parsed = await generateAIContent<OfferScoreJson>({
      systemPrompt: "You are a conversion rate optimization expert. Return ONLY valid JSON.",
      userMessage: promptContent,
      jsonResponse: true
    });

    return {
      ...offer,
      score: parsed.score
    };
  } catch (error) {
    console.error('Error computing offer score:', error);
    return offer;
  }
}
