import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { encode } from '../app/qr.js';

const { fixtures } = JSON.parse(
  readFileSync(new URL('./fixtures/qr.json', import.meta.url), 'utf8'));

// A matrix rendered the way the fixture stores it, so a failure prints two
// comparable pictures instead of a wall of booleans.
const asRows = (matrix) => matrix.map((row) => row.map((dark) => (dark ? '1' : '0')).join(''));

// Every fixture, versions 1 to 13.
const covered = fixtures;

describe('encode, against qrencode', () => {
  for (const fixture of covered) {
    it(`matches ${fixture.name}`, () => {
      const matrix = encode(fixture.text);
      expect(matrix.length).toBe(fixture.size);
      expect(asRows(matrix)).toEqual(fixture.rows);
    });
  }

  it('covers every version it claims to', () => {
    expect([...new Set(covered.map((f) => f.version))].sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('refuses a payload no version 13 symbol can hold', () => {
    expect(() => encode('x'.repeat(426))).toThrow();
  });

  it('measures the payload in UTF-8 bytes, not characters', () => {
    // 'é' is two bytes, so 9 of them plus a filler byte fill version 1 exactly
    // and one more character does not.
    expect(encode(`${'é'.repeat(8)}x`).length).toBe(21);
    expect(encode(`${'é'.repeat(9)}x`).length).toBeGreaterThan(21);
  });

  it('stays inside the size the design budgeted for it', () => {
    const source = readFileSync(new URL('../app/qr.js', import.meta.url), 'utf8');
    const code = source.split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('//'));
    expect(code.length).toBeLessThan(320);
  });
});
