import { EditSignal, IndustryIntelligence, Avatar, Offer, Company } from "../types";
import { StorageManager, STORAGE_KEYS } from "../lib/storage";

const MAX_EDIT_HISTORY = 20;

export const addToEditHistory = async (signal: EditSignal): Promise<void> => {
  const history: EditSignal[] = await StorageManager.load(STORAGE_KEYS.EDIT_HISTORY, []);

  // Don't add if it's the same content
  if (signal.before === signal.after && signal.type === 'user_edit') return;

  const updated = [signal, ...history].slice(0, MAX_EDIT_HISTORY);
  await StorageManager.save(STORAGE_KEYS.EDIT_HISTORY, updated);
};

export const updateIndustryIntelligence = async (company: Company, avatars: Avatar[], offer?: Offer): Promise<void> => {
  const allIntel: Record<string, IndustryIntelligence> = await StorageManager.load(STORAGE_KEYS.INDUSTRY_INTELLIGENCE, {});
  const industry = company.industry;

  if (!allIntel[industry]) {
    allIntel[industry] = {
      topAvatarCategories: [],
      bestTransformationAngles: [],
      offerStructuresThatWorked: [],
      avatarCategoriesDrilledInto: [],
      lowScoringPatterns: [],
      avgScoreImprovement: 0,
      companiesAnalyzed: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  const intel = allIntel[industry];

  const topCategories = avatars
    .filter(a => (a.targetedOffer?.score?.total || 0) >= 70)
    .map(a => a.category);

  const drilledNames = avatars
    .filter(a => a.subAvatars && a.subAvatars.length > 0)
    .map(a => a.name);

  intel.topAvatarCategories = [...new Set([...intel.topAvatarCategories, ...topCategories])].slice(0, 5);
  intel.avatarCategoriesDrilledInto = [...new Set([...intel.avatarCategoriesDrilledInto, ...drilledNames])].slice(0, 5);
  intel.companiesAnalyzed += 1;
  intel.lastUpdated = new Date().toISOString();

  if (offer?.score) {
    intel.avgScoreImprovement = (intel.avgScoreImprovement * (intel.companiesAnalyzed - 1) + offer.score.total) / intel.companiesAnalyzed;
  }

  await StorageManager.save(STORAGE_KEYS.INDUSTRY_INTELLIGENCE, allIntel);
};

export const buildIndustryContext = async (industry: string): Promise<string> => {
  const intel: Record<string, IndustryIntelligence> = await StorageManager.load(STORAGE_KEYS.INDUSTRY_INTELLIGENCE, {});
  const profile = intel[industry];

  if (!profile || profile.companiesAnalyzed < 1) return "";

  return `\n\nINDUSTRY INTELLIGENCE (learned from ${profile.companiesAnalyzed} previous projects in ${industry}):
- Highest performing avatar categories: ${profile.topAvatarCategories.join(', ')}
- Avatar types that users consistently drilled deeper into: ${profile.avatarCategoriesDrilledInto.join(', ')}
${profile.avgScoreImprovement > 0 ? `- Target benchmark score for this industry: ${profile.avgScoreImprovement}%` : ""}

Use these patterns to prioritize high-value segments and avoid low-scoring generic profiles. Put high-confidence matches at the top of the list.`;
};

export const buildFewShotContext = async (industry: string, field?: string): Promise<string> => {
  const history: EditSignal[] = await StorageManager.load(STORAGE_KEYS.EDIT_HISTORY, []);

  const relevant = history
    .filter(e => e.industry === industry && (!field || e.field === field))
    .slice(0, 5);

  if (relevant.length === 0) return "";

  const patterns = relevant.map(e => {
    if (e.type === 'score_improvement') {
      return `Pattern: Score improved by ${e.deltaScore} points. Field: ${e.field}. Pattern identified: ${e.after}`;
    }
    return `
  Field: ${e.field}
  Before (AI wrote): "${e.before}"
  After (user preferred): "${e.after}"`;
  }).join('\n');

  return `\n\nPREFERENCE HISTORY — Learn from these past interactions in the ${industry} industry:\n${patterns}\n\nStrictly follow the user's observed preferences for tone, level of detail, and emotional angle. Avoid patterns marked as "Before" and prefer the "After" patterns.`;
};
