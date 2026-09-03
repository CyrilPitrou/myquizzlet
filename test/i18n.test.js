import { describe, it, expect } from 'vitest';
import { plural, translate } from '../app/i18n.js';
import { en } from '../app/i18n.en.js';
import { fr } from '../app/i18n.fr.js';

describe('plural', () => {
  // French puts zero in the singular and English does not. This disagreement
  // is the whole reason this function exists.
  it('treats zero as singular in French and plural in English', () => {
    expect(plural('fr', 0)).toBe('one');
    expect(plural('en', 0)).toBe('other');
  });

  it('agrees about one', () => {
    expect(plural('fr', 1)).toBe('one');
    expect(plural('en', 1)).toBe('one');
  });

  it('agrees about two and above', () => {
    expect(plural('fr', 2)).toBe('other');
    expect(plural('en', 2)).toBe('other');
    expect(plural('fr', 17)).toBe('other');
  });
});

describe('translate', () => {
  const dict = {
    'lists.title': 'Lists',
    'common.cards_one': '{n} card',
    'common.cards_other': '{n} cards',
    'greet': 'Hello {who} and {who}',
  };

  it('returns the string for a plain key', () => {
    expect(translate(dict, dict, 'en', 'lists.title')).toBe('Lists');
  });

  it('interpolates every occurrence of a placeholder', () => {
    expect(translate(dict, dict, 'en', 'greet', { who: 'you' }))
      .toBe('Hello you and you');
  });

  it('leaves a placeholder alone when no value is given for it', () => {
    expect(translate(dict, dict, 'en', 'greet', {})).toBe('Hello {who} and {who}');
  });

  it('picks the plural variant from n', () => {
    expect(translate(dict, dict, 'en', 'common.cards', { n: 1 })).toBe('1 card');
    expect(translate(dict, dict, 'en', 'common.cards', { n: 3 })).toBe('3 cards');
  });

  it('applies the language’s own plural rule to zero', () => {
    const frDict = { 'common.cards_one': '{n} carte', 'common.cards_other': '{n} cartes' };
    expect(translate(frDict, dict, 'fr', 'common.cards', { n: 0 })).toBe('0 carte');
    expect(translate(dict, dict, 'en', 'common.cards', { n: 0 })).toBe('0 cards');
  });

  // A personal tool must never show its owner a dotted key.
  it('falls back to the fallback dictionary when the key is missing', () => {
    expect(translate({}, dict, 'fr', 'lists.title')).toBe('Lists');
  });

  it('falls back for a missing plural variant too', () => {
    expect(translate({}, dict, 'fr', 'common.cards', { n: 2 })).toBe('2 cards');
  });

  it('returns the key only when it is in neither dictionary', () => {
    expect(translate({}, {}, 'fr', 'nowhere.at.all')).toBe('nowhere.at.all');
  });
});

describe('the two dictionaries', () => {
  // The test that will still be earning its keep in a year: it catches the
  // key added to one language and forgotten in the other.
  it('have identical key sets', () => {
    const inEnOnly = Object.keys(en).filter((key) => !(key in fr));
    const inFrOnly = Object.keys(fr).filter((key) => !(key in en));
    expect({ inEnOnly, inFrOnly }).toEqual({ inEnOnly: [], inFrOnly: [] });
  });

  it('keeps plural pairs complete on both sides', () => {
    const lonely = Object.keys(en)
      .filter((key) => key.endsWith('_one'))
      .filter((key) => !(`${key.slice(0, -4)}_other` in en));
    expect(lonely).toEqual([]);
  });

  it('gives every French string the same placeholders as its English one', () => {
    const holes = (text) => (text.match(/\{\w+\}/g) || []).sort().join(',');
    const mismatched = Object.keys(en).filter((key) => holes(en[key]) !== holes(fr[key]));
    expect(mismatched).toEqual([]);
  });
});
