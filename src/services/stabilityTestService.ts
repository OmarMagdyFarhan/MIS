import { generateAIContent } from './aiService';
import type { Avatar } from '../types';
import type { EvidenceMessage } from '../types/pipeline';
import { getClaimText } from '../types';

export interface StabilityRunResult {
  runIndex: number;
  realPrimaryMotivation: string;
  realPrimaryBlocker: string;
  confidenceScore: number;
  durationMs: number;
}

export interface StabilityReport {
  avatarId: string;
  avatarName: string;
  runs: StabilityRunResult[];
  motivationStabilityScore: number;   // 0–1: how similar are the 5 motivations
  blockerStabilityScore: number;
  overallStability: 'stable' | 'moderate' | 'noisy';
  uniqueMotivations: string[];
  uniqueBlockers: string[];
  recommendation: string;
}

const STABILITY_RUNS = 5;

/**
 * Runs the synthesis assembly step N times with the same context,
 * compares results, and returns a stability report.
 *
 * IMPORTANT: This calls `generateAIContent` directly on the ASSEMBLY step only
 * (not the full 5-agent loop) to keep cost manageable.
 * Each run gets the same synthesisContext — variance comes from LLM temperature.
 */
export async function runStabilityTest(
  avatar: Avatar,
  clusterMessages: EvidenceMessage[],
  synthesisContext: string,   // the same context string used in deepDiveAvatar
  assemblySystemPrompt: string,
  avatarStructureTemplate: string,
  onProgress?: (completed: number, total: number) => void
): Promise<StabilityReport> {
  const results: StabilityRunResult[] = [];

  for (let i = 0; i < STABILITY_RUNS; i++) {
    const start = Date.now();
    try {
      const raw = await generateAIContent<Partial<Avatar>>({
        systemPrompt: assemblySystemPrompt,
        userMessage: `Context: ${synthesisContext}\n\nFollow this structure:\n${avatarStructureTemplate}`,
        jsonResponse: true,
      });

      results.push({
        runIndex: i,
        realPrimaryMotivation: getClaimText((raw as any)?.synthesis?.realPrimaryMotivation) || '',
        realPrimaryBlocker: getClaimText((raw as any)?.synthesis?.realPrimaryBlocker) || '',
        confidenceScore: (raw as any)?.synthesis?.confidenceScore ?? 0,
        durationMs: Date.now() - start,
      });
    } catch {
      results.push({
        runIndex: i,
        realPrimaryMotivation: 'ERROR',
        realPrimaryBlocker: 'ERROR',
        confidenceScore: 0,
        durationMs: Date.now() - start,
      });
    }
    onProgress?.(i + 1, STABILITY_RUNS);
  }

  return computeStabilityReport(avatar.id, avatar.name, results);
}

export function computeStabilityReport(
  avatarId: string,
  avatarName: string,
  runs: StabilityRunResult[]
): StabilityReport {
  const motivations = runs.map(r => r.realPrimaryMotivation).filter(s => s && s !== 'ERROR');
  const blockers = runs.map(r => r.realPrimaryBlocker).filter(s => s && s !== 'ERROR');

  const uniqueMotivations = [...new Set(motivations.map(normalizeClaimText))];
  const uniqueBlockers = [...new Set(blockers.map(normalizeClaimText))];

  // Stability score: 1 unique = 1.0, N unique = 1/N
  const motivationStabilityScore = motivations.length > 0
    ? 1 / uniqueMotivations.length
    : 0;
  const blockerStabilityScore = blockers.length > 0
    ? 1 / uniqueBlockers.length
    : 0;

  const avgStability = (motivationStabilityScore + blockerStabilityScore) / 2;

  const overallStability: StabilityReport['overallStability'] =
    avgStability >= 0.7 ? 'stable' :
    avgStability >= 0.4 ? 'moderate' : 'noisy';

  const recommendation =
    overallStability === 'stable'
      ? 'Pipeline output is consistent. This avatar can be trusted.'
      : overallStability === 'moderate'
      ? 'Some variance detected. Consider adding more evidence to the cluster before using this avatar in campaigns.'
      : 'High variance across runs. The cluster may be mixed or the evidence insufficient. Run cluster integrity check and consider splitting.';

  return {
    avatarId,
    avatarName,
    runs,
    motivationStabilityScore,
    blockerStabilityScore,
    overallStability,
    uniqueMotivations,
    uniqueBlockers,
    recommendation,
  };
}

/**
 * Normalize a claim string for deduplication:
 * lowercase, strip punctuation, keep first 60 chars as fingerprint.
 */
export function normalizeClaimText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
