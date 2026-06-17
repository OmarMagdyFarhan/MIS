import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addToEditHistory, buildFewShotContext, buildIndustryContext, updateIndustryIntelligence } from '../services/historyService';
import { STORAGE_KEYS, StorageManager } from '../lib/storage';

const { historyStore } = vi.hoisted(() => ({ historyStore: new Map<string, unknown>() }));
vi.mock('../lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/storage')>();
  return {
    ...mod,
    StorageManager: {
      load: vi.fn(async (key: string, def: unknown) => historyStore.get(key) ?? def),
      save: vi.fn(async (key: string, val: unknown) => { historyStore.set(key, val); }),
    },
    STORAGE_KEYS: mod.STORAGE_KEYS,
  };
});

const { StorageManager: SM } = await import('../lib/storage');

describe('historyService', () => {
  beforeEach(() => {
    historyStore.clear();
    vi.clearAllMocks();
  });

  describe('addToEditHistory', () => {
    it('saves a new edit signal', async () => {
      await addToEditHistory({ type: 'user_edit', field: 'usp', before: 'A', after: 'B', industry: 'SaaS' } as any);
      expect(SM.save).toHaveBeenCalledWith(STORAGE_KEYS.EDIT_HISTORY, expect.arrayContaining([
        expect.objectContaining({ field: 'usp', before: 'A', after: 'B' })
      ]));
    });

    it('skips duplicate user_edit where before === after', async () => {
      await addToEditHistory({ type: 'user_edit', field: 'usp', before: 'same', after: 'same', industry: 'SaaS' } as any);
      expect(SM.save).not.toHaveBeenCalled();
    });
  });

  describe('buildFewShotContext', () => {
    it('returns empty string when no history exists', async () => {
      const result = await buildFewShotContext('SaaS');
      expect(result).toBe('');
    });
  });

  describe('buildIndustryContext', () => {
    it('returns empty string when no intel exists for industry', async () => {
      const result = await buildIndustryContext('FinTech');
      expect(result).toBe('');
    });
  });

  describe('updateIndustryIntelligence', () => {
    it('creates a new industry profile if none exists', async () => {
      const company = { id: '1', name: 'Acme', industry: 'SaaS' } as any;
      const avatars: any[] = [];

      await updateIndustryIntelligence(company, avatars);

      expect(SM.save).toHaveBeenCalledWith(
        STORAGE_KEYS.INDUSTRY_INTELLIGENCE,
        expect.objectContaining({
          SaaS: expect.objectContaining({ companiesAnalyzed: 1 })
        })
      );
    });
  });
});
