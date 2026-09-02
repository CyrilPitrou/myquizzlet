import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../app/store.js';

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
});
