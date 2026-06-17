import { Company, Offer } from "../types";
import { generateAIContent } from "./aiService";

export const suggestOfferStep = async (
  stepKey: keyof Offer,
  company: Partial<Company>,
  draftOffer: Partial<Offer>
): Promise<string[]> => {
  try {
    const result = await generateAIContent({
      systemPrompt: "You are a world-class marketing strategist. Provide 3 short, high-conversion suggestions for a specific part of a marketing offer formula. Return exactly 3 options as a JSON array of strings.",
      userMessage: `Company: ${company.name} (${company.industry})
USP: ${company.usp}
Step: ${stepKey}
Context so far: ${JSON.stringify(draftOffer)}`,
      jsonResponse: true
    });

    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("AI Suggestion failed:", error);
    return [];
  }
};

export const generateFinalOffer = async (
  company: Partial<Company>,
  draftOffer: Partial<Offer>
): Promise<string> => {
  try {
    const result = await generateAIContent({
      systemPrompt: "Construct a polished, persuasive core marketing offer (1-2 powerful sentences) focusing on transformation, clarity, and status. Use a direct and elegant tone.",
      userMessage: `Company: ${company.name} (${company.industry})
USP: ${company.usp}
Offer Draft: ${JSON.stringify(draftOffer)}`
    });

    return result || "Failed to generate offer.";
  } catch (error) {
    console.error("Final offer generation failed:", error);
    throw error;
  }
};
