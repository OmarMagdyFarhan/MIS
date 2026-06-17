import type { Company, Offer, Progress } from '../types';
import { migrateCompanyIntelligence, syncProgressWithPipeline } from './pipelineMigration';

/**
 * Run once after stores hydrate to backfill corpus/clusters/offers from legacy data.
 */
export function migrateAllCompaniesIntelligence(
  companies: Company[],
  progress: Record<string, Progress>,
  offers: Record<string, Offer>
): Record<string, Progress> {
  const next = { ...progress };
  for (const company of companies) {
    const { patchedAvatars } = migrateCompanyIntelligence(
      company,
      progress[company.id],
      offers[company.id]
    );
    if (patchedAvatars.length) {
      next[company.id] = syncProgressWithPipeline(
        {
          ...(next[company.id] || {
            stage1Complete: true,
            stage2Complete: false,
            stage3Complete: false,
          }),
          avatars: patchedAvatars,
        },
        company.id
      );
    } else if (next[company.id]) {
      next[company.id] = syncProgressWithPipeline(next[company.id], company.id);
    }
  }
  void import('../features/corpus/store').then(m => m.useCorpusStore.getState().persist());
  void import('../stores/pipelineStore').then(m => m.usePipelineStore.getState().persist());
  return next;
}
