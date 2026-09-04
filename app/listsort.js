// How a screenful of lists is ordered. Three things to sort on, each either
// way round, which is six choices and no more: the setting is one string,
// `<key>-<dir>`, so it fits in the settings blob and in a <select> value
// without a parser worth the name.
export const SORT_KEYS = ['created', 'name', 'due'];
export const SORT_DIRS = ['asc', 'desc'];
export const DEFAULT_SORT = 'created-desc';

// Spelled out rather than derived, because this is also the order the six
// choices appear in the picker: the default first, and each pair the way
// round you would ask for it out loud.
export const SORT_VALUES = ['created-desc', 'created-asc', 'name-asc', 'name-desc',
                            'due-desc', 'due-asc'];

// Anything unrecognised — an older setting, a hand-edited blob — falls back
// to the default rather than sorting by nothing.
export function parseSort(value) {
  const [key, dir] = String(value || '').split('-');
  if (!SORT_KEYS.includes(key) || !SORT_DIRS.includes(dir)) {
    const [k, d] = DEFAULT_SORT.split('-');
    return { key: k, dir: d };
  }
  return { key, dir };
}

// Entries are `{ list, stats }`: the due count is not on the list, it is
// computed from the progress, and this module stays pure by being handed it.
// Name is the tie-break everywhere, so two lists created the same day, or
// both with nothing due, keep a stable and sensible order.
function compare(key, a, b) {
  if (key === 'name') return String(a.list.name || '').localeCompare(String(b.list.name || ''));
  if (key === 'due') return (a.stats.due || 0) - (b.stats.due || 0);
  // A list with no creation date is older than any list that has one: it
  // predates the field.
  return String(a.list.createdAt || '').localeCompare(String(b.list.createdAt || ''));
}

export function sortLists(entries, value) {
  const { key, dir } = parseSort(value);
  const sign = dir === 'desc' ? -1 : 1;
  return entries.slice().sort((a, b) =>
    sign * compare(key, a, b) || compare('name', a, b));
}
