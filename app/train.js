import { itemKey, parseKey, shuffle as defaultShuffle } from './srs.js';

const DIRECTIONS = ['f2b', 'b2f'];

// Training introduces new words and rescues shaky ones: never-seen first, then
// the lowest box, then the most lapsed.
export function pickBatch({ list, progress, directions = DIRECTIONS, size = 8,
                            exclude = [], shuffle = defaultShuffle }) {
  const items = (progress && progress.items) || {};
  const skip = new Set(exclude);
  const fresh = [];
  const known = [];
  for (const card of list.cards) {
    for (const direction of directions) {
      const key = itemKey(card.id, direction);
      if (skip.has(key)) continue;
      const item = items[key];
      if (!item) fresh.push(key);
      else known.push([key, item]);
    }
  }
  known.sort((a, b) => (a[1].box - b[1].box) || ((b[1].lapses || 0) - (a[1].lapses || 0)));
  return shuffle(fresh).concat(known.map(([key]) => key)).slice(0, size);
}

// Distractors are drawn from the entries closest in length to the answer: a
// four-word option among three two-word ones answers itself.
export function choices({ list, key, count = 4, shuffle = defaultShuffle }) {
  const { cardId, direction } = parseKey(key);
  const side = direction === 'f2b' ? 'back' : 'front';
  const card = list.cards.find((c) => c.id === cardId);
  if (!card) return null;
  const answer = card[side];

  const pool = [];
  const seenText = new Set([answer]);
  for (const other of list.cards) {
    if (other.id === cardId) continue;
    const text = other[side];
    if (seenText.has(text)) continue;
    seenText.add(text);
    pool.push(text);
  }
  if (pool.length < 2) return null;

  pool.sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length));
  const shortlist = pool.slice(0, (count - 1) * 2);
  const distractors = shuffle(shortlist).slice(0, count - 1);
  return shuffle([answer, ...distractors]);
}
