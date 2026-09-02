import { describe, it, expect } from 'vitest';
import { langOf } from '../app/langs.js';

describe('langOf', () => {
  it('recognises an English language name', () => {
    expect(langOf('French')).toBe('fr');
    expect(langOf('Spanish')).toBe('es');
  });

  it('recognises the language’s own name, accents and all', () => {
    expect(langOf('Français')).toBe('fr');
    expect(langOf('francais')).toBe('fr');
    expect(langOf('Español')).toBe('es');
  });

  it('accepts a bare code', () => {
    expect(langOf('fr')).toBe('fr');
    expect(langOf('EN')).toBe('en');
  });

  it('ignores case and surrounding space', () => {
    expect(langOf('  GERMAN  ')).toBe('de');
  });

  it('returns null for a label that is not a language', () => {
    expect(langOf('Date')).toBeNull();
    expect(langOf('Event')).toBeNull();
    expect(langOf('')).toBeNull();
    expect(langOf(null)).toBeNull();
    expect(langOf(undefined)).toBeNull();
  });
});
