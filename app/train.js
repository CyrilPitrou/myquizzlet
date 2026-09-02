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

// Rung 0 is pick-from-four, rung 1 is typing. Right moves an item up; wrong
// sends it to the bottom rung and to the back of the queue, which is also what
// keeps the same word from being asked twice in a row.
export function startBatch(keys, progress) {
  const items = (progress && progress.items) || {};
  const levels = {};
  for (const key of keys) levels[key] = items[key] && items[key].level === 1 ? 1 : 0;
  return { queue: keys.slice(), levels, graduated: [] };
}

export const currentKey = (state) => (state.queue.length ? state.queue[0] : null);

export const currentLevel = (state) =>
  (state.queue.length ? state.levels[state.queue[0]] : null);

export function advance(state, correct) {
  const [key, ...rest] = state.queue;
  if (key === undefined) return state;
  if (correct && state.levels[key] === 1) {
    return { queue: rest, levels: { ...state.levels },
             graduated: state.graduated.concat(key) };
  }
  return {
    queue: rest.concat(key),
    levels: { ...state.levels, [key]: correct ? 1 : 0 },
    graduated: state.graduated.slice(),
  };
}
