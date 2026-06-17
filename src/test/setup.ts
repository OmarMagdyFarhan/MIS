import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// Hoisted shared store so we can clear it between every test for full isolation.
const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }));

vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(idbStore.get(key))),
  set: vi.fn((key: string, value: unknown) => { idbStore.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { idbStore.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve([...idbStore.keys()])),
  clear: vi.fn(() => { idbStore.clear(); return Promise.resolve(); }),
}));

// Minimal localStorage mock for jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });

// Test isolation: reset all mock state + persistence between every test
beforeEach(() => {
  idbStore.clear();
  localStorageMock.clear();
  vi.clearAllMocks();
});
