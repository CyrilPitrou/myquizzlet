import { describe, it, expect } from 'vitest';
import { pickBatch, choices, startBatch, currentKey, currentLevel, advance } from '../app/train.js';

const identity = (xs) => xs.slice();

const list = {
  id: 'es-food',
  cards: [{ id: 'a', front: 'el pan', back: 'le pain' },
          { id: 'b', front: 'la mesa', back: 'la table' },
          { id: 'c', front: 'el vino', back: 'le vin' }],
};

const item = (box, lapses) => ({ box, due: '2026-09-02', seen: box + lapses,
                                 lapses, lastSeen: '2026-09-01T10:00:00Z', level: 0 });

describe('pickBatch', () => {
  it('takes never-seen items before anything else', () => {
    const progress = { items: { 'a:f2b': item(1, 0), 'a:b2f': item(1, 0) } };
    const batch = pickBatch({ list, progress, directions: ['f2b'], size: 2, shuffle: identity });
    expect(batch).toEqual(['b:f2b', 'c:f2b']);
  });

  it('falls back to the lowest box once nothing is new', () => {
    const progress = { items: { 'a:f2b': item(4, 0), 'b:f2b': item(1, 0), 'c:f2b': item(3, 0) } };
    const batch = pickBatch({ list, progress, directions: ['f2b'], size: 3, shuffle: identity });
    expect(batch).toEqual(['b:f2b', 'c:f2b', 'a:f2b']);
  });

  it('breaks a tie on box by the most lapses', () => {
    const progress = { items: { 'a:f2b': item(2, 0), 'b:f2b': item(2, 5), 'c:f2b': item(2, 2) } };
    const batch = pickBatch({ list, progress, directions: ['f2b'], size: 3, shuffle: identity });
    expect(batch).toEqual(['b:f2b', 'c:f2b', 'a:f2b']);
  });

  it('produces one item per direction per card', () => {
    const batch = pickBatch({ list, progress: { items: {} }, size: 6, shuffle: identity });
    expect(batch).toEqual(['a:f2b', 'a:b2f', 'b:f2b', 'b:b2f', 'c:f2b', 'c:b2f']);
  });

  it('honours the size', () => {
    const batch = pickBatch({ list, progress: { items: {} }, size: 3, shuffle: identity });
    expect(batch).toHaveLength(3);
  });

  it('skips excluded keys, so a refill never repeats a graduated word', () => {
    const batch = pickBatch({ list, progress: { items: {} }, directions: ['f2b'],
                              size: 3, exclude: ['a:f2b'], shuffle: identity });
    expect(batch).toEqual(['b:f2b', 'c:f2b']);
  });

  it('returns an empty batch when the list is exhausted', () => {
    const batch = pickBatch({ list, progress: { items: {} }, directions: ['f2b'], size: 8,
                              exclude: ['a:f2b', 'b:f2b', 'c:f2b'], shuffle: identity });
    expect(batch).toEqual([]);
  });
});

const longer = {
  id: 'es-food',
  cards: [
    { id: 'a', front: 'el pan', back: 'le pain' },
    { id: 'b', front: 'la mesa', back: 'la table' },
    { id: 'c', front: 'el vino', back: 'le vin' },
    { id: 'd', front: 'la manzana', back: 'la pomme' },
    { id: 'e', front: 'el queso', back: 'le fromage' },
    { id: 'f', front: 'la mantequilla', back: 'le beurre extraordinaire' },
  ],
};

