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
