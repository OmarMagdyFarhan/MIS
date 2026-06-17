import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager, STORAGE_KEYS } from '../lib/storage';

// idb-keyval is mocked in setup.ts
import * as idb from 'idb-keyval';

describe('StorageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('saves and loads a value round-trip (lz envelope)', async () => {
    const data = { name: 'Acme Corp', industry: 'SaaS' };
    await StorageManager.save(STORAGE_KEYS.COMPANIES, [data]);

    // Verify the idb.set was called with a v:1 envelope
    const setCall = (idb.set as ReturnType<typeof vi.fn>).mock.calls[0];
    const stored = setCall[1];
    const envelope = JSON.parse(stored);
    expect(envelope.v).toBe(1);
    expect(['lz', 'raw']).toContain(envelope.enc);

    const loaded = await StorageManager.load<typeof data[]>(STORAGE_KEYS.COMPANIES, []);
    expect(loaded).toEqual([data]);
  });

  it('returns the default value when no data is stored', async () => {
    const result = await StorageManager.load('nonexistent_key', { fallback: true });
    expect(result).toEqual({ fallback: true });
  });

  it('migrates a legacy localStorage key to IndexedDB on first load', async () => {
    const legacy = JSON.stringify([{ id: '1', name: 'Legacy Co' }]);
    localStorage.setItem('mis_companies', legacy);

    const result = await StorageManager.load(STORAGE_KEYS.COMPANIES, []);
    expect(result).toEqual([{ id: '1', name: 'Legacy Co' }]);
    expect(localStorage.getItem('mis_companies')).toBeNull();
    expect(idb.set).toHaveBeenCalled();
  });

  it('removes a key', async () => {
    await StorageManager.save('tmp_key', 'some data');
    await StorageManager.remove('tmp_key');
    expect(idb.del).toHaveBeenCalledWith('tmp_key');
  });

  it('STORAGE_KEYS covers all required keys', () => {
    expect(STORAGE_KEYS).toMatchObject({
      COMPANIES: expect.any(String),
      OFFERS: expect.any(String),
      PROGRESS: expect.any(String),
      ACTIVE_COMPANY: expect.any(String),
      INDUSTRY_INTELLIGENCE: expect.any(String),
      EDIT_HISTORY: expect.any(String),
      NEEDS_OFFER_UPDATE: expect.any(String),
    });
  });

  it('_parseStored handles legacy plain LZ-string (migration path)', () => {
    const LZString = require('lz-string');
    const data = { legacy: true };
    const compressed = LZString.compressToUTF16(JSON.stringify(data));
    const result = StorageManager._parseStored(compressed);
    expect(result).toEqual(data);
  });

  it('_parseStored handles { v:1, enc:"raw" } envelope', () => {
    const data = { key: 'value' };
    const envelope = JSON.stringify({ v: 1, enc: 'raw', data: JSON.stringify(data) });
    const result = StorageManager._parseStored(envelope);
    expect(result).toEqual(data);
  });

  it('_parseStored handles { v:1, enc:"lz" } envelope', () => {
    const LZString = require('lz-string');
    const data = { key: 'compressed' };
    const compressed = LZString.compressToUTF16(JSON.stringify(data));
    const envelope = JSON.stringify({ v: 1, enc: 'lz', data: compressed });
    const result = StorageManager._parseStored(envelope);
    expect(result).toEqual(data);
  });

  it('save always writes a v:1 envelope with enc field', async () => {
    await StorageManager.save('test_envelope', { x: 1 });
    const setCall = (idb.set as ReturnType<typeof vi.fn>).mock.calls[0];
    const stored = JSON.parse(setCall[1]);
    expect(stored.v).toBe(1);
    expect(stored.enc).toBeDefined();
    expect(stored.data).toBeDefined();
  });
});
