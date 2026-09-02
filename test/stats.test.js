import { describe, it, expect } from 'vitest';
import { listStats } from '../app/stats.js';

const TODAY = '2026-09-02';

const list = {
  id: 'es-food',
  cards: [{ id: 'a', front: 'el pan', back: 'le pain' },
          { id: 'b', front: 'la mesa', back: 'la table' }],
};

const item = (fields) => ({ box: 1, due: TODAY, seen: 0, lapses: 0,
                            lastSeen: null, level: 0, ...fields });

describe('listStats', () => {
  it('reports an untouched list as nothing learned, nothing known, all due', () => {
    const stats = listStats({ list, progress: { items: {} }, today: TODAY });
    expect(stats).toEqual({ cards: 2, learnedPct: 0, rightPct: null, due: 2 });
  });

  it('counts learned over every possible item, not just the started ones', () => {
    // one item of four is in box 5; the other three do not exist yet
    const progress = { items: { 'a:f2b': item({ box: 5, due: '2026-10-06', seen: 6 }) } };
    expect(listStats({ list, progress, today: TODAY }).learnedPct).toBe(25);
  });

  it('treats box 4 and 5 as learned and boxes 1 to 3 as not', () => {
    const progress = { items: {
      'a:f2b': item({ box: 4, due: '2026-10-06' }), 'a:b2f': item({ box: 3, due: '2026-10-06' }),
      'b:f2b': item({ box: 5, due: '2026-10-06' }), 'b:b2f': item({ box: 1, due: '2026-10-06' }),
    } };
    expect(listStats({ list, progress, today: TODAY }).learnedPct).toBe(50);
  });

  it('derives the success rate from seen and lapses', () => {
    const progress = { items: {
      'a:f2b': item({ seen: 8, lapses: 1, due: '2026-10-06' }),
      'b:f2b': item({ seen: 2, lapses: 1, due: '2026-10-06' }),
    } };
    // 10 answers, 2 of them wrong
    expect(listStats({ list, progress, today: TODAY }).rightPct).toBe(80);
  });

  it('counts a card once however many of its items are due', () => {
    const progress = { items: {
      'a:f2b': item({ due: TODAY }), 'a:b2f': item({ due: TODAY }),
      'b:f2b': item({ due: '2026-10-06' }), 'b:b2f': item({ due: '2026-10-06' }),
    } };
    expect(listStats({ list, progress, today: TODAY }).due).toBe(1);
  });

  it('counts a never-seen item as due', () => {
    const progress = { items: { 'a:f2b': item({ due: '2026-10-06' }),
                                'a:b2f': item({ due: '2026-10-06' }) } };
    expect(listStats({ list, progress, today: TODAY }).due).toBe(1);   // card b
  });

  it('ignores orphaned items left by a deleted card', () => {
    const progress = { items: { 'gone:f2b': item({ box: 5, due: '2026-10-06', seen: 9 }) } };
    expect(listStats({ list, progress, today: TODAY }).learnedPct).toBe(0);
    expect(listStats({ list, progress, today: TODAY }).rightPct).toBeNull();
  });

  it('survives an empty list', () => {
    const stats = listStats({ list: { id: 'x', cards: [] }, progress: { items: {} }, today: TODAY });
    expect(stats).toEqual({ cards: 0, learnedPct: 0, rightPct: null, due: 0 });
  });
});
