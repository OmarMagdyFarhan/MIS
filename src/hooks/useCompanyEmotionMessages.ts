/**
 * useCompanyEmotionMessages — per-company message source for FeelWheel
 * (Phase 15: FeelWheel as hero). Extracted from IntelligenceHub's
 * cross-company FeelWheelWrapper, scoped to a single company's corpus.
 *
 * @module src/hooks/useCompanyEmotionMessages
 */

import React from 'react';
import { useCorpusStore } from '../features/corpus/store';
import type { EvidenceMessage } from '../types/pipeline';

export function useCompanyEmotionMessages(companyId: string | null | undefined): EvidenceMessage[] {
  const corpus = useCorpusStore(s => (companyId ? s.corpora[companyId] : undefined));

  return React.useMemo(() => {
    return corpus?.messages ?? [];
  }, [corpus]);
}
