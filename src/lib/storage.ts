import LZString from 'lz-string';
import { get, set, del, keys, clear } from 'idb-keyval';

interface StorageEnvelope {
  v: 1;
  enc: 'lz' | 'raw';
  data: string;
}

/**
 * Enterprise-grade persistence architecture using IndexedDB.
 * Bypasses 5MB LocalStorage limits and prevents main-thread blocking.
 * Uses a typed envelope { v, enc, data } to prevent silent corruption on
 * compression failures.
 */
export const StorageManager = {
  async save(key: string, data: unknown): Promise<void> {
    const json = JSON.stringify(data);
    let envelope: StorageEnvelope;
    try {
      const compressed = LZString.compressToUTF16(json);
      if (!compressed) throw new Error('LZString returned empty');
      envelope = { v: 1, enc: 'lz', data: compressed };
    } catch (e) {
      console.warn(`[storage] Compression failed for ${key}, saving raw.`, e);
      envelope = { v: 1, enc: 'raw', data: json };
    }
    try {
      await set(key, JSON.stringify(envelope));
    } catch (writeErr: unknown) {
      const msg = writeErr instanceof Error ? writeErr.message : String(writeErr);
      console.error(`[storage] Write failed for key "${key}": ${msg}`);
      // Surface quota/permission errors to the user
      if (msg.includes('QuotaExceeded') || msg.includes('quota') || msg.includes('storage')) {
        window.dispatchEvent(new CustomEvent('mis:storage-error', {
          detail: { key, message: 'Storage full — clear some browser data to continue saving.' }
        }));
      }
      throw writeErr;
    }
  },

  async load<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const stored = await get(key);
      if (!stored) {
        // Migration check: check for legacy LocalStorage data
        const legacy = localStorage.getItem(key);
        if (legacy) {
          console.log(`Migrating ${key} from LocalStorage to IndexedDB`);
          const data = this._parseStored(legacy);
          await this.save(key, data);
          localStorage.removeItem(key);
          return data as T;
        }
        return defaultValue;
      }

      return this._parseStored(stored) as T;
    } catch (e) {
      console.warn(`Storage load failed for ${key}, returning default.`, e);
      return defaultValue;
    }
  },

  _parseStored(stored: unknown): unknown {
    if (typeof stored !== 'string') return stored;
    try {
      const envelope = JSON.parse(stored) as StorageEnvelope;
      if (envelope?.v === 1) {
        if (envelope.enc === 'lz') {
          const decompressed = LZString.decompressFromUTF16(envelope.data);
          if (!decompressed) throw new Error('Decompression returned null');
          return JSON.parse(decompressed);
        }
        return JSON.parse(envelope.data);
      }
    } catch {
      // Legacy unenvelope path — try direct decompression then raw parse
    }
    try {
      const decompressed = LZString.decompressFromUTF16(stored);
      if (decompressed) return JSON.parse(decompressed);
    } catch { /* fall through */ }
    return JSON.parse(stored);
  },

  async remove(key: string): Promise<void> {
    await del(key);
  },

  async clearAll(): Promise<void> {
    await clear();
  }
};

export const STORAGE_KEYS = {
  COMPANIES: 'mis_companies',
  OFFERS: 'mis_offers',
  PROGRESS: 'mis_progress',
  ACTIVE_COMPANY: 'mis_active_company_id',
  INDUSTRY_INTELLIGENCE: 'industryIntelligence',
  EDIT_HISTORY: 'editHistory',
  NEEDS_OFFER_UPDATE: 'mis_needs_offer_update',
};

export async function exportSessionData() {
  const [companies, offers, progress, industryIntelligence, needsOfferUpdate] = await Promise.all([
    StorageManager.load(STORAGE_KEYS.COMPANIES, []),
    StorageManager.load(STORAGE_KEYS.OFFERS, {}),
    StorageManager.load(STORAGE_KEYS.PROGRESS, {}),
    StorageManager.load(STORAGE_KEYS.INDUSTRY_INTELLIGENCE, {}),
    StorageManager.load(STORAGE_KEYS.NEEDS_OFFER_UPDATE, {}),
  ]);

  const data = {
    companies,
    offers,
    progress,
    needsOfferUpdate,
    industryIntelligence,
    exportAt: new Date().toISOString(),
    version: '1.4.0'
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mis-intelligence-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSessionData(jsonData: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonData);
    if (!data.companies || !data.offers) throw new Error('Invalid data format: Missing core keys');
    
    if (!Array.isArray(data.companies)) throw new Error('Invalid data format: companies must be an array');

    await Promise.all([
      StorageManager.save(STORAGE_KEYS.COMPANIES, data.companies),
      StorageManager.save(STORAGE_KEYS.OFFERS, data.offers),
      StorageManager.save(STORAGE_KEYS.PROGRESS, data.progress || {}),
      StorageManager.save(STORAGE_KEYS.NEEDS_OFFER_UPDATE, data.needsOfferUpdate || {}),
      StorageManager.save(STORAGE_KEYS.INDUSTRY_INTELLIGENCE, data.industryIntelligence || {}),
    ]);
    
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}
