export const INTERVALS = [1, 3, 7, 16, 35];

export const itemKey = (cardId, direction) => `${cardId}:${direction}`;

export function parseKey(key) {
  const at = key.lastIndexOf(':');
  return { cardId: key.slice(0, at), direction: key.slice(at + 1) };
}

function addDays(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function newItem(today) {
  return { box: 1, due: today, seen: 0, lapses: 0, lastSeen: null, level: 0 };
}

export function nextItem(item, correct, today, nowIso) {
  const box = correct ? Math.min(item.box + 1, INTERVALS.length) : 1;
  return {
    box,
    due: addDays(today, INTERVALS[box - 1]),
    seen: item.seen + 1,
    lapses: item.lapses + (correct ? 0 : 1),
    lastSeen: nowIso,
    // A word you have just got wrong is re-introduced with multiple choice,
    // whether the wrong answer came from training or from a test.
    level: correct ? (item.level || 0) : 0,
  };
}

export function dueKeys(items, today) {
  return Object.keys(items).filter((key) => items[key].due <= today);
}

export const shuffle = (xs) => {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function buildQueue({ list, progress, directions, today, limit,
                            includeNew = true, shuffle: shuffleFn = shuffle }) {
  const items = progress.items || {};
  const due = [];
  const fresh = [];
  for (const card of list.cards) {
    for (const direction of directions) {
      const key = itemKey(card.id, direction);
      const item = items[key];
      if (!item) { if (includeNew) fresh.push(key); }
      else if (item.due <= today) due.push(key);
    }
  }
  return shuffleFn(due).concat(shuffleFn(fresh)).slice(0, limit);
}
