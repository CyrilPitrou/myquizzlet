import { describe, it, expect, beforeEach } from 'vitest';
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

// A GitHub that remembers files in memory and records what was asked of it.
// listDir honours the directory it is given, the way the real one does.
function fakeGitHub(files = {}) {
  const calls = [];
  return {
    calls,
    gets: () => calls.filter(([verb]) => verb === 'get').map(([, path]) => path),
    async getFile(path) {
      calls.push(['get', path]);
      return files[path] ? { json: files[path].json, sha: files[path].sha } : null;
    },
    async putFile(path, json, sha) {
      calls.push(['put', path, sha]);
      files[path] = { json, sha: `${sha || 'new'}+` };
      return { sha: files[path].sha };
    },
    async listDir(dir) {
      calls.push(['list', dir]);
      return Object.keys(files)
        .filter((p) => p.startsWith(`${dir}/`))
        .map((p) => ({ name: p.split('/').pop(), path: p, sha: files[p].sha }));
    },
    async deleteFile(path) {
      calls.push(['delete', path]);
      delete files[path];
      return true;
    },
  };
}

const aList = (id, sha, updatedAt = '2026-09-01T00:00:00Z') => ([
  `data/lists/${id}.json`,
  { sha, json: { id, name: id, cards: [{ id: 'c1', front: 'a', back: 'b' }], updatedAt } },
]);

let store, files, github, sync;

function build(entries) {
  store = createStore(fakeStorage(), () => new Date('2026-09-04T10:00:00Z'));
  files = Object.fromEntries(entries);
  github = fakeGitHub(files);
  sync = createSync({ store, github, onStatus: () => {}, onConflict: () => {}, canPush: true });
}

describe('pullAll only downloads what it has to', () => {
  beforeEach(() => {
    build([aList('one', 'L1'), aList('two', 'L2'), aList('three', 'L3')]);
  });

  it('downloads every list the first time', async () => {
    await sync.pullAll();
    expect(github.gets()).toContain('data/lists/one.json');
    expect(store.listIds().sort()).toEqual(['one', 'three', 'two']);
  });

  it('downloads nothing at all when no sha has moved since the last sync', async () => {
    await sync.pullAll();
    github.calls.length = 0;
    await sync.pullAll();
    expect(github.gets()).toEqual([]);
  });

  it('downloads only the one list whose sha moved', async () => {
    await sync.pullAll();
    files['data/lists/two.json'] = { sha: 'L2b',
      json: { id: 'two', name: 'Two renamed', cards: [], updatedAt: '2026-09-04T09:00:00Z' } };
    github.calls.length = 0;
    await sync.pullAll();
    expect(github.gets()).toEqual(['data/lists/two.json']);
    expect(store.getList('two').name).toBe('Two renamed');
  });

  it('never asks for a progress file the remote does not have', async () => {
    await sync.pullAll();
    expect(github.gets().filter((p) => p.startsWith('data/progress/'))).toEqual([]);
  });

  it('reads a progress file that exists, once, and not again while its sha holds', async () => {
    files['data/progress/one.json'] = { sha: 'P1',
      json: { listId: 'one', updatedAt: '2026-09-01T00:00:00Z', items: { 'c1:f2b': { box: 2, lastSeen: '2026-09-01T00:00:00Z' } } } };
    await sync.pullAll();
    expect(github.gets()).toContain('data/progress/one.json');
    expect(store.getProgress('one').items['c1:f2b'].box).toBe(2);
    github.calls.length = 0;
    await sync.pullAll();
    expect(github.gets()).toEqual([]);
  });

  it('re-reads a progress file whose sha moved', async () => {
    files['data/progress/one.json'] = { sha: 'P1',
      json: { listId: 'one', updatedAt: '2026-09-01T00:00:00Z', items: {} } };
    await sync.pullAll();
    files['data/progress/one.json'] = { sha: 'P2',
      json: { listId: 'one', updatedAt: '2026-09-04T09:00:00Z', items: { 'c1:b2f': { box: 3, lastSeen: '2026-09-04T09:00:00Z' } } } };
    github.calls.length = 0;
    await sync.pullAll();
    expect(github.gets()).toEqual(['data/progress/one.json']);
    expect(store.getProgress('one').items['c1:b2f'].box).toBe(3);
  });

  it('costs a fixed two requests for a hundred unchanged lists', async () => {
    build(Array.from({ length: 100 }, (_, n) => aList(`l${n}`, `S${n}`)));
    await sync.pullAll();
    github.calls.length = 0;
    await sync.pullAll();
    expect(github.calls).toEqual([['list', 'data/lists'], ['list', 'data/progress']]);
  });
});
