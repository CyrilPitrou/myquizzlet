import { describe, it, expect } from 'vitest';
import { suggestionsDoc, seedWish, recentEntries } from '../app/wishes.js';

describe('suggestionsDoc', () => {
  it('stamps the text with the time it was written', () => {
    expect(suggestionsDoc('add food words', '2026-09-03T18:04:00Z'))
      .toEqual({ updatedAt: '2026-09-03T18:04:00Z', text: 'add food words' });
  });

  // The workflow fires on a non-empty text and the skill stops on an empty
  // one, so "empty" has to mean the same thing to both. A box someone
  // cleared leaves spaces and newlines behind; those are not a wish.
  it('treats whitespace-only text as empty', () => {
    expect(suggestionsDoc('   \n\n  ', '2026-09-03T18:04:00Z').text).toBe('');
  });

  it('keeps the text otherwise untouched, trailing newline and all', () => {
    expect(suggestionsDoc('one\n\ntwo\n', '2026-09-03T18:04:00Z').text)
      .toBe('one\n\ntwo\n');
  });
});

describe('seedWish', () => {
  it('is just the prefix when the box is empty', () => {
    expect(seedWish('', 'In "Spanish – Food": ')).toBe('In "Spanish – Food": ');
  });

  it('treats a whitespace-only box as empty', () => {
    expect(seedWish('  \n ', 'In "Ville": ')).toBe('In "Ville": ');
  });

  // Someone else's wish is already in the shared box. Adding to it must
  // never replace it.
  it('appends after a blank line when the box has text', () => {
    expect(seedWish('please add 50 food words', 'In "Ville": '))
      .toBe('please add 50 food words\n\nIn "Ville": ');
  });

  it('does not care about trailing newlines already in the box', () => {
    expect(seedWish('first wish\n\n\n', 'In "Ville": '))
      .toBe('first wish\n\nIn "Ville": ');
  });

  // Tapping the same menu entry twice is not a request for two prefixes.
  it('does not repeat a prefix that is already at the end', () => {
    const text = 'first wish\n\nIn "Ville": ';
    expect(seedWish(text, 'In "Ville": ')).toBe(text);
  });
});

describe('recentEntries', () => {
  const log = {
    entries: [
      { at: '2026-09-01T10:00:00Z', wish: 'a', done: 'did a' },
      { at: '2026-09-03T10:00:00Z', wish: 'c', done: 'did c' },
      { at: '2026-09-02T10:00:00Z', wish: 'b', done: 'did b' },
    ],
  };

  it('is empty when there is no log file yet', () => {
    expect(recentEntries(null)).toEqual([]);
  });

  it('is empty when the log has no entries', () => {
    expect(recentEntries({ entries: [] })).toEqual([]);
    expect(recentEntries({})).toEqual([]);
  });

  // The skill writes newest-first, but the file is hand-editable and the
  // screen should not depend on someone having kept the order.
  it('returns newest first whatever order the file is in', () => {
    expect(recentEntries(log).map((entry) => entry.wish)).toEqual(['c', 'b', 'a']);
  });

  it('shows at most the limit', () => {
    expect(recentEntries(log, 2).map((entry) => entry.wish)).toEqual(['c', 'b']);
  });

  it('defaults to five', () => {
    const many = {
      entries: Array.from({ length: 8 }, (whole, i) => ({
        at: `2026-09-0${i + 1}T10:00:00Z`, wish: String(i), done: `did ${i}`,
      })),
    };
    expect(recentEntries(many).length).toBe(5);
    expect(recentEntries(many)[0].wish).toBe('7');
  });
});
