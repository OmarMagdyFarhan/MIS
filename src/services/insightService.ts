import { generateAIContent } from "./aiService";
import { Company, ActionableInsight } from "../types";
import { buildMarketContext } from "./marketContext";
import { buildIndustryContext } from "./historyService";

export type InsightStage = 'company' | 'offer' | 'avatars' | 'deepdive' | 'consolidated';

export const generateStageInsights = async (
  stage: InsightStage,
  data: any,
  company: Company
): Promise<ActionableInsight[]> => {
  
  const marketContext = buildMarketContext(company.country);
  const industryContext = buildIndustryContext(company.industry);
  
  const prompt = buildInsightPrompt(stage, data);
  
  try {
    const result = await generateAIContent<{ insights?: ActionableInsight[] }>({
      systemPrompt: `You are a strategic marketing advisor with expertise in the ${company.country} market.
Your goal is to provide specific, grounded, immediately actionable next steps based on the current pipeline data.
The actions must be:
- Specific (not generic advice)
- Grounded in the provided data
- Immediately executable

${marketContext}
${industryContext}

Return ONLY valid JSON in the format:
{
  "insights": [
    {
      "type": "warning" | "opportunity" | "action",
      "title": "short label (5 words max)",
      "observation": "what you noticed in their data",
      "action": "the specific thing to do - in one sentence",
      "why": "why this matters for their pipeline",
      "urgency": "before_next_stage" | "anytime"
    }
  ]
}`,
      userMessage: prompt,
      jsonResponse: true
    });
    
    return result.insights || [];
  } catch (error) {
    console.error("Failed to generate actionable insights:", error);
    return [];
  }
};

const buildInsightPrompt = (stage: InsightStage, data: any): string => {
  if (!data) return "Generate 3 general actionable marketing insights.";
  
  switch (stage) {
    case 'company':
      return `Company profile just submitted:
Brand: ${data.name || 'Unnamed'}
Industry: ${data.industry || 'Unspecified'}
USP: "${data.usp || 'None'}"
Specializations: ${JSON.stringify(data.specializations || [])}

Generate 3 actionable insights for right now.`;

    case 'offer':
      return `Offer just generated:
Product: ${data.product || 'Unspecified'}
Transformation: "${data.transformation || 'None'}"
Audience: "${data.audience || 'None'}"
Generated offer: "${data.generatedOffer || 'None'}"
Score: ${JSON.stringify(data.score || {})}

Generate 3 actionable insights grounded in this specific offer + market.`;

    case 'avatars':
      const avs = Array.isArray(data.avatars) ? data.avatars : [];
      return `Avatars generated for this brand:
Scores: ${JSON.stringify(avs.map((a: any) => a?.score || {}))}
Categories: ${JSON.stringify(avs.map((a: any) => a?.category || 'Unspecified'))}
canHaveSubAvatars: ${JSON.stringify(avs.map((a: any) => a?.canHaveSubAvatars || false))}

Generate 3 actionable insights.`;

    case 'deepdive':
      if (!data.avatar) return "Generate 3 general actionable marketing insights.";
      return `Avatar deep-dive complete:
Avatar: ${data.avatar.name || 'Unnamed'} (${data.avatar.description || 'No description'})
Targeted offer score: ${JSON.stringify(data.avatar.targetedOffer?.score || {})}
Key Findings: ${JSON.stringify({
        hesitations: data.avatar.hesitations || [],
        sources: data.avatar.sources || [],
        marketIntelligence: data.avatar.marketIntelligence || {}
      })}

Generate 3 actionable insights for this specific avatar.`;

    case 'consolidated':
      return `Offer consolidation complete.
Before consolidation: ${data.beforeScore}
After consolidation: ${data.afterScore}
Biggest gain: ${data.biggestGain}
Weakest link: ${data.weakestLink}

Pipeline state: ${data.avatarsCount} avatars completed, ${data.unprocessedCount} avatars skipped.
Top avatar drilled: ${data.topAvatarDrilled ? 'Yes' : 'No'}

Generate 3 actionable insights for what to do next.`;

    default:
      return "Generate 3 general actionable marketing insights.";
  }
};
