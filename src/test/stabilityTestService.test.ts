import { describe, it, expect } from 'vitest';
import { computeStabilityReport, normalizeClaimText } from '../services/stabilityTestService';

const stableRuns = Array.from({ length: 5 }, (_, i) => ({
  runIndex: i,
  realPrimaryMotivation: 'Worried about skin irritation from harness rubbing',
  realPrimaryBlocker: 'Cannot find soft lining options',
  confidenceScore: 0.82,
  durationMs: 1200,
}));

const noisyRuns = [
  { runIndex: 0, realPrimaryMotivation: 'Worried about skin irritation', realPrimaryBlocker: 'No soft options', confidenceScore: 0.7, durationMs: 1000 },
  { runIndex: 1, realPrimaryMotivation: 'Concerned about price increase', realPrimaryBlocker: 'Too expensive', confidenceScore: 0.5, durationMs: 1100 },
  { runIndex: 2, realPrimaryMotivation: 'Pulling behavior is dangerous', realPrimaryBlocker: 'Dog escapes harness', confidenceScore: 0.4, durationMs: 900 },
  { runIndex: 3, realPrimaryMotivation: 'Fit is inconsistent across brands', realPrimaryBlocker: 'Sizing is unclear', confidenceScore: 0.6, durationMs: 1050 },
  { runIndex: 4, realPrimaryMotivation: 'Looking for lightweight option', realPrimaryBlocker: 'Too bulky', confidenceScore: 0.55, durationMs: 980 },
];

describe('computeStabilityReport', () => {
  it('returns stable for identical runs', () => {
    const report = computeStabilityReport('av1', 'Test', stableRuns);
    expect(report.overallStability).toBe('stable');
    expect(report.motivationStabilityScore).toBe(1);
  });

  it('returns noisy for completely different runs', () => {
    const report = computeStabilityReport('av1', 'Test', noisyRuns);
    expect(report.overallStability).toBe('noisy');
    expect(report.uniqueMotivations).toHaveLength(5);
  });

  it('recommendation is defined for all stability levels', () => {
    expect(computeStabilityReport('av1', 'Test', stableRuns).recommendation).toBeTruthy();
    expect(computeStabilityReport('av1', 'Test', noisyRuns).recommendation).toBeTruthy();
  });
});

describe('normalizeClaimText', () => {
  it('lowercases and trims', () =>
    expect(normalizeClaimText('  Worried About PRICE  ')).toBe('worried about price'));
  it('strips punctuation', () =>
    expect(normalizeClaimText("Can't find it!")).toBe('cant find it'));
  it('truncates to 60 chars', () => {
    const long = 'a'.repeat(100);
    expect(normalizeClaimText(long)).toHaveLength(60);
  });
});
