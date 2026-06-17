import { describe, it, expect, beforeEach } from 'vitest';
import { useCompanyStore } from '../stores/companyStore';
import { StorageManager, STORAGE_KEYS } from '../lib/storage';
import type { Company } from '../types';

const sampleCompany = (id = 'c1', name = 'Acme'): Company => ({
  id,
  name,
  industry: 'SaaS',
  specializations: [],
  usp: '',
  country: 'Global',
  createdAt: new Date().toISOString(),
});

describe('companyStore', () => {
  beforeEach(() => {
    useCompanyStore.setState({
      companies: [],
      activeCompanyId: null,
      draftCompany: {},
      needsOfferUpdate: {},
      hydrated: false,
    });
  });

  it('setCompanies persists to IndexedDB only when non-empty', async () => {
    useCompanyStore.getState().setCompanies([sampleCompany()]);
    // Allow microtasks to flush
    await Promise.resolve();
    const saved = await StorageManager.load<Company[]>(STORAGE_KEYS.COMPANIES, []);
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe('Acme');
  });

  it('setActiveCompanyId writes to localStorage; null removes it', () => {
    useCompanyStore.getState().setActiveCompanyId('abc');
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY)).toBe('abc');
    useCompanyStore.getState().setActiveCompanyId(null);
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY)).toBeNull();
  });

  it('markNeedsOfferUpdate / clearNeedsOfferUpdate mutate map and persist', async () => {
    useCompanyStore.getState().markNeedsOfferUpdate('c1');
    expect(useCompanyStore.getState().needsOfferUpdate).toEqual({ c1: true });
    useCompanyStore.getState().clearNeedsOfferUpdate('c1');
    expect(useCompanyStore.getState().needsOfferUpdate).toEqual({});
    await Promise.resolve();
    const saved = await StorageManager.load<Record<string, boolean>>(
      STORAGE_KEYS.NEEDS_OFFER_UPDATE,
      {}
    );
    expect(saved).toEqual({});
  });

  it('hydrate loads companies, activeCompanyId, needsOfferUpdate from storage', async () => {
    await StorageManager.save(STORAGE_KEYS.COMPANIES, [sampleCompany('xyz', 'Hydrated')]);
    await StorageManager.save(STORAGE_KEYS.NEEDS_OFFER_UPDATE, { xyz: true });
    localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY, 'xyz');

    const result = await useCompanyStore.getState().hydrate();
    expect(result.companies[0].name).toBe('Hydrated');
    expect(result.activeCompanyId).toBe('xyz');
    expect(useCompanyStore.getState().hydrated).toBe(true);
    expect(useCompanyStore.getState().needsOfferUpdate).toEqual({ xyz: true });
  });

  it('setDraftCompany supports updater function form', () => {
    useCompanyStore.getState().setDraftCompany({ name: 'A' });
    useCompanyStore.getState().setDraftCompany((prev) => ({ ...prev, industry: 'X' }));
    expect(useCompanyStore.getState().draftCompany).toEqual({ name: 'A', industry: 'X' });
  });
});