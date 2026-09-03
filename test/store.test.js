import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, recency } from '../app/store.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const FIXED = new Date('2026-09-01T14:03:00Z');
let storage, store;

beforeEach(() => {
  storage = fakeStorage();
  store = createStore(storage, () => FIXED);
});

describe('lists', () => {
  it('starts empty', () => {
    expect(store.listIds()).toEqual([]);
  });

  it('creates a list with an id derived from the name', () => {
    const list = store.createList({ name: 'Spanish – Food' });
    expect(list.id).toBe('spanish-food');
    expect(list.cards).toEqual([]);
    expect(store.listIds()).toEqual(['spanish-food']);
  });

  it('avoids colliding ids', () => {
    store.createList({ name: 'Food' });
    expect(store.createList({ name: 'Food' }).id).toBe('food-2');
  });

  it('stamps updatedAt on save', () => {
    const list = store.createList({ name: 'Food' });
    expect(list.updatedAt).toBe('2026-09-01T14:03:00.000Z');
  });

  it('round-trips through storage', () => {
    store.createList({ name: 'Food', frontLang: 'es', backLang: 'fr' });
    const reloaded = createStore(storage, () => FIXED);
    expect(reloaded.getList('food').frontLang).toBe('es');
  });

  it('returns null for an unknown list', () => {
    expect(store.getList('nope')).toBe(null);
  });

  it('deletes a list and its progress', () => {
    store.createList({ name: 'Food' });
    store.saveProgress({ listId: 'food', items: { 'a:f2b': { box: 1 } } });
    store.deleteList('food');
    expect(store.listIds()).toEqual([]);
    expect(storage.getItem('mq:progress:food')).toBe(null);
  });
});

describe('cards', () => {
  beforeEach(() => store.createList({ name: 'Food' }));

  it('adds cards with generated ids', () => {
    const list = store.addCards('food', [{ front: 'el pan', back: 'le pain' }]);
    expect(list.cards).toHaveLength(1);
    expect(list.cards[0].id).toMatch(/^[a-z0-9]{6}$/);
  });

  it('gives each card a distinct id', () => {
    const list = store.addCards('food', [{ front: 'a', back: 'b' }, { front: 'c', back: 'd' }]);
    expect(list.cards[0].id).not.toBe(list.cards[1].id);
  });

  it('keeps the id when a card is edited', () => {
    const id = store.addCards('food', [{ front: 'a', back: 'b' }]).cards[0].id;
    const list = store.updateCard('food', id, { front: 'A', back: 'B' });
    expect(list.cards[0]).toEqual({ id, front: 'A', back: 'B' });
  });

  it('deletes a card', () => {
    const id = store.addCards('food', [{ front: 'a', back: 'b' }]).cards[0].id;
    expect(store.deleteCard('food', id).cards).toEqual([]);
  });
});

describe('progress', () => {
  it('returns an empty record for a list never studied', () => {
    expect(store.getProgress('food')).toEqual({ listId: 'food', updatedAt: null, items: {} });
  });

  it('saves and reloads progress', () => {
    store.saveProgress({ listId: 'food', items: { 'a:f2b': { box: 2 } } });
    expect(store.getProgress('food').items['a:f2b'].box).toBe(2);
  });

  it('stamps updatedAt on save', () => {
    expect(store.saveProgress({ listId: 'food', items: {} }).updatedAt)
      .toBe('2026-09-01T14:03:00.000Z');
  });

  it('prunes progress for cards that no longer exist', () => {
    store.createList({ name: 'Food' });
    const id = store.addCards('food', [{ front: 'a', back: 'b' }]).cards[0].id;
    store.saveProgress({ listId: 'food', items: { [`${id}:f2b`]: { box: 1 }, 'gone:f2b': { box: 1 } } });
    expect(Object.keys(store.getProgress('food').items)).toEqual([`${id}:f2b`]);
  });
});

