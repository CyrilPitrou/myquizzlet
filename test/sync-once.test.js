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

// A GitHub whose first listing hangs until the test lets it go, so a second
// sync can be asked for while the first is still in the air.
function slowGitHub() {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let sweeps = 0;
  return {
    release: () => release(),
    sweeps: () => sweeps,
    async listDir(dir) {
      if (dir === 'data/lists') { sweeps += 1; await held; }
      return [];
    },
    async getFile() { return null; },
    async putFile(path, json, sha) { return { sha: `${sha || 'new'}+` }; },
    async deleteFile() { return true; },
  };
}

describe('one sweep at a time', () => {
  beforeEach(() => { vi.stubGlobal('navigator', { onLine: true }); });

  it('does not start a second sweep while the first is still running', async () => {
    const store = createStore(fakeStorage(), () => new Date('2026-09-04T10:00:00Z'));
    const github = slowGitHub();
    const states = [];
    const sync = createSync({ store, github, onStatus: (s) => states.push(s), onConflict: () => {}, canPush: true });

    const first = sync.syncNow();
    const second = sync.syncNow();
    const third = sync.syncNow();
    expect(github.sweeps()).toBe(1);

    github.release();
    await Promise.all([first, second, third]);

    // The waiting callers asked for a sync, so one more sweep runs for them
    // once the first is done — never three at once.
    expect(github.sweeps()).toBe(2);
    expect(states.filter((s) => s === 'syncing').length).toBe(2);
  });

  it('pushes work created while a sweep was already in the air', async () => {
    const store = createStore(fakeStorage(), () => new Date('2026-09-04T10:00:00Z'));
    const puts = [];
    const github = {
      async listDir() { return []; },
      async getFile() { return null; },
      async putFile(path) { puts.push(path); return { sha: 'S1' }; },
      async deleteFile() { return true; },
    };
    const sync = createSync({ store, github, onStatus: () => {}, onConflict: () => {}, canPush: true });

    const inFlight = sync.syncNow();
    store.createList({ name: 'Late' });
    await sync.syncNow();
    await inFlight;

    expect(puts).toContain('data/lists/late.json');
    expect(store.dirtyKeys()).toEqual([]);
  });
});
