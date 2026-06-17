/**
 * Offer Steps — Phase 14 stub
 * FormulaEditorModal still uses getOfferSteps for field-by-field AI suggestions.
 * This is retained as an internal editing utility, not a user-facing workflow.
 */
import type { Company, Offer } from '../types';

export interface OfferStep {
  key: keyof Offer;
  label: string;
  description: string;
  placeholder: string;
}

export function getOfferSteps(company?: Company, offer?: Partial<Offer>): OfferStep[] {
  return [
    {
      key: 'audience',
      label: 'Target Audience',
      description: 'Who is this offer for?',
      placeholder: 'e.g. SaaS founders scaling from $1M to $10M ARR',
    },
    {
      key: 'product',
      label: 'What You Offer',
      description: 'What is the core product or service?',
      placeholder: 'e.g. Customer intelligence platform',
    },
    {
      key: 'transformation',
      label: 'Transformation',
      description: 'What changes for the customer?',
      placeholder: 'e.g. Go from guessing to knowing exactly why customers buy',
    },
    {
      key: 'reason',
      label: 'Reason to Act Now',
      description: 'Why should they act today?',
      placeholder: 'e.g. Every month without evidence is a month of missed conversions',
    },
    {
      key: 'relevance',
      label: 'Relevance',
      description: 'Why is this relevant to them right now?',
      placeholder: 'e.g. Growing teams need customer clarity before they scale campaigns',
    },
  ];
}
