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

function fakeGitHub(files = {}) {
  const calls = [];
  return {
    calls,
    gets: () => calls.filter(([verb]) => verb === 'get').map(([, path]) => path),
    puts: () => calls.filter(([verb]) => verb === 'put').map(([, path]) => path),
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
    async deleteFile(path, sha) {
      calls.push(['delete', path, sha]);
      delete files[path];
      return true;
    },
  };
}

let store, files, github, sync;

beforeEach(() => {
  store = createStore(fakeStorage(), () => new Date('2026-09-04T10:00:00Z'));
  files = {
    'data/lists/food.json': {
      sha: 'L1',
      json: { id: 'food', name: 'Food', cards: [{ id: 'c1', front: 'apple', back: 'pomme' }], updatedAt: '2026-09-01T00:00:00Z' },
    },
  };
  github = fakeGitHub(files);
  sync = createSync({ store, github, onStatus: () => {}, onConflict: () => {}, canPush: true });
});

describe('profile sync', () => {
  it('pulls profiles.json from GitHub and merges with local', async () => {
    files['data/profiles.json'] = {
      sha: 'PROF1',
      json: {
        updatedAt: '2026-09-02T00:00:00Z',
        profiles: [
          { id: 'lea', name: 'Léa', emoji: '🦊' },
        ],
      },
    };

    await sync.pullAll();
    const ids = store.getProfiles().map((p) => p.id);
    expect(ids).toContain('default');
    expect(ids).toContain('lea');
  });

  it('notices a profiles file created by another device after it was absent', async () => {
    store.saveProfiles([
      ...store.getProfiles(),
      { id: 'thomas', name: 'Thomas', emoji: '🐻' },
      { id: 'flo', name: 'Flo', emoji: '🦊' },
    ]);
    // Profiles made before profile replication existed were already local but
    // were not dirty when the first sync looked for the not-yet-created file.
    store.markClean('profiles');
    await sync.pullAll();
    expect(store.getBase('profiles').sha).toBe('none');

    files['data/profiles.json'] = {
      sha: 'PROF1',
      json: { profiles: [
        { id: 'default', name: 'Default', emoji: '👤', updatedAt: '2026-09-01T00:00:00Z' },
        { id: 'cyril', name: 'Cyril', emoji: '🦁', updatedAt: '2026-09-02T00:00:00Z' },
      ] },
    };

    await sync.pullAll();

    expect(store.getProfiles().map((profile) => profile.id).sort())
      .toEqual(['cyril', 'default', 'flo', 'thomas']);
    expect(store.dirtyKeys()).toContain('profiles');
  });

  it('pushes dirty profiles to data/profiles.json', async () => {
    store.saveProfiles([...store.getProfiles(), { id: 'bob', name: 'Bob', emoji: '🐶' }]);
    expect(store.dirtyKeys()).toContain('profiles');

    await sync.pushDirty();
    expect(github.puts()).toContain('data/profiles.json');
    expect(files['data/profiles.json'].json.profiles.some((p) => p.id === 'bob')).toBe(true);
    expect(store.dirtyKeys()).not.toContain('profiles');
  });

  it('does not clear a local profile edit when the remote sha is unchanged', async () => {
    files['data/profiles.json'] = {
      sha: 'PROF1',
      json: { profiles: [{ id: 'default', name: 'Default', emoji: '👤', updatedAt: '2026-09-01T00:00:00Z' }] },
    };
    await sync.pullAll();
    store.renameProfile('default', 'Mine');

    await sync.pullAll();
    await sync.pushDirty();

    expect(files['data/profiles.json'].json.profiles[0].name).toBe('Mine');
    expect(store.dirtyKeys()).not.toContain('profiles');
  });

  it('pulls and pushes per-profile progress to data/progress/<profileId>/<listId>.json', async () => {
    files['data/progress/lea/food.json'] = {
      sha: 'P_LEA',
      json: {
        listId: 'food',
        updatedAt: '2026-09-03T00:00:00Z',
        items: { 'c1:f2b': { box: 3, lastSeen: '2026-09-03T00:00:00Z' } },
      },
    };

    await sync.pullAll();
    expect(store.getProgress('food', 'lea').items['c1:f2b'].box).toBe(3);

    // Save progress for default and lea
    store.saveProgress({
      listId: 'food',
      items: { 'c1:f2b': { box: 5, lastSeen: '2026-09-04T00:00:00Z' } },
    }, 'default');

    await sync.pushDirty();
    expect(github.puts()).toContain('data/progress/default/food.json');
    expect(files['data/progress/default/food.json'].json.items['c1:f2b'].box).toBe(5);
  });

  it('moves legacy flat progress into the default profile path on push', async () => {
    files['data/progress/food.json'] = {
      sha: 'P_OLD',
      json: {
        listId: 'food',
        updatedAt: '2026-09-03T00:00:00Z',
        items: { 'c1:f2b': { box: 2, lastSeen: '2026-09-03T00:00:00Z' } },
      },
    };

    await sync.pullAll();
    await sync.pushDirty();

    expect(files['data/progress/default/food.json'].json.items['c1:f2b'].box).toBe(2);
    expect(files['data/progress/food.json']).toBeUndefined();
  });

  it('removes a deleted profile’s remote progress directory', async () => {
    files['data/progress/bob/food.json'] = {
      sha: 'P_BOB',
      json: { listId: 'food', updatedAt: '2026-09-03T00:00:00Z', items: {} },
    };
    store.saveProfiles([...store.getProfiles(), { id: 'bob', name: 'Bob', emoji: '🐶' }]);
    store.deleteProfile('bob');

    await sync.pushDirty();

    expect(files['data/progress/bob/food.json']).toBeUndefined();
    expect(store.deletedProfileIds()).toEqual(['bob']);
    expect(files['data/profiles.json'].json.deletedProfiles).toEqual([
      { id: 'bob', updatedAt: '2026-09-04T10:00:00.000Z' },
    ]);
  });

  it('does not let a stale remote profile resurrect a local deletion', async () => {
    store.saveProfiles([...store.getProfiles(), { id: 'bob', name: 'Bob', emoji: '🐶' }]);
    store.deleteProfile('bob');
    files['data/profiles.json'] = {
      sha: 'PROF_BOB',
      json: { profiles: [{ id: 'bob', name: 'Bob', emoji: '🐶', updatedAt: '2026-09-03T00:00:00Z' }] },
    };

    await sync.pullAll();

    expect(store.getProfiles().map((profile) => profile.id)).not.toContain('bob');
  });

  it('leaves a valid active profile and discards tombstoned progress after a remote deletion', async () => {
    files['data/profiles.json'] = {
      sha: 'PROF1',
      json: { profiles: [
        { id: 'default', name: 'Default', emoji: '👤', updatedAt: '2026-09-01T00:00:00Z' },
        { id: 'bob', name: 'Bob', emoji: '🐶', updatedAt: '2026-09-02T00:00:00Z' },
      ] },
    };
    files['data/progress/bob/food.json'] = {
      sha: 'P_BOB',
      json: { listId: 'food', items: { 'c1:f2b': { box: 2, lastSeen: '2026-09-02T00:00:00Z' } } },
    };
    await sync.pullAll();
    store.setActiveProfile('bob');
    files['data/profiles.json'] = {
      sha: 'PROF2',
      json: {
        profiles: [{ id: 'default', name: 'Default', emoji: '👤', updatedAt: '2026-09-01T00:00:00Z' }],
        deletedProfiles: [{ id: 'bob', updatedAt: '2026-09-03T00:00:00Z' }],
      },
    };

    await sync.pullAll();

    expect(store.getActiveProfile()).toBe('default');
    expect(store.getProgress('food', 'bob').items).toEqual({});
    expect(store.dirtyKeys().some((key) => key.startsWith('progress:bob:'))).toBe(false);
  });
});
