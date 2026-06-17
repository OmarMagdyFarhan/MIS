import type { Avatar, Company, MinedMessage } from '../types';
import type {
  PipelineIntent,
  EvidenceMessage,
  Cluster,
} from '../types/pipeline';
import { useCorpusStore } from '../features/corpus/store';
import { usePipelineStore } from '../stores/pipelineStore';
import { evidenceToMined, minedToEvidenceList } from '../features/corpus/store';
import { analyzeMessages, deriveMarketIntelligence } from '../features/corpus/services/messageMiningService';
import { humanizeError } from '../lib/humanizeError';
import { runMessageMiningAnalysis, AnalysisCallbacks } from '../features/corpus/services/messageMiningOrchestrator';
import {
  proposeClustersFromMessages,
  assignMessagesToClusters,
  AUTO_VALIDATE_COHESION,
  MIN_MESSAGES_FOR_VALIDATION,
} from '../features/corpus/services/clusteringService';
import {
  createAvatarFromMessage,
  improveAvatarWithMessage,
  matchMessageToAvatar,
} from '../features/corpus/services/messageMiningService';
import {
  synthesizeAvatarOfferFormula,
  buildAvatarOfferRecord,
} from './offerSynthesisService';
import { computeOfferScore } from './offerService';
import { AvatarServiceV2 } from './avatarServiceV2';
import { aggregateMVAProfile } from './mvaAggregationService';
import { assertCorpusVersion, CorpusModifiedDuringRunError } from '../types/determinism';
import { aggregateConversionIntelligence } from './conversionIntelligenceService';
import { computeMessageQuality, computeAspectConfidence } from './confidenceService';
import { assignValueElement } from './valueElementService';
import { generateAIContent } from '../ai/legacy';

export interface PipelineRunCallbacks {
  onProgress?: (step: string, current: number, total: number) => void;
  onMessageAnalyzed?: (index: number, message: MinedMessage) => void;
  onAvatarCreated?: (avatar: Avatar) => void;
  onAvatarImproved?: (avatarId: string, patch: Partial<Avatar>) => void;
  onAvatarsUpdated?: (avatars: Avatar[]) => void;
  onClustersProposed?: (clusters: Cluster[]) => void;
  onMarketIntelligenceReady?: (data: import('../types').MarketIntelligenceData) => void;
  onError?: (err: string) => void;
}




