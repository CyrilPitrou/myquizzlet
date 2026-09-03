import { describe, it, expect } from 'vitest';
import { parseCards, toCsv, previewRows } from '../app/csv.js';

describe('parseCards', () => {
  it('parses comma-separated pairs', () => {
    expect(parseCards('el pan,le pain\nla leche,le lait').cards)
      .toEqual([{ front: 'el pan', back: 'le pain' }, { front: 'la leche', back: 'le lait' }]);
  });

  it('parses tab-separated pairs pasted from a spreadsheet', () => {
    expect(parseCards('el pan\tle pain').cards).toEqual([{ front: 'el pan', back: 'le pain' }]);
  });

  it('parses semicolon-separated pairs', () => {
    expect(parseCards('el pan;le pain').cards).toEqual([{ front: 'el pan', back: 'le pain' }]);
  });

  it('prefers tab over semicolon when both are present on a line', () => {
    expect(parseCards('a;b\tc').cards).toEqual([{ front: 'a;b', back: 'c' }]);
  });

  it('respects quotes around a field containing the delimiter', () => {
    expect(parseCards('"pan, integral",pain complet').cards)
      .toEqual([{ front: 'pan, integral', back: 'pain complet' }]);
  });

  it('does not treat a quoted semicolon as the delimiter', () => {
    expect(parseCards('"a;b",c').cards).toEqual([{ front: 'a;b', back: 'c' }]);
  });

  it('does not treat a quoted tab as the delimiter', () => {
    expect(parseCards('"a\tb",c').cards).toEqual([{ front: 'a\tb', back: 'c' }]);
  });

  it('joins extra columns into the back field', () => {
    expect(parseCards('a,b,c').cards).toEqual([{ front: 'a', back: 'b,c' }]);
  });

  it('trims surrounding whitespace', () => {
    expect(parseCards('  el pan ,  le pain  ').cards).toEqual([{ front: 'el pan', back: 'le pain' }]);
  });

  it('skips blank lines without reporting them', () => {
    const result = parseCards('a,b\n\n   \nc,d');
    expect(result.cards).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it('reports a line with no delimiter instead of throwing', () => {
    const result = parseCards('a,b\noops\nc,d');
    expect(result.cards).toHaveLength(2);
    expect(result.errors).toEqual([{ line: 2, reason: 'no separator found' }]);
  });

  it('reports a line with an empty side', () => {
    expect(parseCards('a,').errors).toEqual([{ line: 1, reason: 'empty side' }]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCards('a,b\r\nc,d').cards).toHaveLength(2);
  });

  it('keeps a newline inside a quoted field', () => {
    expect(parseCards('"yo fui\ntú fuiste",ser').cards)
      .toEqual([{ front: 'yo fui\ntú fuiste', back: 'ser' }]);
  });

  it('keeps a blank line inside a quoted field rather than ending the card', () => {
    expect(parseCards('"a\n\nb",c').cards).toEqual([{ front: 'a\n\nb', back: 'c' }]);
  });

  it('normalises CRLF inside a quoted field', () => {
    expect(parseCards('"a\r\nb",c').cards).toEqual([{ front: 'a\nb', back: 'c' }]);
  });

  it('counts physical lines, so a record after a multi-line one is reported correctly', () => {
    const result = parseCards('"a\nb",c\noops');
    expect(result.errors).toEqual([{ line: 3, reason: 'no separator found' }]);
  });

  it('reports an unterminated quote instead of swallowing the rest of the file', () => {
    const result = parseCards('a,b\n"oops,c\nd,e');
    expect(result.cards).toEqual([{ front: 'a', back: 'b' }]);
    expect(result.errors).toEqual([{ line: 2, reason: 'unterminated quote' }]);
  });

  it('turns a backslash-n escape into a line break', () => {
    expect(parseCards('ser,yo fui\\ntú fuiste').cards)
      .toEqual([{ front: 'ser', back: 'yo fui\ntú fuiste' }]);
  });

  it('turns a backslash-n escape inside a quoted field into a line break', () => {
    expect(parseCards('"a\\nb",c').cards).toEqual([{ front: 'a\nb', back: 'c' }]);
  });

  it('trims the ends of a field but keeps the breaks inside it', () => {
    expect(parseCards('  \\na\\nb\\n  ,c').cards).toEqual([{ front: 'a\nb', back: 'c' }]);
  });
});

describe('toCsv', () => {
  it('round-trips through parseCards', () => {
    const cards = [{ front: 'el pan', back: 'le pain' }, { front: 'pan, integral', back: 'complet' }];
    expect(parseCards(toCsv(cards)).cards).toEqual(cards);
  });

  it('quotes fields containing a comma or a quote', () => {
    expect(toCsv([{ front: 'a,b', back: 'say "hi"' }])).toBe('"a,b","say ""hi"""');
  });

  it('quotes fields containing a semicolon', () => {
    expect(toCsv([{ front: 'a;b', back: 'c' }])).toBe('"a;b",c');
  });

  it('round-trips a card whose side has several lines', () => {
    const cards = [{ front: 'yo fui\ntú fuiste\nél fue', back: 'ser — pretérito' }];
    expect(parseCards(toCsv(cards)).cards).toEqual(cards);
  });

  it('round-trips cards with semicolons, commas, and tabs', () => {
    const cards = [
      { front: 'a;b', back: 'c,d' },
      { front: 'e\tf', back: 'g;h' },
    ];
    expect(parseCards(toCsv(cards)).cards).toEqual(cards);
  });
});

describe('previewRows', () => {
  it('returns one row per non-blank line, in order', () => {
    expect(previewRows('a,b\n\nc,d')).toEqual([
      { front: 'a', back: 'b', error: null },
      { front: 'c', back: 'd', error: null },
    ]);
  });

  it('returns one row per record, not one per physical line', () => {
    expect(previewRows('"a\nb",c\nd,e')).toEqual([
      { front: 'a\nb', back: 'c', error: null },
      { front: 'd', back: 'e', error: null },
    ]);
  });

  it('flags a line with no delimiter, but still returns its text for editing', () => {
    expect(previewRows('oops')).toEqual([{ front: 'oops', back: '', error: 'no separator found' }]);
  });

  it('flags a line with an empty side', () => {
    expect(previewRows('a,')).toEqual([{ front: 'a', back: '', error: 'empty side' }]);
  });

  it('respects semicolon as a delimiter', () => {
    expect(previewRows('el pan;le pain')).toEqual([{ front: 'el pan', back: 'le pain', error: null }]);
  });

  it('does not treat a quoted semicolon as the delimiter', () => {
    expect(previewRows('"a;b",c')).toEqual([{ front: 'a;b', back: 'c', error: null }]);
  });
});
