import { generateAIContent } from "./aiService";
import { Avatar, Company, Offer, ScoreDeltaInsight, RankedAvatarMetadata } from "../types";
import { buildMarketContext } from "./marketContext";

const SCORE_DELTA_PROMPT = `You are a marketing intelligence analyst. Your job: explain score changes in plain language so the user understands what the pipeline did and why the output improved.
Return ONLY valid JSON matching this structure:
{
  "deltaTotal": number,
  "biggestGain": "string",
  "gainAmount": number,
  "narrative": "one sentence: what changed and why — specific, not generic",
  "whatAvatarsDid": "one sentence: what the avatar consolidation step contributed specifically",
  "nextWeakLink": "the lowest current score dimension",
  "suggestion": "one sentence: actionable advice"
}
`;

const AVATAR_RANKING_PROMPT = `You are a marketing intelligence UI layer. Given a set of avatars and a MARKET CONTEXT, decide their display priority and which should be collapsed in the UI by default.
Focus on:
- High Business Potential (which avatar is more likely to buy in THIS specific market?)
- Cultural Fit (does the avatar's motivation align with the market's values?)
- Economic Feasibility (can this segment realistically afford the offer in this country?)
- Digital Behavior (can we reach them via the digital channels prevalent here?)

Return ONLY a valid JSON array of objects, one for each avatar, in the order they should be displayed:
[
  {
    "id": "string (the avatar id)",
    "displayRank": number,
    "displayState": "expanded | collapsed",
    "collapseReason": "one short reason shown to user if collapsed (e.g. 'Low income for this price' or 'Cultural misfit')",
    "priorityLabel": "primary | secondary | low-priority",
    "actionSuggestion": "what the user should do next"
  }
]`;

export const generateScoreDelta = async (offerV1: Offer, offerV2: Offer): Promise<ScoreDeltaInsight> => {
  return (await generateAIContent({
    systemPrompt: SCORE_DELTA_PROMPT,
    userMessage: `V1 Offer: "${offerV1.generatedOffer}"\nV1 Score: ${JSON.stringify(offerV1.score)}\n\nV2 Offer: "${offerV2.generatedOffer}"\nV2 Score: ${JSON.stringify(offerV2.score)}`,
    jsonResponse: true
  })) as unknown as ScoreDeltaInsight;
};

export const rankAvatarsForDisplay = async (avatars: Avatar[], company: Company): Promise<(Avatar & { uiMetadata: RankedAvatarMetadata })[]> => {
  const avatarList = avatars.map(a => ({
    id: a.id,
    name: a.name,
    score: a.score,
    category: a.category,
    hasDeepDive: !!a.demographics,
    targetedOfferScore: a.targetedOffer?.score?.total ?? null
  }));

  const marketContextString = buildMarketContext(company.country || 'Global');

  let rankingResults: unknown = await generateAIContent({
    systemPrompt: AVATAR_RANKING_PROMPT,
    userMessage: `${marketContextString}\n\nCompany: ${company.name}\nIndustry: ${company.industry}\nAvatars: ${JSON.stringify(avatarList)}`,
    jsonResponse: true
  });

  // Handle object wrapping
  if (!Array.isArray(rankingResults) && rankingResults && typeof rankingResults === 'object') {
    const wrapped = rankingResults as Record<string, unknown>;
    const arrayKey = Object.keys(wrapped).find(key => Array.isArray(wrapped[key]));
    if (arrayKey) {
      rankingResults = wrapped[arrayKey];
    } else {
      // If no array found inside, treat it as a single object if it has the required fields
      const single = rankingResults as RankedAvatarMetadata & { id?: string };
      if (single.id && single.displayRank) {
        rankingResults = [rankingResults];
      }
    }
  }

  if (!Array.isArray(rankingResults)) {
    console.error("AI did not return an array for avatar ranking:", rankingResults);
    rankingResults = [];
  }

  const rankingList = rankingResults as Array<RankedAvatarMetadata & { id: string }>;

  return avatars.map(a => {
    const meta = rankingList.find(r => r.id === a.id);
    return {
      ...a,
      uiMetadata: meta ? {
        displayRank: meta.displayRank,
        displayState: (meta.displayState === 'collapsed' ? 'collapsed' : 'expanded') as 'expanded' | 'collapsed',
        collapseReason: meta.collapseReason,
        priorityLabel: meta.priorityLabel as any,
        actionSuggestion: meta.actionSuggestion
      } : {
        displayRank: 99,
        displayState: 'expanded' as const,
        priorityLabel: 'secondary' as const,
        actionSuggestion: 'Review details'
      }
    };
  }).sort((a, b) => (a.uiMetadata?.displayRank ?? 99) - (b.uiMetadata?.displayRank ?? 99));
};
