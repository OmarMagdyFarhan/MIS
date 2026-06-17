import { MinedMessage, Avatar, Company, Offer, MarketIntelligenceData } from '../../../types';
import {
  analyzeMessages,
  matchMessageToAvatar,
  createAvatarFromMessage,
  improveAvatarWithMessage,
  deriveMarketIntelligence,
} from './messageMiningService';
import { filterRelevantMessages, scoreMessageQuality } from './relevanceFilterService';
import { PIPELINE_THRESHOLDS } from '../../../constants/pipelineThresholds';

export interface AnalysisCallbacks {
  onMessageAnalyzed: (index: number, message: MinedMessage) => void;
  onAvatarCreated: (avatar: Avatar) => void;
  onAvatarImproved: (avatarId: string, patch: Partial<Avatar>) => void;
  onMarketIntelligenceReady: (data: MarketIntelligenceData) => void;
  onError: (err: string) => void;
}

export async function runMessageMiningAnalysis(
  rawMessages: MinedMessage[],
  company: Company,
  existingAvatars: Avatar[],
  callbacks: AnalysisCallbacks,
  offer?: Offer
): Promise<MinedMessage[]> {
  // ── Issue 11: Quality gate ────────────────────────────────────────────────
  const qualityFiltered = rawMessages.filter(m => {
    const q = scoreMessageQuality(m.text);
    if (!q.pass) console.debug(`[QualityGate] Rejected: "${m.text.slice(0, 50)}" — ${q.reason}`);
    return q.pass;
  });

  // ── Issue 6: Batch size cap ───────────────────────────────────────────────
  if (qualityFiltered.length > PIPELINE_THRESHOLDS.MAX_MESSAGES_PER_BATCH) {
    callbacks.onError(
      `Batch too large: ${qualityFiltered.length} messages. Maximum is ${PIPELINE_THRESHOLDS.MAX_MESSAGES_PER_BATCH} per run. Split into smaller batches.`
    );
    throw new Error(`Batch size ${qualityFiltered.length} exceeds limit ${PIPELINE_THRESHOLDS.MAX_MESSAGES_PER_BATCH}`);
  }

  if (!qualityFiltered.length) throw new Error('No valid messages to analyze');

  // ── Issue 1: Relevance filter ────────────────────────────────────────────
  const relevanceResults = await filterRelevantMessages(
    qualityFiltered.map(m => m.text),
    company,
    offer
  );
  const validMessages = qualityFiltered.filter((_, i) => relevanceResults[i]?.isRelevant !== false);

  if (!validMessages.length) throw new Error('No valid messages to analyze');

  const texts = validMessages.map(m => m.text);
  const analysisResults = await analyzeMessages(texts, company, offer);

  const enriched: MinedMessage[] = validMessages.map((m, i) => ({
    ...m,
    ...analysisResults[i],
    analyzed: true,
  }));

  const workingAvatars = [...existingAvatars];

  for (let i = 0; i < enriched.length; i++) {
    const msg = enriched[i];

    try {
      const matchedId = await matchMessageToAvatar(msg, workingAvatars, company);

      if (matchedId) {
        const matched = workingAvatars.find(a => a.id === matchedId)!;
        const patch = await improveAvatarWithMessage(matched, msg, company, offer);
        enriched[i] = { ...msg, matchedAvatarId: matchedId };
        callbacks.onAvatarImproved(matchedId, patch);
        const idx = workingAvatars.findIndex(a => a.id === matchedId);
        if (idx >= 0) workingAvatars[idx] = { ...workingAvatars[idx], ...patch };
      } else {
        const newAvatarData = await createAvatarFromMessage(msg, company, workingAvatars, offer);
        const newAvatar: Avatar = {
          id: `avatar_mined_${Date.now()}_${i}`,
          companyId: company.id,
          canHaveSubAvatars: false,
          ...newAvatarData,
        } as Avatar;
        enriched[i] = { ...msg, matchedAvatarId: null };
        workingAvatars.push(newAvatar);
        callbacks.onAvatarCreated(newAvatar);
      }
    } catch {
      enriched[i] = { ...msg, matchedAvatarId: undefined };
    }

    callbacks.onMessageAnalyzed(i, enriched[i]);
  }

  try {
    const intel = await deriveMarketIntelligence(enriched, company, offer);
    callbacks.onMarketIntelligenceReady({
      ...intel,
      companyId: company.id,
      derivedFromMessageCount: enriched.length,
      lastUpdatedAt: new Date().toISOString(),
    });
  } catch {
    callbacks.onError('Market intelligence derivation failed — avatars still updated');
  }

  return enriched;
}
