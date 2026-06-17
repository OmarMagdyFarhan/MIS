import { generateAIContent } from "./aiService";
import { Avatar, Offer } from "../types";

export interface ScoreFixSuggestion {
  weakestDimension: "clarity" | "relevance" | "urgency";
  currentScore: number;
  diagnosis: string;
  fixSentence: string;
  expectedNewScore: number;
  whereToPutIt: "end of offer copy" | "opening hook" | "CTA button text";
}

export const getScoreFixSuggestion = async (offer: Offer): Promise<ScoreFixSuggestion> => {
  if (!offer) {
    throw new Error("No offer provided for score analysis");
  }

  const systemPrompt = `You are a precision copywriter. You receive a marketing offer with a breakdown score.
Your job: find the weakest scoring dimension (among clarity, relevance, urgency) and fix ONLY that — one sentence rewrite.
Return ONLY valid JSON.`;

  const userMessage = `Current offer:
{
  "product": "${offer.product || 'Unspecified Product'}",
  "generatedOffer": "${offer.generatedOffer || 'No copy generated'}",
  "score": ${JSON.stringify(offer.score || {})}
}

Identify the weakest dimension. Write ONE replacement sentence that specifically raises that dimension.
Return JSON:
{
  "weakestDimension": "urgency",
  "currentScore": 34,
  "diagnosis": "specific reason this dimension is weak",
  "fixSentence": "the exact replacement sentence",
  "expectedNewScore": 85,
  "whereToPutIt": "end of offer copy | opening hook | CTA button text"
}`;

  return (await generateAIContent({
    systemPrompt,
    userMessage,
    jsonResponse: true
  })) as unknown as ScoreFixSuggestion;
};

export function getHighScoringAvatars(avatars: Avatar[], threshold = 7): Avatar[] {
  return avatars
    .filter(a => typeof a.score === 'number' && a.score >= threshold)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
