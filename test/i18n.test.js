import { describe, it, expect } from 'vitest';
import { plural, translate } from '../app/i18n.js';
import { en } from '../app/i18n.en.js';
import { fr } from '../app/i18n.fr.js';
import { helpEn } from '../app/screens/help.en.js';
import { helpFr } from '../app/screens/help.fr.js';

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

describe('the help prose', () => {
  // Recursively collects every string leaf a paragraph part can hold — a
  // plain string, or a { b: text } bold span — so a bold span left empty in
  // one language is caught the same as an empty paragraph.
  function strings(value) {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(strings);
    if (value && typeof value === 'object') {
      if ('b' in value) return [value.b];
      return Object.values(value).flatMap(strings);
    }
    return [];
  }

  it('has the same sections in the same order in both languages', () => {
    expect(helpFr.sections.length).toBe(helpEn.sections.length);
    helpEn.sections.forEach((section, i) => {
      expect(helpFr.sections[i].paragraphs.length).toBe(section.paragraphs.length);
    });
  });

  it('has the same install steps and device-setup steps in both languages', () => {
    expect(helpFr.install.steps.length).toBe(helpEn.install.steps.length);
    // Found by shape, not by position: the token section was added after it.
    const enDevices = helpEn.sections.find((section) => section.steps);
    const frDevices = helpFr.sections.find((section) => section.steps);
    expect(frDevices.steps.length).toBe(enDevices.steps.length);
    expect(frDevices.afterSteps.length).toBe(enDevices.afterSteps.length);
  });

  it('leaves nothing empty', () => {
    const blank = [helpEn, helpFr]
      .flatMap((words) => strings(words))
      .filter((text) => !text || !text.trim());
    expect(blank).toEqual([]);
  });
});
