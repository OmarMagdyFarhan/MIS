/**
 * nextBestActionService — derives a single, prioritized "what should I do
 * next" suggestion from existing pipeline/offer state (Shopify Setup Guide
 * style). Read-only: never triggers pipeline runs itself, only suggests
 * navigation + an existing user-triggered action.
 *
 * Inputs are intentionally limited to data already modeled by the pipeline
 * (phase, stale flags, avatars, progress) — no new persisted state.
 *
 * @module src/services/nextBestActionService
 */

import type { Avatar, Progress } from '../types';
import type { CompanyPipelineState } from '../types/pipeline';
import type { WorkspaceTab } from '../stores/uiStore';

export interface NextBestAction {
  id: string;
  /** Short, human, Shopify-style microcopy */
  title: string;
  /** One-line supporting detail */
  detail?: string;
  /** CTA label */
  actionLabel: string;
  /** Which workspace tab clicking the CTA should navigate to */
  targetTab: WorkspaceTab;
  /** Whether this represents a "you're all caught up" terminal state */
  isComplete?: boolean;
}

interface NBAInputs {
  pipelineState?: CompanyPipelineState;
  progress?: Progress;
  avatars: Avatar[];
  messageCount: number;
  analyzedMessageCount: number;
  validatedClusterCount: number;
  proposedClusterCount: number;
}

const MIN_EVIDENCE_MESSAGES = 5;

/**
 * Returns the single highest-priority Next Best Action for a company.
 * Order of checks mirrors the natural pipeline progression so the
 * suggestion always points toward the next unblocked step.
 */
export function getNextBestAction(inputs: NBAInputs): NextBestAction {
  const { pipelineState, avatars, messageCount, analyzedMessageCount, validatedClusterCount, proposedClusterCount } = inputs;
  const phase = pipelineState?.phase ?? 'company_complete';

  // 1. Not enough raw evidence yet
  if (messageCount < MIN_EVIDENCE_MESSAGES) {
    const remaining = MIN_EVIDENCE_MESSAGES - messageCount;
    return {
      id: 'add-evidence',
      title: `Add ${remaining} more customer quote${remaining === 1 ? '' : 's'}`,
      detail: 'More evidence means sharper, better-supported customer profiles.',
      actionLabel: 'Add evidence',
      targetTab: 'evidence',
    };
  }

  // 2. Evidence collected but not yet analyzed
  if (analyzedMessageCount < messageCount && phase === 'company_complete') {
    return {
      id: 'analyze-corpus',
      title: 'Analyze your customer quotes',
      detail: `${messageCount - analyzedMessageCount} quotes are ready to be analyzed for themes and emotions.`,
      actionLabel: 'Analyze evidence',
      targetTab: 'evidence',
    };
  }

  // 3. Clusters proposed but not yet reviewed/validated
  if (phase === 'clusters_proposed' || (proposedClusterCount > 0 && validatedClusterCount === 0)) {
    return {
      id: 'review-segments',
      title: `Review ${proposedClusterCount || 'your'} generated segment${proposedClusterCount === 1 ? '' : 's'}`,
      detail: 'Confirm or adjust the patterns we found before building customer profiles.',
      actionLabel: 'Review segments',
      targetTab: 'segments',
    };
  }

  // 4. Segments validated but no avatars yet
  if ((phase === 'clusters_validated' || phase === 'corpus_analyzed') && avatars.length === 0) {
    return {
      id: 'generate-avatars',
      title: 'Generate your customer profiles',
      detail: 'Turn validated segments into rich, evidence-backed avatars.',
      actionLabel: 'Generate avatars',
      targetTab: 'segments',
    };
  }

  // 5. Avatars exist — suggest deep-diving the highest-confidence one
  if (avatars.length > 0) {
    const top = [...avatars]
      .filter(a => !a.parentId)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

    if (top && !top.demographics) {
      return {
        id: 'deep-dive-avatar',
        title: `Deep dive "${top.name}"`,
        detail: 'Your highest-confidence customer profile is ready for a closer look.',
        actionLabel: 'Open profile',
        targetTab: 'segments',
      };
    }

    if (phase === 'segments_materialized' || phase === 'avatar_offers_ready') {
      return {
        id: 'view-intelligence',
        title: 'Explore your buying insights',
        detail: 'See market intelligence and emotional patterns drawn from your evidence.',
        actionLabel: 'Open Intelligence',
        targetTab: 'intelligence',
      };
    }

    if (phase === 'pipeline_complete') {
      return {
        id: 'view-strategy',
        title: 'Review your strategy & offers',
        detail: 'Your profiles and offers are ready to put to work.',
        actionLabel: 'Open Strategy',
        targetTab: 'strategy',
      };
    }
  }

  // 6. Everything looks current
  return {
    id: 'all-caught-up',
    title: "You're all caught up",
    detail: 'Add new evidence anytime to keep your intelligence fresh.',
    actionLabel: 'Add evidence',
    targetTab: 'evidence',
    isComplete: true,
  };
}
