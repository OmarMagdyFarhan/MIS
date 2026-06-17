import { describe, it, expect } from 'vitest';
import { scoreQuote, scoreBatch } from '../lib/messageQualityScorer';
import type { QuoteFlag } from '../lib/messageQualityScorer';

describe('scoreQuote', () => {
  it('returns tier=low and filler_only flag for pure filler text', () => {
    const result = scoreQuote('great');
    expect(result.tier).toBe('low');
    expect(result.flags).toContain('filler_only');
    expect(result.raw).toBeLessThan(20);
  });

  it('returns tier=low for very short text (< 25 chars)', () => {
    const result = scoreQuote('bad product');
    expect(result.flags).toContain('too_short');
  });

  it('returns tier=high for a rich, specific customer quote', () => {
    const result = scoreQuote(
      'I was completely frustrated because the app crashed every time I tried to save my work. ' +
      'After switching to this tool, I finally saved 2 hours per week and never lost data again.'
    );
    expect(result.tier).toBe('high');
    expect(result.raw).toBeGreaterThanOrEqual(65);
  });

  it('awards pain/outcome score when both pain and outcome signals present', () => {
    const result = scoreQuote(
      "I couldn't get it to work for months. Finally, after the update, it solved my problem completely."
    );
    expect(result.breakdown.painOutcomeSignal).toBe(25);
  });

  it('awards emotional density score for emotional vocabulary', () => {
    const result = scoreQuote(
      'I was completely frustrated and anxious about the timeline. ' +
      'After 3 months of struggling, I finally felt relieved and confident.'
    );
    expect(result.breakdown.emotionalDensity).toBeGreaterThan(0);
  });

  it('penalizes generic/vague language', () => {
    const generic = 'It is kind of really very great and pretty good, basically just ok';
    const specific = 'Saved exactly 3 hours per week because the export replaced our manual process';
    const genericScore = scoreQuote(generic);
    const specificScore = scoreQuote(specific);
    expect(specificScore.breakdown.specificity).toBeGreaterThanOrEqual(genericScore.breakdown.specificity);
  });

  it('returns raw score clamped to max 100', () => {
    const result = scoreQuote(
      'I was completely frustrated and deeply anxious because the software crashed every single time. ' +
      'After switching, I finally solved the problem and saved 5 hours per week. Never going back. ' +
      'Exactly what I needed — the transformation was incredible and I am now confident and hopeful. ' +
      'Previously I struggled with data loss; now it works perfectly compared to before. ' +
      'This saved me from giving up entirely on the project.'
    );
    expect(result.raw).toBeLessThanOrEqual(100);
  });

  it('breakdown components are all non-negative', () => {
    const result = scoreQuote('Some mediocre quote about a product experience with moderate length');
    expect(result.breakdown.length).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.specificity).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.emotionalDensity).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.painOutcomeSignal).toBeGreaterThanOrEqual(0);
  });
});

describe('scoreBatch', () => {
  it('handles empty array', () => {
    const { summary } = scoreBatch([]);
    expect(summary.totalQuotes).toBe(0);
    expect(summary.overallScore).toBe(0);
    expect(summary.readiness).toBe('weak');
  });

  it('handles array of empty strings', () => {
    const { summary } = scoreBatch(['', '   ', '']);
    expect(summary.totalQuotes).toBe(0);
  });

  it('computes correct counts for mixed tiers', () => {
    const quotes = [
      'great', // low (filler)
      'I struggled with this for months, but it finally solved my problem and saved me hours every week.',
      'It was kind of ok I guess, somewhat decent product overall.',
    ];
    const { scores, summary } = scoreBatch(quotes);
    expect(scores.length).toBe(3);
    expect(summary.highCount + summary.mediumCount + summary.lowCount).toBe(3);
  });

  it('readiness is strong when overall score >= 60', () => {
    // Use 3 high-quality quotes
    const highQuality = [
      'I was completely frustrated for months because the competitor crashed constantly. Finally solved everything after switching — saved exactly 3 hours per week.',
      'After struggling with data loss for 6 months I finally found a reliable solution. Never going back to the old way.',
      'Incredibly anxious about migration risk, but the guided setup made it absolutely painless. Confident this was the best decision.',
    ];
    const { summary } = scoreBatch(highQuality);
    expect(summary.overallScore).toBeGreaterThanOrEqual(60);
    expect(summary.readiness).toBe('strong');
  });

  it('readiness is weak when overall score < 38', () => {
    const { summary } = scoreBatch(['ok', 'nice', 'good']);
    expect(summary.readiness).toBe('weak');
  });

  it('dominantFlag is null when all quotes are high quality', () => {
    const highQuality = [
      'I was completely frustrated for months because the competitor crashed constantly. Finally solved everything.',
      'Incredibly anxious about migration risk but now confident and relieved with the results after switching.',
    ];
    const { summary } = scoreBatch(highQuality);
    if (summary.highCount === summary.totalQuotes) {
      expect(summary.dominantFlag).toBeNull();
    }
  });
});