export async function runPipelineIntent(
  company: Company,
  intent: PipelineIntent,
  options: {
    existingAvatars?: Avatar[];
    legacyMessages?: MinedMessage[];
    callbacks?: PipelineRunCallbacks;
    recalcScope?: 'affected' | 'all_segments' | 'offers_only' | 'core_only';
    clusterIds?: string[];
    currentOffer?: import('../types').Offer;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const corpusStore = useCorpusStore.getState();
  const pipelineStore = usePipelineStore.getState();
  const companyId = company.id;
  const run = pipelineStore.startRun(companyId, intent);
  const cb = options.callbacks || {};
  const _avatarSvcV2 = new AvatarServiceV2();

  try {
    corpusStore.ensureCorpus(companyId);
    let corpus = corpusStore.getCorpus(companyId);
    // Lock 2 — Corpus Version Lock: record version at run start
    const lockedCorpusVersion = corpus.version;

    /** Assert corpus has not been modified since run started. */
    const checkCorpusVersion = () => {
      const currentVersion = corpusStore.getCorpus(companyId).version;
      assertCorpusVersion(run.id, lockedCorpusVersion, currentVersion);
    };

    const report = (step: string, current: number, total: number) => {
      pipelineStore.updateRunProgress(run.id, step, current, total);
      cb.onProgress?.(step, current, total);
    };

    switch (intent) {
      case 'analyze_corpus':
      case 'incremental_message_add': {
        report('Analyzing evidence', 0, 1);
        const valid = corpus.messages.filter(m => m.rawText.trim().length > 5);
        const texts = valid.filter(m => !m.analyzed).map(m => m.rawText);
        if (texts.length) {
          const results = await analyzeMessages(texts, company);
          let ri = 0;
          const updated = corpus.messages.map(m => {
            if (m.rawText.trim().length > 5 && !m.analyzed) {
              const analysis = results[ri++];
              return {
                ...m,
                analyzed: true,
                analysis: {
                  topic: analysis.topic,
                  conversionFormulaAspect: analysis.conversionFormulaAspect,
                  subAspect: analysis.subAspect,
                  secondaryAspect: analysis.secondaryAspect,
                  secondarySubAspect: analysis.secondarySubAspect,
                  conversionSignalTags: analysis.conversionSignalTags,
                  messageType: analysis.messageType,
                  qualityScore: computeMessageQuality(m.rawText, analysis),
                  emotion: analysis.emotion,

                  conversionAspects: {
                    motivation: {
                      desiredOutcomes: analysis.subAspect === 'Desired Outcome'
                        ? [analysis.topic]
                        : [],
                      painPoints: analysis.subAspect === 'Pain Point / Problem'
                        ? [analysis.topic]
                        : analysis.conversionFormulaAspect === 'Motivation'
                        ? [analysis.topic]
                        : [],
                      purchasePrompts: analysis.subAspect === 'Purchase Prompt'
                        ? [analysis.topic]
                        : [],
                      confidence: computeAspectConfidence('motivation', corpus.messages.map(x => x.rawText), corpus.messages.filter(x => x.analysis?.conversionFormulaAspect === 'Motivation').map(x => x.rawText)),
                      sourceCommentIds: [m.id],
                    },
                    value: {
                      uniqueBenefits: analysis.subAspect === 'Unique Benefit & Advantage'
                        ? [analysis.topic]
                        : [],
                      delightfulFeatures: analysis.subAspect === 'Delightful Product Feature'
                        ? [analysis.topic]
                        : [],
                      dealreakerNeeds: analysis.subAspect === 'Dealbreaker Need / Requirement'
                        ? [analysis.topic]
                        : [],
                      confidence: computeAspectConfidence('value', corpus.messages.map(x => x.rawText), corpus.messages.filter(x => x.analysis?.conversionFormulaAspect === 'Value').map(x => x.rawText)),
                      sourceCommentIds: [m.id],
                    },
                    anxiety: {
                      uncertainties: analysis.subAspect === 'Uncertainty'
                        ? [analysis.topic]
                        : [],
                      objections: analysis.subAspect === 'Objection'
                        ? [analysis.topic]
                        : analysis.conversionFormulaAspect === 'Anxiety'
                        ? [analysis.topic]
                        : [],
                      perceivedRisks: analysis.subAspect === 'Perceived Risk'
                        ? [analysis.topic]
                        : [],
                      confidence: computeAspectConfidence('anxiety', corpus.messages.map(x => x.rawText), corpus.messages.filter(x => x.analysis?.conversionFormulaAspect === 'Anxiety').map(x => x.rawText)),
                      sourceCommentIds: [m.id],
                    },
                  },
                },
                updatedAt: new Date().toISOString(),
              };
            }
            return m;
          });
          corpusStore.setMessages(companyId, updated);
        }
        pipelineStore.setPhase(companyId, 'corpus_analyzed');
        pipelineStore.markLayerStale(companyId, 'clusters');
        // Compute MVA and Conversion Intelligence incrementally
        const updatedCorpus = corpusStore.getCorpus(companyId);
        const mvaProfile = aggregateMVAProfile(companyId, updatedCorpus.messages, updatedCorpus.version);
        pipelineStore.setMVAProfile(companyId, mvaProfile);
        const convIntel = aggregateConversionIntelligence(companyId, updatedCorpus.messages, updatedCorpus.version);
        pipelineStore.setConversionIntelligence(companyId, convIntel);
        break;
      }

      case 'propose_clusters':
      case 'propose_clusters_delta': {
        checkCorpusVersion(); // Lock 2: abort if corpus changed
        report('Clustering evidence', 0, 1);
        corpus = corpusStore.getCorpus(companyId);
        const proposed = await proposeClustersFromMessages(
          company,
          corpus.messages,
          corpus.version,
          options.currentOffer,
        );
        const withAssignment = assignMessagesToClusters(corpus.messages, proposed);
        corpusStore.setMessages(companyId, withAssignment);
        corpusStore.setClusters(companyId, proposed);
        pipelineStore.setPhase(companyId, 'clusters_proposed');
        cb.onClustersProposed?.(proposed);
        break;
      }

      case 'materialize_avatars': {
        report('Materializing segments', 0, 1);
        corpus = corpusStore.getCorpus(companyId);

        const clusters = corpus.clusters.filter(
          c =>
            c.status !== 'merged' &&
            (c.validationStatus === 'validated' || c.status === 'validated') &&
            (options.clusterIds?.length ? options.clusterIds.includes(c.id) : true)
        );

        if (clusters.length === 0) {
          pipelineStore.setPhase(companyId, 'segments_materialized');
          break;
        }

        // Build comments map for AvatarServiceV2
        const commentsMap = new Map<string, EvidenceMessage[]>();
        for (const cluster of clusters) {
          commentsMap.set(
            cluster.id,
            corpus.messages.filter(m => cluster.messageIds.includes(m.id))
          );
        }

        // Use Phase 11 AvatarServiceV2 — cluster-level, evidence-grounded
        const newAvatars = await _avatarSvcV2.generateAvatarsFromClusters(
          company,
          clusters,
          commentsMap
        );

        const avatars = [...(options.existingAvatars || [])];
        for (let i = 0; i < newAvatars.length; i++) {
          const avatar = newAvatars[i];
          const cluster = clusters.find(c => c.id === avatar.clusterId) ?? clusters[i];

          report('Materializing segments', i, newAvatars.length);
          avatars.push(avatar);

          if (cluster) {
            corpusStore.upsertCluster(companyId, {
              ...cluster,
              avatarId: avatar.id,
              updatedAt: new Date().toISOString(),
            });
          }
          // NOTE: onAvatarCreated fires after enrichment below with the enriched avatar
        }

        // Update progress with new avatars (thin, pre-enrichment)
        cb.onAvatarsUpdated?.(avatars);

        // P0-1: Enrich avatars with AI deep-dive (demographics, synthesis, targetedOffer)
        const { deepDiveAvatar } = await import('./avatarService');
        const enrichableAvatars = avatars.filter(a => newAvatars.some(n => n.id === a.id));
        report('Enriching segments with AI', 0, enrichableAvatars.length);
        const enrichedAvatars: Avatar[] = [];
        for (const [enrichIdx, avatar] of enrichableAvatars.entries()) {
          report('Enriching segments with AI', enrichIdx + 1, enrichableAvatars.length);
          try {
            const clusterMsgs = commentsMap.get((avatar as any).clusterId ?? '') ?? [];
            const enriched = await deepDiveAvatar(company, avatar, corpus.messages, clusterMsgs);
            enrichedAvatars.push(enriched);
            cb.onAvatarCreated?.(enriched);
          } catch (err) {
            console.error(`[Pipeline] enrichment failed for ${avatar.id}:`, err);
            enrichedAvatars.push(avatar);
          }
        }
        // Replace new avatars with enriched versions in the avatars array
        const finalAvatars = avatars.map(a => {
          const enriched = enrichedAvatars.find(e => e.id === a.id);
          return enriched ?? a;
        });
        cb.onAvatarsUpdated?.(finalAvatars);

        // P2-3: Write derived data back to clusters
        for (const avatar of finalAvatars) {
          const cluster = clusters.find(c => c.id === (avatar as any).clusterId);
          if (!cluster) continue;
          corpusStore.upsertCluster(companyId, {
            ...cluster,
            dominantProblems:  (avatar as any).generation?.dominantProblems ?? [],
            clusterEmotions:   (avatar as any).emotionalProfile?.primary
                                 ? [(avatar as any).emotionalProfile.primary]
                                 : [],
            jtbdFromCluster:   (avatar as any).jtbd ?? null,
            updatedAt:         new Date().toISOString(),
          });
        }

        pipelineStore.setPhase(companyId, 'segments_materialized');
        break;
      }

      case 'synthesize_avatar_offers': {
        corpus = corpusStore.getCorpus(companyId);
        const avatars = options.existingAvatars || [];
        const intel = pipelineStore.marketIntelligence[companyId];
        const clusters = corpus.clusters.filter(c => c.avatarId);
        for (let i = 0; i < clusters.length; i++) {
          const cluster = clusters[i];
          const avatar = avatars.find(a => a.id === cluster.avatarId);
          if (!avatar) continue;
          report('Synthesizing avatar offers', i, clusters.length);
          const { formula, rendered } = await synthesizeAvatarOfferFormula(
            company,
            avatar,
            cluster,
            corpus.messages,
            intel
          );
          const record = buildAvatarOfferRecord(
            companyId,
            avatar,
            cluster,
            corpus.version,
            run.id,
            formula,
            rendered,
            corpus.messages
          );
          pipelineStore.setAvatarOffer(record);
          const patch: Partial<import('../types').Avatar> = { targetedOffer: {
            offerName: record.rendered?.offerName || record.formula.product,
            transformation: record.formula.transformation,
            hook: record.rendered?.hook || record.formula.specificity,
            reasoning: record.formula.reasonToActNow,
            score: record.score,
          } };
          // Task 8: Auto-assign Primary Element of Value if not already assigned
          try {
            const clusterMsgs = corpus.messages.filter(m => cluster.messageIds.includes(m.id));
            const pve = await assignValueElement(avatar, record, clusterMsgs);
            (patch as any).primaryValueElement = pve;
          } catch (pveErr) {
            // Non-fatal: value element assignment is best-effort
            console.warn('[Pipeline] value element assignment skipped for', avatar.id, pveErr);
          }
          cb.onAvatarImproved?.(avatar.id, patch);
        }
        pipelineStore.setPhase(companyId, 'avatar_offers_ready');
        pipelineStore.clearStale(companyId, ['avatarOffers']);
        break;
      }

      case 'synthesize_market_intel': {
        report('Market intelligence', 0, 1);
        corpus = corpusStore.getCorpus(companyId);
        const mined = evidenceToMined(corpus.messages.filter(m => m.analyzed));
        const intel = await deriveMarketIntelligence(mined, company);
        const full = {
          ...intel,
          companyId,
          derivedFromMessageCount: mined.length,
          lastUpdatedAt: new Date().toISOString(),
        };
        pipelineStore.setMarketIntelligence(companyId, full, corpus.version);
        cb.onMarketIntelligenceReady?.(full);
        pipelineStore.clearStale(companyId, ['marketIntel']);
        break;
      }


      case 'full_downstream_from_clusters': {
        await runPipelineIntent(company, 'materialize_avatars', options);
        await runPipelineIntent(company, 'synthesize_avatar_offers', options);
        await runPipelineIntent(company, 'synthesize_market_intel', options);
        await runPipelineIntent(company, 'render_copy', options);
        break;
      }

      case 'legacy_mining_run': {
        const messages =
          options.legacyMessages ||
          evidenceToMined(corpusStore.getCorpus(companyId).messages);
        const legacyCb: AnalysisCallbacks = {
          onMessageAnalyzed: cb.onMessageAnalyzed || (() => {}),
          onAvatarCreated: cb.onAvatarCreated || (() => {}),
          onAvatarImproved: cb.onAvatarImproved || (() => {}),
          onMarketIntelligenceReady: data => {
            pipelineStore.setMarketIntelligence(companyId, data, corpus.version);
            cb.onMarketIntelligenceReady?.(data);
          },
          onError: err => cb.onError?.(err),
        };
        await runMessageMiningAnalysis(
          messages,
          company,
          options.existingAvatars || [],
          legacyCb
        );
        corpusStore.setMessages(
          companyId,
          minedToEvidenceList(messages, companyId)
        );
        await runPipelineIntent(company, 'propose_clusters', options);
        break;
      }

      case 'render_copy': {
        report('Rendering copy variants', 0, 1);
        corpus = corpusStore.getCorpus(companyId);
        const avatarsForCopy = options.existingAvatars || [];
        const avatarOffers = pipelineStore.getAvatarOffersForCompany(companyId);
        const intel = pipelineStore.marketIntelligence[companyId];
        for (let i = 0; i < avatarsForCopy.length; i++) {
          const avatar = avatarsForCopy[i];
          const offerRecord = avatarOffers.find(o => o.avatarId === avatar.id);
          if (!offerRecord) continue;
          report('Rendering copy variants', i, avatarsForCopy.length);
          const systemPrompt = `You are an expert direct-response copywriter. Render 3 copy variants for this avatar's offer formula.
Return ONLY valid JSON — no markdown, no explanation.`;
          const userMessage = `Avatar: ${avatar.name}
Offer formula:
- Audience: ${offerRecord.formula.audience}
- Transformation: ${offerRecord.formula.transformation}
- Reason to act now: ${offerRecord.formula.reasonToActNow}
- Specificity: ${offerRecord.formula.specificity}
Rendered hook: ${offerRecord.rendered?.hook || ''}
Market intel: ${intel?.coreProblem || 'unknown problem'} → ${intel?.desiredOutcome || 'unknown outcome'}
Return:
{
  "hook": "short punchy hook under 15 words",
  "offerName": "offer name",
  "longCopy": "3–4 sentence pitch using the formula above"
}`;
          try {
            const raw = await generateAIContent({ systemPrompt, userMessage, taskType: 'generation' });
            const clean = String(raw).replace(/\`\`\`json|\`\`\`/g, '').trim();
            const parsed = JSON.parse(clean);
            pipelineStore.setAvatarOffer({
              ...offerRecord,
              rendered: {
                hook: parsed.hook || offerRecord.rendered?.hook,
                offerName: parsed.offerName || offerRecord.rendered?.offerName,
                longCopy: parsed.longCopy || offerRecord.rendered?.longCopy,
                generatedOffer: offerRecord.rendered?.generatedOffer,
              },
            });
          } catch (err) {
            console.warn('[render_copy] failed for avatar', avatar.id, err);
          }
        }
        pipelineStore.setPhase(companyId, 'copy_rendered');
        break;
      }


      default:
        break;
    }

    pipelineStore.finishRun(run.id, 'completed');
    // System state: mark up-to-date when complete
    pipelineStore.setSystemState(companyId, 'up-to-date');
    return { success: true };
  } catch (e) {
    if (e instanceof CorpusModifiedDuringRunError) {
      const msg = 'New evidence was added while analysis was running. Please restart the analysis.';
      pipelineStore.finishRun(run.id, 'failed', msg);
      pipelineStore.setSystemState(companyId, 'new-evidence');
      cb.onError?.(msg);
      return { success: false, error: msg };
    }
    const msg = humanizeError(e);
    pipelineStore.finishRun(run.id, 'failed', msg);
    pipelineStore.setSystemState(companyId, 'up-to-date');
    cb.onError?.(msg);
    return { success: false, error: msg };
  }
}

/** Validate clusters meeting cohesion threshold */
export function validateClustersAuto(companyId: string): void {
  const corpus = useCorpusStore.getState().getCorpus(companyId);
  const updated = corpus.clusters.map(c => {
    if (c.status === 'merged') return c;
    const cohesion = c.cohesionScore ?? 0;
    if (
      c.messageIds.length >= MIN_MESSAGES_FOR_VALIDATION &&
      cohesion >= AUTO_VALIDATE_COHESION
    ) {
      return {
        ...c,
        status: 'validated' as const,
        validationStatus: 'validated' as const,
        updatedAt: new Date().toISOString(),
      };
    }
    return c;
  });
  useCorpusStore.getState().setClusters(companyId, updated);
  usePipelineStore.getState().setPhase(companyId, 'clusters_validated');
}

/** User-triggered downstream recalc */
export async function recalculateDownstream(
  company: Company,
  scope: 'affected' | 'all_segments' | 'offers_only' | 'core_only',
  existingAvatars: Avatar[]
): Promise<void> {
  if (scope === 'offers_only') {
    await runPipelineIntent(company, 'synthesize_avatar_offers', { existingAvatars });
    return;
  }
  await runPipelineIntent(company, 'synthesize_avatar_offers', { existingAvatars });
  await runPipelineIntent(company, 'synthesize_market_intel', { existingAvatars });
}