describe('dirty tracking', () => {
  it('marks a created list dirty', () => {
    store.createList({ name: 'Food' });
    expect(store.dirtyKeys()).toEqual(['list:food']);
  });

  it('marks progress dirty separately', () => {
    store.createList({ name: 'Food' });
    store.saveProgress({ listId: 'food', items: {} });
    expect(store.dirtyKeys().sort()).toEqual(['list:food', 'progress:food']);
  });

  it('does not duplicate a key saved twice', () => {
    const list = store.createList({ name: 'Food' });
    store.saveList(list);
    expect(store.dirtyKeys()).toEqual(['list:food']);
  });

  it('clears a key once pushed', () => {
    store.createList({ name: 'Food' });
    store.markClean('list:food');
    expect(store.dirtyKeys()).toEqual([]);
  });

  it('survives a reload', () => {
    store.createList({ name: 'Food' });
    expect(createStore(storage, () => FIXED).dirtyKeys()).toEqual(['list:food']);
  });
});

describe('renaming', () => {
  it('changes the name and keeps the id and the cards', () => {
    const list = store.createList({ name: 'Spanish' });
    store.addCards(list.id, [{ front: 'el pan', back: 'le pain' }]);
    const renamed = store.renameList(list.id, 'Spanish – Food');
    expect(renamed.id).toBe(list.id);
    expect(renamed.name).toBe('Spanish – Food');
    expect(renamed.cards).toHaveLength(1);
    expect(store.listIds()).toEqual([list.id]);
  });
});

describe('deleting a list', () => {
  it('forgets the list and its progress', () => {
    const list = store.createList({ name: 'Spanish' });
    store.saveProgress({ listId: list.id, items: {} });
    store.deleteList(list.id);
    expect(store.getList(list.id)).toBeNull();
    expect(store.listIds()).toEqual([]);
  });

  it('records a tombstone and marks both files dirty', () => {
    const list = store.createList({ name: 'Spanish' });
    store.deleteList(list.id);
    expect(store.deletedIds()).toEqual([list.id]);
    expect(store.dirtyKeys()).toContain(`list:${list.id}`);
    expect(store.dirtyKeys()).toContain(`progress:${list.id}`);
  });

  it('keeps the base shas, which the delete request needs', () => {
    const list = store.createList({ name: 'Spanish' });
    store.setBase(`list:${list.id}`, { sha: 'abc123', updatedAt: null });
    store.deleteList(list.id);
    expect(store.getBase(`list:${list.id}`)).toEqual({ sha: 'abc123', updatedAt: null });
  });

  it('clears a tombstone only when told to', () => {
    const list = store.createList({ name: 'Spanish' });
    store.deleteList(list.id);
    store.clearDeleted(list.id);
    expect(store.deletedIds()).toEqual([]);
  });

  it('is cleared when a new list reuses the deleted id', () => {
    const list = store.createList({ name: 'Delete me' });
    store.deleteList(list.id);
    const recreated = store.createList({ name: 'Delete me' });
    expect(recreated.id).toBe(list.id);
    expect(store.deletedIds()).not.toContain(list.id);
  });
});

describe('recency', () => {
  const list = { id: 'x', name: 'X', updatedAt: '2026-09-01T09:00:00Z', cards: [] };

  it('is the list timestamp when nothing has been studied', () => {
    expect(recency({ list, progress: { items: {} } })).toBe('2026-09-01T09:00:00Z');
  });

  it('is the newest lastSeen when studying is more recent than editing', () => {
    const progress = { items: {
      'a:f2b': { lastSeen: '2026-09-02T08:00:00Z' },
      'a:b2f': { lastSeen: '2026-09-03T07:00:00Z' },
    } };
    expect(recency({ list, progress })).toBe('2026-09-03T07:00:00Z');
  });

  it('is the list timestamp when editing is more recent than studying', () => {
    const edited = { ...list, updatedAt: '2026-09-05T00:00:00Z' };
    const progress = { items: { 'a:f2b': { lastSeen: '2026-09-02T08:00:00Z' } } };
    expect(recency({ list: edited, progress })).toBe('2026-09-05T00:00:00Z');
  });

  it('tolerates a never-seen item and a missing progress file', () => {
    const progress = { items: { 'a:f2b': { lastSeen: null } } };
    expect(recency({ list, progress })).toBe('2026-09-01T09:00:00Z');
    expect(recency({ list, progress: undefined })).toBe('2026-09-01T09:00:00Z');
  });
});

