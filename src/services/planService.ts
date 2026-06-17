import { generateAIContent } from "./aiService";
import { Avatar, Company, Offer } from "../types";

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  type: 'Copywriting' | 'Design' | 'Technical' | 'Strategy';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeEstimate: string;
}

export const generateExecutionPlan = async (company: Company, offer: Offer | undefined, avatar: Avatar): Promise<ActionItem[]> => {
  const systemPrompt = `You are a high-performance business executor and operations lead.
Your task is to take a deep-dive persona analysis and translate it into 5-7 IMMEDIATE ACTIONABLE STEPS.

These steps should answer the question: "What do I actually do today to start selling to this person?"

For each step, provide:
- "title": Clear action (e.g., "Write the Hook for FB Ad")
- "description": Exactly what to do and why it matters for this specific avatar
- "priority": based on ROI
- "type": (Copywriting | Design | Technical | Strategy)
- "difficulty": (Easy | Medium | Hard)
- "timeEstimate": (e.g. "30 mins", "2 hours")

Return ONLY a JSON array of these objects.`;

  const userMessage = `Brand: ${company.name}
Core Offer: ${offer?.generatedOffer || "Evidence-based"}
Avatar: ${avatar.name}
Key Transformation: ${avatar.transformation?.hook}

Based on this avatar's specific pains (anxiety: ${avatar.questionnaire?.anxious}) and motivations (${avatar.questionnaire?.motivation}), generate 5-7 actionable tasks.`;

  let items: unknown = await generateAIContent({
    systemPrompt,
    userMessage,
    jsonResponse: true
  });

  if (!Array.isArray(items) && items && typeof items === 'object') {
    const wrapped = items as Record<string, unknown>;
    const arrayKey = Object.keys(wrapped).find(key => Array.isArray(wrapped[key]));
    if (arrayKey) items = wrapped[arrayKey];
  }

  if (!Array.isArray(items)) {
    console.error("AI did not return an array for execution plan:", items);
    return [];
  }

  return items.map((item: any, i: number) => ({
    ...item,
    id: `action_${Date.now()}_${i}`
  }));
};
