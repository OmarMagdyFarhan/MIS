import { describe, it, expect } from 'vitest';
import { getClaimText, getClaimSources, normalizeClaim } from '../types';

describe('getClaimText', () => {
  it('returns string directly', () =>
    expect(getClaimText('plain text')).toBe('plain text'));
  it('returns claim from CitedClaim object', () =>
    expect(getClaimText({ claim: 'cited text', supportingMessageIds: ['m1'], confidence: 0.8 }))
      .toBe('cited text'));
  it('returns empty string for undefined', () =>
    expect(getClaimText(undefined)).toBe(''));
  it('returns empty string for empty string', () =>
    expect(getClaimText('')).toBe(''));
});

describe('getClaimSources', () => {
  it('returns empty array for plain string', () =>
    expect(getClaimSources('plain')).toEqual([]));
  it('returns supportingMessageIds for CitedClaim', () =>
    expect(getClaimSources({ claim: 'x', supportingMessageIds: ['m1', 'm2'], confidence: 0.9 }))
      .toEqual(['m1', 'm2']));
  it('returns empty array for undefined', () =>
    expect(getClaimSources(undefined)).toEqual([]));
  it('returns empty array for CitedClaim with no messages', () =>
    expect(getClaimSources({ claim: 'x', supportingMessageIds: [], confidence: 0.3 }))
      .toEqual([]));
});

describe('normalizeClaim', () => {
  it('returns undefined for undefined input', () =>
    expect(normalizeClaim(undefined)).toBeUndefined());

  it('wraps plain string in CitedClaim with lowConfidence=true', () => {
    const result = normalizeClaim('plain string');
    expect(result?.lowConfidence).toBe(true);
    expect(result?.supportingMessageIds).toEqual([]);
    expect(result?.claim).toBe('plain string');
    expect(result?.confidence).toBe(0);
  });

  it('sets lowConfidence=true when < 3 messages', () => {
    const result = normalizeClaim({ claim: 'x', supportingMessageIds: ['m1'], confidence: 0.7 });
    expect(result?.lowConfidence).toBe(true);
  });

  it('sets lowConfidence=true when exactly 2 messages', () => {
    const result = normalizeClaim({ claim: 'x', supportingMessageIds: ['m1', 'm2'], confidence: 0.7 });
    expect(result?.lowConfidence).toBe(true);
  });

  it('sets lowConfidence=false when >= 3 messages', () => {
    const result = normalizeClaim({
      claim: 'x', supportingMessageIds: ['m1', 'm2', 'm3'], confidence: 0.9
    });
    expect(result?.lowConfidence).toBe(false);
  });

  it('sets lowConfidence=false when > 3 messages', () => {
    const result = normalizeClaim({
      claim: 'y', supportingMessageIds: ['m1', 'm2', 'm3', 'm4'], confidence: 0.95
    });
    expect(result?.lowConfidence).toBe(false);
  });

  it('preserves existing fields on CitedClaim', () => {
    const result = normalizeClaim({
      claim: 'test claim', supportingMessageIds: ['a', 'b', 'c'], confidence: 0.85
    });
    expect(result?.claim).toBe('test claim');
    expect(result?.confidence).toBe(0.85);
  });
});
