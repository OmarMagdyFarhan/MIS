import { generateAIContent } from "./aiService";
import { Company, Offer } from "../types";

export interface ValidationResult {
  isReadyToGenerate: boolean;
  qualityScore: number;
  weakFields: {
    field: string;
    issue: string;
    severity: 'blocking' | 'degrading';
  }[];
  clarifyingQuestion: string;
  exampleOfGoodVersion: string;
}

export const validateInputQuality = async (company: Company, offer: Offer): Promise<ValidationResult> => {
  const systemPrompt = `You are an input quality validator for a marketing intelligence system.
Your job: score the quality of user-provided business inputs and decide whether they are specific enough to generate accurate customer avatars.
Return ONLY valid JSON.`;

  const userMessage = `Evaluate these inputs:

Brand: ${company.name}
Industry: ${company.industry}
USP: ${company.usp}
Product: ${offer.product}
Transformation: ${offer.transformation}

Return JSON:
{
  "qualityScore": 0,
  "isReadyToGenerate": false,
  "weakFields": [
    { "field": "usp", "issue": "what's wrong", "severity": "blocking|degrading" }
  ],
  "clarifyingQuestion": "one specific question to ask the user right now (the most important one)",
  "exampleOfGoodVersion": "show what a specific USP would look like for this type of business"
}`;

  return (await generateAIContent({
    systemPrompt,
    userMessage,
    jsonResponse: true
  })) as unknown as ValidationResult;
};
