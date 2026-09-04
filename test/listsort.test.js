import { describe, it, expect } from 'vitest';
import { parseSort, sortLists, SORT_VALUES, DEFAULT_SORT } from '../app/listsort.js';

const entry = (name, createdAt, due) => ({ list: { name, createdAt }, stats: { due } });

const entries = [
  entry('Beta', '2026-09-03', 5),
  entry('Alpha', '2026-01-10', 0),
  entry('Gamma', '2026-05-20', 5),
];

const names = (sorted) => sorted.map((e) => e.list.name);

describe('parseSort', () => {
  it('splits a good value', () => {
    expect(parseSort('name-asc')).toEqual({ key: 'name', dir: 'asc' });
  });

  it('falls back to the default for anything it does not know', () => {
    const fallback = parseSort(DEFAULT_SORT);
    expect(parseSort(undefined)).toEqual(fallback);
    expect(parseSort('size-asc')).toEqual(fallback);
    expect(parseSort('name-sideways')).toEqual(fallback);
  });

  it('knows six values and only six, the default first', () => {
    expect(SORT_VALUES).toHaveLength(6);
    expect(SORT_VALUES[0]).toBe(DEFAULT_SORT);
    expect(new Set(SORT_VALUES).size).toBe(6);
    for (const value of SORT_VALUES) {
      const { key, dir } = parseSort(value);
      expect(`${key}-${dir}`).toBe(value);
    }
  });
});

describe('sortLists', () => {
  it('orders by creation date, both ways', () => {
    expect(names(sortLists(entries, 'created-asc'))).toEqual(['Alpha', 'Gamma', 'Beta']);
    expect(names(sortLists(entries, 'created-desc'))).toEqual(['Beta', 'Gamma', 'Alpha']);
  });

  it('orders by name, both ways', () => {
    expect(names(sortLists(entries, 'name-asc'))).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(names(sortLists(entries, 'name-desc'))).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('orders by how many cards are due', () => {
    expect(names(sortLists(entries, 'due-asc'))).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(names(sortLists(entries, 'due-desc'))).toEqual(['Beta', 'Gamma', 'Alpha']);
  });

  it('breaks a tie by name, ascending, whichever way the sort runs', () => {
    expect(names(sortLists(entries, 'due-desc')).slice(0, 2)).toEqual(['Beta', 'Gamma']);
  });

  it('treats a list with no creation date as the oldest', () => {
    const withOld = entries.concat(entry('Delta', undefined, 1));
    expect(names(sortLists(withOld, 'created-asc'))[0]).toBe('Delta');
  });

  it('leaves the caller\'s array alone', () => {
    const before = names(entries);
    sortLists(entries, 'name-asc');
    expect(names(entries)).toEqual(before);
  });
});
