import { describe, it, expect, beforeEach } from 'vitest';
import { useOfferStore, EMPTY_DRAFT_OFFER } from '../stores/offerStore';
import { StorageManager, STORAGE_KEYS } from '../lib/storage';
import type { Offer, Progress } from '../types';

const sampleOffer = (companyId = 'c1'): Offer => ({
  companyId,
  product: 'p',
  relevance: 'r',
  reason: 'why',
  audience: 'a',
  transformation: 't',
  generatedOffer: 'copy',
  generatedAt: new Date().toISOString(),
});

const sampleProgress = (): Progress => ({
  stage1Complete: true,
  stage2Complete: true,
  stage3Complete: false,
});

describe('offerStore', () => {
  beforeEach(async () => {
    await StorageManager.remove(STORAGE_KEYS.OFFERS);
    await StorageManager.remove(STORAGE_KEYS.PROGRESS);
    useOfferStore.setState({
      offers: {},
      progress: {},
      draftOffer: { ...EMPTY_DRAFT_OFFER },
      transientResultOffer: null,
      isGenerating: false,
      generationError: null,
      hydrated: false,
    });
  });

  it('setOffers persists to IndexedDB', async () => {
    useOfferStore.getState().setOffers({ c1: sampleOffer() });
    await Promise.resolve();
    const saved = await StorageManager.load<Record<string, Offer>>(
      STORAGE_KEYS.OFFERS,
      {}
    );
    expect(saved.c1.product).toBe('p');
  });

  it('setProgress persists to IndexedDB', async () => {
    useOfferStore.getState().setProgress({ c1: sampleProgress() });
    await Promise.resolve();
    const saved = await StorageManager.load<Record<string, Progress>>(
      STORAGE_KEYS.PROGRESS,
      {}
    );
    expect(saved.c1.stage2Complete).toBe(true);
  });

  it('setDraftOffer supports updater form', () => {
    useOfferStore.getState().setDraftOffer({ product: 'x' });
    useOfferStore
      .getState()
      .setDraftOffer((prev) => ({ ...prev, audience: 'y' }));
    expect(useOfferStore.getState().draftOffer).toEqual({
      product: 'x',
      audience: 'y',
    });
  });

  it('removeCompanyData clears offer + progress for that id and persists', async () => {
    useOfferStore.getState().setOffers({ c1: sampleOffer(), c2: sampleOffer('c2') });
    useOfferStore.getState().setProgress({ c1: sampleProgress(), c2: sampleProgress() });
    useOfferStore.getState().removeCompanyData('c1');
    expect(useOfferStore.getState().offers.c1).toBeUndefined();
    expect(useOfferStore.getState().offers.c2).toBeDefined();
    expect(useOfferStore.getState().progress.c1).toBeUndefined();
    await Promise.resolve();
    const saved = await StorageManager.load<Record<string, Offer>>(STORAGE_KEYS.OFFERS, {});
    expect(saved.c1).toBeUndefined();
    expect(saved.c2).toBeDefined();
  });

  it('hydrate populates offers and progress from storage', async () => {
    await StorageManager.save(STORAGE_KEYS.OFFERS, { c1: sampleOffer() });
    await StorageManager.save(STORAGE_KEYS.PROGRESS, { c1: sampleProgress() });
    const result = await useOfferStore.getState().hydrate();
    expect(result.offers.c1.product).toBe('p');
    expect(useOfferStore.getState().hydrated).toBe(true);
    expect(useOfferStore.getState().progress.c1.stage2Complete).toBe(true);
  });

  it('runtime flags toggle independently', () => {
    useOfferStore.getState().setIsGenerating(true);
    useOfferStore.getState().setGenerationError('boom');
    useOfferStore.getState().setTransientResultOffer('copy');
    expect(useOfferStore.getState().isGenerating).toBe(true);
    expect(useOfferStore.getState().generationError).toBe('boom');
    expect(useOfferStore.getState().transientResultOffer).toBe('copy');
  });
});