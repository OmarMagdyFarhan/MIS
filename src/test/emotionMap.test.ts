import { describe, it, expect } from 'vitest';
import { resolveEmotion, getEmotionsByCore, getEmotionsByMid } from '../lib/emotionMap';

describe('resolveEmotion', () => {
  it('Furious → mid: Aggressive, core: Angry', () => {
    const r = resolveEmotion('Furious');
    expect(r.mid).toBe('Aggressive');
    expect(r.core).toBe('Angry');
    expect(r.specific).toBe('Furious');
  });
  it('Hopeful → mid: Optimistic, core: Happy', () => {
    const r = resolveEmotion('Hopeful');
    expect(r.mid).toBe('Optimistic');
    expect(r.core).toBe('Happy');
  });
  it('Isolated → mid: Lonely, core: Sad', () => {
    const r = resolveEmotion('Isolated');
    expect(r.mid).toBe('Lonely');
    expect(r.core).toBe('Sad');
  });
  it('Unknown input returns a defined fallback', () => {
    const r = resolveEmotion('NonExistentEmotion' as any);
    expect(r.core).toBeDefined();
    expect(r.mid).toBeDefined();
  });
});

describe('getEmotionsByCore', () => {
  it('Happy returns at least 10 specific emotions', () =>
    expect(getEmotionsByCore('Happy').length).toBeGreaterThanOrEqual(10));
  it('Angry returns Furious', () =>
    expect(getEmotionsByCore('Angry')).toContain('Furious'));
});

describe('getEmotionsByMid', () => {
  it('Lonely returns Abandoned and Isolated', () => {
    const r = getEmotionsByMid('Lonely');
    expect(r).toContain('Abandoned');
    expect(r).toContain('Isolated');
  });
});
