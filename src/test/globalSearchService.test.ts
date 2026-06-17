import { describe, it, expect } from 'vitest';
import { searchWorkspace } from '../services/globalSearchService';
import type { Company, Progress } from '../types';

const company: Company = {
  id: 'co1',
  name: 'Acme Corp',
  industry: 'Software',
  specializations: [],
  usp: '',
  country: 'US',
  createdAt: new Date().toISOString(),
};

describe('globalSearchService', () => {
  it('returns no results for an empty query', () => {
    const results = searchWorkspace('', { companies: [company], progress: {}, clustersByCompany: {} });
    expect(results).toHaveLength(0);
  });

  it('matches companies by name', () => {
    const results = searchWorkspace('acme', { companies: [company], progress: {}, clustersByCompany: {} });
    expect(results.some(r => r.kind === 'company' && r.title === 'Acme Corp')).toBe(true);
  });

  it('matches avatars by name', () => {
    const progress: Record<string, Progress> = {
      co1: {
        stage1Complete: true, stage2Complete: true, stage3Complete: true,
        avatars: [{ id: 'av1', name: 'Busy Parent Buyer' } as any],
      },
    };
    const results = searchWorkspace('busy parent', { companies: [company], progress, clustersByCompany: {} });
    expect(results.some(r => r.kind === 'avatar' && r.title === 'Busy Parent Buyer')).toBe(true);
    expect(results[0].targetTab).toBe('segments');
  });

  it('matches segments (clusters) by label', () => {
    const results = searchWorkspace('pricing', {
      companies: [company],
      progress: {},
      clustersByCompany: { co1: [{ id: 'c1', label: 'Pricing concerns' } as any] },
    });
    expect(results.some(r => r.kind === 'segment' && r.title === 'Pricing concerns')).toBe(true);
  });
});
