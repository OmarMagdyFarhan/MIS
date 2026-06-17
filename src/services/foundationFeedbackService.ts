import type { FoundationAnswer } from '../types/foundation';
import { usePipelineStore } from '../stores/pipelineStore';
import { useOfferStore } from '../stores/offerStore';
import { useCorpusStore } from '../features/corpus/store';

export interface FeedbackResult {
  applied: boolean;
  pipelineUpdates: string[];
}

export function applyFoundationAnswer(
  companyId: string,
  answer: FoundationAnswer
): FeedbackResult {
  const updates: string[] = [];
  const pipelineStore = usePipelineStore.getState();
  const intel = pipelineStore.marketIntelligence[companyId];

  // ── Market awareness level ──────────────────────────────────────────────
  if (answer.questionId === 'market_awareness' && answer.chosenValue) {
    if (intel) {
      pipelineStore.setMarketIntelligence(companyId, {
        ...intel,
        problemAwarenessLevel: answer.chosenValue as any,
      });
      updates.push('Awareness level updated in market intelligence.');
    }
    // Also mark avatar offers stale — awareness changes how offers are framed
    pipelineStore.markLayerStale(companyId, 'avatar_offers');
    updates.push('Avatar offers marked stale — awareness level changed.');
  }

  // ── Core problem ────────────────────────────────────────────────────────
  if (answer.questionId === 'market_core_problem' && answer.chosenValue) {
    if (intel) {
      pipelineStore.setMarketIntelligence(companyId, {
        ...intel,
        coreProblem: answer.chosenValue,
      });
      updates.push('Core problem updated in market intelligence.');
    }
    // Re-label clusters that match this problem
    const corpus = useCorpusStore.getState().getCorpus(companyId);
    const relevantClusters = corpus.clusters.filter(c =>
      c.dominantTypes?.includes('Objection') ||
      c.dominantAspects?.includes('Anxiety')
    );
    if (relevantClusters.length > 0) {
      updates.push(`${relevantClusters.length} segment(s) may benefit from re-analysis with updated core problem.`);
      pipelineStore.markLayerStale(companyId, 'clusters');
    }
  }

  // ── Differentiator / product changes ────────────────────────────────────
  if (
    answer.questionId === 'product_differentiator' ||
    answer.questionId.startsWith('model_')
  ) {
    updates.push('Core offer marked stale — differentiator changed. Re-run synthesis.');

    // Also stale avatar offers
    pipelineStore.markLayerStale(companyId, 'avatar_offers');
    updates.push('Avatar offers marked stale — will reflect new differentiator on next run.');
  }

  // ── Brand positioning changes ────────────────────────────────────────────
  if (answer.questionId.startsWith('brand_') && answer.chosenValue) {
    updates.push('Brand positioning updated — core offer will reflect this on next synthesis.');
  }

  // ── Target segment changes ───────────────────────────────────────────────
  if (answer.questionId === 'market_target_segment' && answer.chosenValue) {
    // Update market intel
    if (intel) {
      pipelineStore.setMarketIntelligence(companyId, {
        ...intel,
        targetSegment: answer.chosenValue,
      });
    }
    // Mark avatars stale — segment focus changed
    pipelineStore.markLayerStale(companyId, 'avatars');
    updates.push(`Target segment set to "${answer.chosenValue}" — avatars will be re-prioritised on next run.`);
  }

  return { applied: true, pipelineUpdates: updates };
}
