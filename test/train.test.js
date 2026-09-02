import { describe, it, expect } from 'vitest';
import { pickBatch, choices } from '../app/train.js';

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
