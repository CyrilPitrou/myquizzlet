import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from '../app/store.js';
import { createSync } from '../app/sync.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const github = {
  async getFile() { return null; },
  async putFile(path, json, sha) { return { sha: `${sha || 'new'}+` }; },
  async listDir() { return []; },
  async deleteFile() { return false; },
};

let store, states, sync;

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  store = createStore(fakeStorage(), () => new Date('2026-09-02T10:00:00Z'));
  states = [];
  sync = createSync({
    store, github, canPush: true,
    onStatus: (state) => states.push(state),
    onConflict: () => {},
  });
});

describe('what the dot says while a sync runs', () => {
  it('says syncing, not "changes waiting", when nothing is dirty', async () => {
    await sync.syncNow();
    expect(states).toEqual(['syncing', 'synced']);
  });

  it('keeps pending for changes that are genuinely waiting', async () => {
    store.saveList({ id: 'es-food', name: 'Food', cards: [] });
    sync.schedule();
    sync.stop();
    expect(states).toEqual(['pending']);
  });
});