describe('choices', () => {
  it('offers the answer and three distractors from the same side', () => {
    const options = choices({ list: longer, key: 'a:f2b', shuffle: identity });
    expect(options).toHaveLength(4);
    expect(options).toContain('le pain');
    for (const option of options) {
      expect(longer.cards.map((c) => c.back)).toContain(option);
    }
  });

  it('asks the other side when the direction reverses', () => {
    const options = choices({ list: longer, key: 'a:b2f', shuffle: identity });
    expect(options).toContain('el pan');
    for (const option of options) {
      expect(longer.cards.map((c) => c.front)).toContain(option);
    }
  });

  it('prefers distractors of a similar length', () => {
    const options = choices({ list: longer, key: 'a:f2b', shuffle: identity });
    expect(options).not.toContain('le beurre extraordinaire');
  });

  it('never repeats a text, so a duplicated answer cannot appear twice', () => {
    const duplicated = { id: 'x', cards: [
      { id: 'a', front: 'el pan', back: 'le pain' },
      { id: 'b', front: 'la barra', back: 'le pain' },
      { id: 'c', front: 'la mesa', back: 'la table' },
      { id: 'd', front: 'el vino', back: 'le vin' },
    ] };
    const options = choices({ list: duplicated, key: 'a:f2b', shuffle: identity });
    expect(new Set(options).size).toBe(options.length);
  });

  it('returns null when the list is too short to build a question', () => {
    const tiny = { id: 'x', cards: [{ id: 'a', front: 'el pan', back: 'le pain' },
                                    { id: 'b', front: 'la mesa', back: 'la table' }] };
    expect(choices({ list: tiny, key: 'a:f2b', shuffle: identity })).toBeNull();
  });

  it('returns null for a key whose card has gone', () => {
    expect(choices({ list: longer, key: 'zz:f2b', shuffle: identity })).toBeNull();
  });
});

describe('the batch ladder', () => {
  const keys = ['a:f2b', 'b:f2b', 'c:f2b'];

  it('starts every unseen item on rung 0', () => {
    const state = startBatch(keys, { items: {} });
    expect(state.queue).toEqual(keys);
    expect(currentKey(state)).toBe('a:f2b');
    expect(currentLevel(state)).toBe(0);
    expect(state.graduated).toEqual([]);
  });

  it('resumes an item stored on rung 1, so an abandoned batch picks up where it was', () => {
    const progress = { items: { 'b:f2b': { box: 1, due: '2026-09-02', seen: 1,
                                           lapses: 0, lastSeen: null, level: 1 } } };
    const state = startBatch(keys, progress);
    expect(state.levels['b:f2b']).toBe(1);
    expect(state.levels['a:f2b']).toBe(0);
  });

  it('promotes to typing on a correct multiple choice and sends it to the back', () => {
    const state = advance(startBatch(keys, { items: {} }), true);
    expect(state.queue).toEqual(['b:f2b', 'c:f2b', 'a:f2b']);
    expect(state.levels['a:f2b']).toBe(1);
    expect(state.graduated).toEqual([]);
  });

  it('graduates on a correct typed answer', () => {
    let state = startBatch(keys, { items: {} });
    state = advance(state, true);            // a:f2b to rung 1, to the back
    state = advance(state, true);            // b:f2b to rung 1, to the back
    state = advance(state, true);            // c:f2b to rung 1, to the back
    expect(currentKey(state)).toBe('a:f2b');
    expect(currentLevel(state)).toBe(1);
    state = advance(state, true);            // a:f2b typed correctly
    expect(state.graduated).toEqual(['a:f2b']);
    expect(state.queue).toEqual(['b:f2b', 'c:f2b']);
  });

  it('drops a wrong answer back to multiple choice', () => {
    let state = startBatch(keys, { items: {} });
    state = advance(state, true);            // a:f2b now on rung 1
    state = advance(state, true);
    state = advance(state, true);
    state = advance(state, false);           // a:f2b typed wrongly
    expect(state.levels['a:f2b']).toBe(0);
    expect(state.queue).toEqual(['b:f2b', 'c:f2b', 'a:f2b']);
    expect(state.graduated).toEqual([]);
  });

  it('never asks the same item twice running while another is waiting', () => {
    let state = startBatch(keys, { items: {} });
    const asked = [];
    for (let i = 0; i < 8; i++) {
      asked.push(currentKey(state));
      state = advance(state, false);
    }
    for (let i = 1; i < asked.length; i++) expect(asked[i]).not.toBe(asked[i - 1]);
  });

  it('empties when every item has graduated', () => {
    let state = startBatch(['a:f2b'], { items: {} });
    state = advance(state, true);            // to rung 1
    state = advance(state, true);            // graduated
    expect(currentKey(state)).toBeNull();
    expect(currentLevel(state)).toBeNull();
    expect(state.graduated).toEqual(['a:f2b']);
  });

  it('does not mutate the state it is given', () => {
    const before = startBatch(keys, { items: {} });
    const snapshot = JSON.parse(JSON.stringify(before));
    advance(before, true);
    expect(before).toEqual(snapshot);
  });
});
