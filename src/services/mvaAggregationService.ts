/**
 * MVA Aggregation Service — Phase 14
 * Aggregates Motivation / Value / Anxiety signals from analyzed evidence
 * into a CompanyMVAProfile. This materialises the hidden intelligence
 * that was previously computed per-message but never persisted.
 *
 * No AI calls required — pure aggregation from existing analysis data.
 */

import type { EvidenceMessage } from '../types/pipeline';

export interface WeightedSignal {
  text: string;
  weight: number;
  sourceMessageIds: string[];
}

export interface MVADomain {
  signals: WeightedSignal[];
  totalWeight: number;
  messageCount: number;
}

export interface CompanyMVAProfile {
  companyId: string;
  motivation: {
    desiredOutcomes: WeightedSignal[];
    painPoints: WeightedSignal[];
    purchasePrompts: WeightedSignal[];
  };
  value: {
    uniqueBenefits: WeightedSignal[];
    delightfulFeatures: WeightedSignal[];
    dealbreakers: WeightedSignal[];
  };
  anxiety: {
    uncertainties: WeightedSignal[];
    objections: WeightedSignal[];
    perceivedRisks: WeightedSignal[];
  };
  coverage: {
    motivationCovered: boolean;
    valueCovered: boolean;
    anxietyCovered: boolean;
    domainsCount: number;
  };
  computedAt: string;
  corpusVersion: number;
}

function mergeSignals(signals: WeightedSignal[]): WeightedSignal[] {
  const map = new Map<string, WeightedSignal>();
  for (const s of signals) {
    const key = s.text.toLowerCase().trim().slice(0, 60);
    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.weight += s.weight;
      existing.sourceMessageIds.push(...s.sourceMessageIds);
    } else {
      map.set(key, { ...s, sourceMessageIds: [...s.sourceMessageIds] });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.weight - a.weight);
}

/**
 * Build a CompanyMVAProfile from all analyzed messages for a company.
 * Pure aggregation — no AI calls.
 */
export function aggregateMVAProfile(
  companyId: string,
  messages: EvidenceMessage[],
  corpusVersion: number
): CompanyMVAProfile {
  const analyzed = messages.filter(m => m.analyzed && m.analysis);

  const motivation = {
    desiredOutcomes: [] as WeightedSignal[],
    painPoints: [] as WeightedSignal[],
    purchasePrompts: [] as WeightedSignal[],
  };
  const value = {
    uniqueBenefits: [] as WeightedSignal[],
    delightfulFeatures: [] as WeightedSignal[],
    dealbreakers: [] as WeightedSignal[],
  };
  const anxiety = {
    uncertainties: [] as WeightedSignal[],
    objections: [] as WeightedSignal[],
    perceivedRisks: [] as WeightedSignal[],
  };

  for (const msg of analyzed) {
    const a = msg.analysis!;
    const ca = a.conversionAspects;
    if (!ca) continue; // Skip messages without phase10 analysis
    const quality = a.qualityScore ?? 0.5;
    const intensity = a.emotionIntensity ?? 0.5;
    const weight = quality * (1 + intensity * 0.5);

    const toSignal = (text: string): WeightedSignal => ({
      text,
      weight,
      sourceMessageIds: [msg.id],
    });

    // Motivation
    for (const t of ca.motivation?.desiredOutcomes ?? []) motivation.desiredOutcomes.push(toSignal(t));
    for (const t of ca.motivation?.painPoints ?? []) motivation.painPoints.push(toSignal(t));
    for (const t of ca.motivation?.purchasePrompts ?? []) motivation.purchasePrompts.push(toSignal(t));

    // Value
    for (const t of ca.value?.uniqueBenefits ?? []) value.uniqueBenefits.push(toSignal(t));
    for (const t of ca.value?.delightfulFeatures ?? []) value.delightfulFeatures.push(toSignal(t));
    for (const t of (ca.value as any)?.dealreakerNeeds ?? (ca.value as any)?.dealbreakerNeeds ?? []) value.dealbreakers.push(toSignal(t));

    // Anxiety
    for (const t of ca.anxiety?.uncertainties ?? []) anxiety.uncertainties.push(toSignal(t));
    for (const t of ca.anxiety?.objections ?? []) anxiety.objections.push(toSignal(t));
    for (const t of ca.anxiety?.perceivedRisks ?? []) anxiety.perceivedRisks.push(toSignal(t));
  }

  const motivationCovered =
    motivation.desiredOutcomes.length > 0 ||
    motivation.painPoints.length > 0 ||
    motivation.purchasePrompts.length > 0;
  const valueCovered =
    value.uniqueBenefits.length > 0 ||
    value.delightfulFeatures.length > 0 ||
    value.dealbreakers.length > 0;
  const anxietyCovered =
    anxiety.uncertainties.length > 0 ||
    anxiety.objections.length > 0 ||
    anxiety.perceivedRisks.length > 0;

  return {
    companyId,
    motivation: {
      desiredOutcomes: mergeSignals(motivation.desiredOutcomes),
      painPoints: mergeSignals(motivation.painPoints),
      purchasePrompts: mergeSignals(motivation.purchasePrompts),
    },
    value: {
      uniqueBenefits: mergeSignals(value.uniqueBenefits),
      delightfulFeatures: mergeSignals(value.delightfulFeatures),
      dealbreakers: mergeSignals(value.dealbreakers),
    },
    anxiety: {
      uncertainties: mergeSignals(anxiety.uncertainties),
      objections: mergeSignals(anxiety.objections),
      perceivedRisks: mergeSignals(anxiety.perceivedRisks),
    },
    coverage: {
      motivationCovered,
      valueCovered,
      anxietyCovered,
      domainsCount: [motivationCovered, valueCovered, anxietyCovered].filter(Boolean).length,
    },
    computedAt: new Date().toISOString(),
    corpusVersion,
  };
}

/**
 * Returns the top N signals across all MVA domains ranked by weight.
 * Used for avatar readiness scoring and Intelligence Hub summary.
 */
export function getTopSignals(profile: CompanyMVAProfile, n = 5): WeightedSignal[] {
  const all: WeightedSignal[] = [
    ...profile.motivation.desiredOutcomes,
    ...profile.motivation.painPoints,
    ...profile.value.uniqueBenefits,
    ...profile.anxiety.objections,
    ...profile.anxiety.perceivedRisks,
  ];
  return all.sort((a, b) => b.weight - a.weight).slice(0, n);
}
