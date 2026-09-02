import { describe, it, expect } from 'vitest';
import { INTERVALS, itemKey, parseKey, newItem, nextItem, dueKeys, buildQueue, shuffle } from '../app/srs.js';

const TODAY = '2026-09-01';
const NOW = '2026-09-01T14:03:00Z';

describe('keys', () => {
  it('builds and parses an item key', () => {
    expect(itemKey('k3f9', 'f2b')).toBe('k3f9:f2b');
    expect(parseKey('k3f9:f2b')).toEqual({ cardId: 'k3f9', direction: 'f2b' });
  });
});

describe('newItem', () => {
  it('starts in box 1, due today, never seen, on the first training rung', () => {
    expect(newItem(TODAY)).toEqual({ box: 1, due: TODAY, seen: 0, lapses: 0,
                                     lastSeen: null, level: 0 });
  });
});

describe('nextItem', () => {
  it('promotes on a correct answer and schedules by the new box', () => {
    const item = nextItem(newItem(TODAY), true, TODAY, NOW);
    expect(item.box).toBe(2);
    expect(item.due).toBe('2026-09-04');   // today + 3
    expect(item.seen).toBe(1);
    expect(item.lastSeen).toBe(NOW);
  });

  it('walks the whole ladder with the spec intervals', () => {
    expect(INTERVALS).toEqual([1, 3, 7, 16, 35]);
    let item = newItem(TODAY);
    const dues = [];
    for (let i = 0; i < 5; i++) {
      item = nextItem(item, true, TODAY, NOW);
      dues.push(item.due);
    }
    expect(dues).toEqual(['2026-09-04', '2026-09-08', '2026-09-17', '2026-10-06', '2026-10-06']);
  });

  it('caps at box 5', () => {
    let item = { box: 5, due: TODAY, seen: 9, lapses: 0, lastSeen: null };
    expect(nextItem(item, true, TODAY, NOW).box).toBe(5);
  });

  it('demotes to box 1 on a wrong answer and counts a lapse', () => {
    const item = nextItem({ box: 4, due: TODAY, seen: 9, lapses: 1, lastSeen: null }, false, TODAY, NOW);
    expect(item.box).toBe(1);
    expect(item.lapses).toBe(2);
    expect(item.due).toBe('2026-09-02');   // tomorrow
  });

  it('crosses a month boundary correctly', () => {
    const item = nextItem(newItem('2026-09-30'), false, '2026-09-30', NOW);
    expect(item.due).toBe('2026-10-01');
  });
});

describe('dueKeys', () => {
  const items = {
    'a:f2b': { box: 1, due: '2026-08-31' },
    'b:f2b': { box: 2, due: '2026-09-01' },
    'c:f2b': { box: 3, due: '2026-09-05' },
  };
  it('returns items due today or earlier', () => {
    expect(dueKeys(items, TODAY).sort()).toEqual(['a:f2b', 'b:f2b']);
  });
  it('returns nothing when everything is in the future', () => {
    expect(dueKeys(items, '2026-08-01')).toEqual([]);
  });
});

describe('buildQueue', () => {
  const list = { id: 'food', cards: [{ id: 'a', front: '1', back: '2' }, { id: 'b', front: '3', back: '4' }] };
  const noShuffle = (xs) => xs;

  it('offers every direction of every card when nothing is known', () => {
    const queue = buildQueue({
      list, progress: { items: {} }, directions: ['f2b', 'b2f'],
      today: TODAY, limit: 10, includeNew: true, shuffle: noShuffle,
    });
    expect(queue.sort()).toEqual(['a:b2f', 'a:f2b', 'b:b2f', 'b:f2b']);
  });

  it('only includes the requested directions', () => {
    const queue = buildQueue({
      list, progress: { items: {} }, directions: ['f2b'],
      today: TODAY, limit: 10, includeNew: true, shuffle: noShuffle,
    });
    expect(queue.sort()).toEqual(['a:f2b', 'b:f2b']);
  });

  it('excludes new cards when includeNew is false', () => {
    const queue = buildQueue({
      list, progress: { items: { 'a:f2b': { box: 1, due: TODAY } } }, directions: ['f2b'],
      today: TODAY, limit: 10, includeNew: false, shuffle: noShuffle,
    });
    expect(queue).toEqual(['a:f2b']);
  });

  it('excludes items not yet due', () => {
    const queue = buildQueue({
      list, progress: { items: { 'a:f2b': { box: 3, due: '2026-12-01' } } }, directions: ['f2b'],
      today: TODAY, limit: 10, includeNew: false, shuffle: noShuffle,
    });
    expect(queue).toEqual([]);
  });

  it('puts due items before new ones and honours the limit', () => {
    const queue = buildQueue({
      list, progress: { items: { 'b:f2b': { box: 1, due: TODAY } } }, directions: ['f2b'],
      today: TODAY, limit: 1, includeNew: true, shuffle: noShuffle,
    });
    expect(queue).toEqual(['b:f2b']);
  });

  it('ignores progress for cards that no longer exist', () => {
    const queue = buildQueue({
      list, progress: { items: { 'gone:f2b': { box: 1, due: TODAY } } }, directions: ['f2b'],
      today: TODAY, limit: 10, includeNew: false, shuffle: noShuffle,
    });
    expect(queue).toEqual([]);
  });
});

describe('the training level', () => {
  it('is carried through a correct answer', () => {
    const item = { ...newItem(TODAY), level: 1 };
    expect(nextItem(item, true, TODAY, NOW).level).toBe(1);
  });

  it('is reset by a wrong answer, wherever the answer came from', () => {
    const item = { ...newItem(TODAY), level: 1 };
    expect(nextItem(item, false, TODAY, NOW).level).toBe(0);
  });

  it('treats an item written before levels existed as rung 0', () => {
    const legacy = { box: 2, due: TODAY, seen: 3, lapses: 0, lastSeen: NOW };
    expect(nextItem(legacy, true, TODAY, NOW).level).toBe(0);
  });
});

describe('shuffle', () => {
  it('returns a new array holding the same members', () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input);
    expect(output).not.toBe(input);
    expect(output.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);   // the input is not disturbed
  });
});
