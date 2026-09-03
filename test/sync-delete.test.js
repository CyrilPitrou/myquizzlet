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
function fakeGitHub(files = {}) {
  const calls = [];
  return {
    calls,
    async getFile(path) {
      calls.push(['get', path]);
      return files[path] ? { json: files[path].json, sha: files[path].sha } : null;
    },
    async putFile(path, json, sha, message) {
      calls.push(['put', path, sha]);
      files[path] = { json, sha: `${sha || 'new'}+` };
      return { sha: files[path].sha };
    },
    async listDir() {
      calls.push(['list']);
      return Object.keys(files)
        .filter((p) => p.startsWith('data/lists/'))
        .map((p) => ({ name: p.split('/').pop(), path: p, sha: files[p].sha }));
    },
    async deleteFile(path, sha) {
      calls.push(['delete', path, sha]);
      const existed = Boolean(files[path]);
      delete files[path];
      return existed;
    },
  };
}

let store, files, github, sync;

beforeEach(() => {
  store = createStore(fakeStorage(), () => new Date('2026-09-02T10:00:00Z'));
  files = {
    'data/lists/es-food.json': { sha: 'L1', json: { id: 'es-food', name: 'Food', cards: [], updatedAt: '2026-09-01T00:00:00Z' } },
    'data/progress/es-food.json': { sha: 'P1', json: { listId: 'es-food', updatedAt: '2026-09-01T00:00:00Z', items: {} } },
  };
  github = fakeGitHub(files);
  sync = createSync({ store, github, onStatus: () => {}, onConflict: () => {}, canPush: true });
});

describe('deleting a list through sync', () => {
  it('deletes both files on GitHub and then forgets the tombstone', async () => {
    await sync.pullAll();
    store.deleteList('es-food');
    await sync.pushDirty();

    expect(files['data/lists/es-food.json']).toBeUndefined();
    expect(files['data/progress/es-food.json']).toBeUndefined();
    expect(github.calls).toContainEqual(['delete', 'data/lists/es-food.json', 'L1']);
    expect(store.deletedIds()).toEqual([]);
    expect(store.dirtyKeys()).toEqual([]);
  });

  it('never uploads a deleted list instead of deleting it', async () => {
    await sync.pullAll();
    store.deleteList('es-food');
    await sync.pushDirty();
    expect(github.calls.filter(([verb]) => verb === 'put')).toEqual([]);
  });

  it('does not let a pull resurrect a list whose delete has not been pushed yet', async () => {
    await sync.pullAll();
    store.deleteList('es-food');
    await sync.pullAll();
    expect(store.getList('es-food')).toBeNull();
    expect(store.listIds()).toEqual([]);
    expect(store.deletedIds()).toEqual(['es-food']);
  });

  it('deletes a list that was never pushed without needing a base sha', async () => {
    const list = store.createList({ name: 'Scratch' });
    store.deleteList(list.id);
    await sync.pushDirty();
    expect(store.deletedIds()).toEqual([]);
    expect(store.dirtyKeys()).toEqual([]);
  });
});

// The other side of the delete: the peer that still holds the list. It must
// read "the remote no longer has this" as a deletion to follow, not as a
// file it has yet to upload — otherwise the two devices push a list back and
// forth for ever and no delete ever sticks.
describe('a list another device deleted', () => {
  it('goes away locally instead of being uploaded again', async () => {
    files['data/lists/es-verbs.json'] = { sha: 'L2', json: { id: 'es-verbs', name: 'Verbs', cards: [], updatedAt: '2026-09-01T00:00:00Z' } };
    await sync.pullAll();
    delete files['data/lists/es-food.json'];
    delete files['data/progress/es-food.json'];

    await sync.pullAll();
    await sync.pushDirty();

    expect(store.getList('es-food')).toBeNull();
    expect(store.listIds()).toEqual(['es-verbs']);
    expect(files['data/lists/es-food.json']).toBeUndefined();
  });

  it('still uploads a list the remote has never seen', async () => {
    const list = store.createList({ name: 'Scratch' });
    await sync.pullAll();
    await sync.pushDirty();

    expect(store.getList(list.id)).not.toBeNull();
    expect(files[`data/lists/${list.id}.json`]).toBeDefined();
  });

  it('leaves local lists alone when the remote listing comes back empty', async () => {
    await sync.pullAll();
    for (const path of Object.keys(files)) delete files[path];

    await sync.pullAll();

    expect(store.getList('es-food')).not.toBeNull();
  });
});