describe('list metadata', () => {
  it('creates a list with a folder and column labels', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Spanish – Food', folder: 'Spanish',
                                    frontLabel: 'Spanish', backLabel: 'French',
                                    frontLang: 'es', backLang: 'fr' });
    expect(list.folder).toBe('Spanish');
    expect(list.frontLabel).toBe('Spanish');
    expect(list.backLabel).toBe('French');
    expect(store.getList(list.id).folder).toBe('Spanish');
  });

  it('defaults the new fields to null, so an old list stays valid', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Scratch' });
    expect(list.folder).toBeNull();
    expect(list.frontLabel).toBeNull();
    expect(list.backLabel).toBeNull();
  });

  it('updates metadata without disturbing the cards', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Scratch' });
    store.addCards(list.id, [{ front: 'el pan', back: 'le pain' }]);
    const cardId = store.getList(list.id).cards[0].id;
    store.updateMeta(list.id, { folder: 'Spanish', backLabel: 'French' });
    const after = store.getList(list.id);
    expect(after.folder).toBe('Spanish');
    expect(after.backLabel).toBe('French');
    expect(after.cards).toHaveLength(1);
    expect(after.cards[0].id).toBe(cardId);        // card ids are permanent
  });

  it('ignores fields that are not metadata', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Scratch' });
    store.addCards(list.id, [{ front: 'el pan', back: 'le pain' }]);
    store.updateMeta(list.id, { cards: [], id: 'hijacked' });
    expect(store.getList(list.id).cards).toHaveLength(1);
    expect(store.getList('hijacked')).toBeNull();
  });

  it('lists the folders in use, sorted and deduplicated', () => {
    const store = createStore(fakeStorage());
    store.createList({ name: 'Food', folder: 'Spanish' });
    store.createList({ name: 'Verbs', folder: 'Spanish' });
    store.createList({ name: 'Kanji', folder: 'Japanese' });
    store.createList({ name: 'Scratch' });
    expect(store.folders()).toEqual(['Japanese', 'Spanish']);
  });

  it('renames through the same path', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Old' });
    store.renameList(list.id, 'New');
    expect(store.getList(list.id).name).toBe('New');
  });
});

describe('swap sides', () => {
  it('swaps list labels, card text, and progress keys together', () => {
    const list = store.createList({ name: 'Spanish – Food', frontLabel: 'Español', backLabel: 'Français',
                                    frontLang: 'es', backLang: 'fr' });
    const id = store.addCards(list.id, [{ front: 'el pan', back: 'le pain' }]).cards[0].id;
    store.saveProgress({ listId: list.id, items: { [`${id}:f2b`]: { box: 3, lastSeen: '2026-09-01T10:00:00Z' } } });

    const result = store.swapSides(list.id);

    expect(result.list.frontLabel).toBe('Français');
    expect(result.list.backLabel).toBe('Español');
    expect(result.list.cards[0]).toEqual({ id, front: 'le pain', back: 'el pan' });
    expect(result.progress.items[`${id}:b2f`].box).toBe(3);
    expect(result.progress.items[`${id}:f2b`]).toBeUndefined();
  });

  it('persists the swap to storage', () => {
    const list = store.createList({ name: 'Food', frontLabel: 'A', backLabel: 'B' });
    store.swapSides(list.id);
    expect(store.getList(list.id).frontLabel).toBe('B');
  });

  it('marks both list and progress dirty', () => {
    const list = store.createList({ name: 'Food' });
    store.swapSides(list.id);
    expect(store.dirtyKeys().sort()).toEqual([`list:${list.id}`, `progress:${list.id}`]);
  });

  it('throws for an unknown list', () => {
    expect(() => store.swapSides('nope')).toThrow('no such list: nope');
  });
});
