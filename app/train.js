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
