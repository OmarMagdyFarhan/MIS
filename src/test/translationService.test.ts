import { describe, it, expect } from 'vitest';
import { getLanguageLabel } from '../services/translationService';

describe('getLanguageLabel', () => {
  it('returns English for en', () => expect(getLanguageLabel('en')).toBe('English'));
  it('returns Arabic for ar', () => expect(getLanguageLabel('ar')).toBe('Arabic'));
  it('returns Spanish for es', () => expect(getLanguageLabel('es')).toBe('Spanish'));
  it('returns French for fr', () => expect(getLanguageLabel('fr')).toBe('French'));
  it('returns German for de', () => expect(getLanguageLabel('de')).toBe('German'));
  it('returns uppercased code for unknown language', () => expect(getLanguageLabel('xx')).toBe('XX'));
  it('returns uppercased code for empty-ish unknown', () => expect(getLanguageLabel('zz')).toBe('ZZ'));
});
