import { parseKey } from './srs.js';

const DIRECTIONS = ['f2b', 'b2f'];

// Learned and right describe the past; due describes today. All three are
// needed: a list of solid box-5 words reads the same the day before and the
// day after forty of them fall due.
export function listStats({ list, progress, today }) {
  const cards = (list && list.cards) || [];
  const items = (progress && progress.items) || {};
  const live = new Set(cards.map((card) => card.id));
  const dueCards = new Set();
  let learned = 0;
  let seen = 0;
  let lapses = 0;

  for (const [key, item] of Object.entries(items)) {
    const { cardId } = parseKey(key);
    if (!live.has(cardId)) continue;          // orphan of a deleted card
    if (item.box >= 4) learned += 1;
    seen += item.seen || 0;
    lapses += item.lapses || 0;
    if (item.due <= today) dueCards.add(cardId);
  }

  for (const card of cards) {
    for (const direction of DIRECTIONS) {
      if (!items[`${card.id}:${direction}`]) dueCards.add(card.id);   // never seen
    }
  }

  const possible = cards.length * DIRECTIONS.length;
  return {
    cards: cards.length,
    learnedPct: possible ? Math.round((learned / possible) * 100) : 0,
    rightPct: seen ? Math.round(((seen - lapses) / seen) * 100) : null,
    due: dueCards.size,
  };
}
