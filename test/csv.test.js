import { describe, it, expect } from 'vitest';
import { parseCards, toCsv } from '../app/csv.js';

describe('parseCards', () => {
  it('parses comma-separated pairs', () => {
    expect(parseCards('el pan,le pain\nla leche,le lait').cards)
      .toEqual([{ front: 'el pan', back: 'le pain' }, { front: 'la leche', back: 'le lait' }]);
  });

  it('parses tab-separated pairs pasted from a spreadsheet', () => {
    expect(parseCards('el pan\tle pain').cards).toEqual([{ front: 'el pan', back: 'le pain' }]);
  });

  it('respects quotes around a field containing the delimiter', () => {
    expect(parseCards('"pan, integral",pain complet').cards)
      .toEqual([{ front: 'pan, integral', back: 'pain complet' }]);
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
});

describe('toCsv', () => {
  it('round-trips through parseCards', () => {
    const cards = [{ front: 'el pan', back: 'le pain' }, { front: 'pan, integral', back: 'complet' }];
    expect(parseCards(toCsv(cards)).cards).toEqual(cards);
  });

  it('quotes fields containing a comma or a quote', () => {
    expect(toCsv([{ front: 'a,b', back: 'say "hi"' }])).toBe('"a,b","say ""hi"""');
  });
});
