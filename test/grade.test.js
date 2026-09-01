import { describe, it, expect } from 'vitest';
import { grade, normalise } from '../app/grade.js';

describe('normalise', () => {
  it('strips case, accents, articles and punctuation', () => {
    expect(normalise('  Le Château!  ')).toBe('chateau');
  });
  it('collapses repeated whitespace', () => {
    expect(normalise('mon   ami')).toBe('mon ami');
  });
  it('strips an English indefinite article', () => {
    expect(normalise('a book')).toBe('book');
  });
});

describe('grade', () => {
  it('accepts an exact match', () => {
    expect(grade('le pain', 'le pain')).toBe('correct');
  });
  it('ignores case', () => {
    expect(grade('le pain', 'Le Pain')).toBe('correct');
  });
  it('ignores accents', () => {
    expect(grade('château', 'chateau')).toBe('correct');
  });
  it('ignores a missing leading article', () => {
    expect(grade('le pain', 'pain')).toBe('correct');
  });
  it('ignores an added leading article', () => {
    expect(grade('pain', 'le pain')).toBe('correct');
  });
  it('handles Spanish and English articles too', () => {
    expect(grade('el pan', 'pan')).toBe('correct');
    expect(grade('the bread', 'bread')).toBe('correct');
  });
  it('ignores surrounding whitespace and final punctuation', () => {
    expect(grade('le pain', ' le pain. ')).toBe('correct');
  });
  it('accepts any one of several answers separated by a slash or comma', () => {
    expect(grade('le pain / la miche', 'la miche')).toBe('correct');
    expect(grade('bread, loaf', 'loaf')).toBe('correct');
  });
  it('calls a one-letter difference a typo', () => {
    expect(grade('le pain', 'le pian')).toBe('typo');
    expect(grade('bread', 'bred')).toBe('typo');
    expect(grade('bread', 'breads')).toBe('typo');
  });
  it('calls two differences wrong', () => {
    expect(grade('bread', 'brad')).toBe('typo');
    expect(grade('bread', 'brud')).toBe('wrong');
  });
  it('calls a different word wrong', () => {
    expect(grade('le pain', 'le lait')).toBe('wrong');
  });
  it('calls empty input wrong', () => {
    expect(grade('le pain', '')).toBe('wrong');
    expect(grade('le pain', '   ')).toBe('wrong');
  });
  it('does not call a very short word a typo of another', () => {
    expect(grade('un', 'on')).toBe('wrong');
  });
});
