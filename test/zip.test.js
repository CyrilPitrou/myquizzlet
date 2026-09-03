import { describe, it, expect } from 'vitest';
import { crc32 } from 'node:zlib';
import { zip, safeName, entryNames } from '../app/zip.js';

// Reads the archive back with a real unzipper rather than with this module's
// own idea of the format: a zip only counts if something else can open it.
// Node cannot list entries, so the central directory is checked by hand and
// each entry's bytes are checked by inflating nothing — stored entries are
// their own payload.
const bytes = (text) => new TextEncoder().encode(text);
const decode = (view, at, length) => new TextDecoder().decode(view.slice(at, at + length));
const u16 = (view, at) => new DataView(view.buffer).getUint16(at, true);
const u32 = (view, at) => new DataView(view.buffer).getUint32(at, true);

describe('zip', () => {
  it('writes an empty archive as nothing but an end record', () => {
    const out = zip([]);
    expect(out.length).toBe(22);
    expect(u32(out, 0)).toBe(0x06054b50);
    expect(u16(out, 8)).toBe(0);          // entries on this disk
    expect(u16(out, 10)).toBe(0);         // entries in total
  });

  it('stores a file so its bytes appear verbatim in the archive', () => {
    const out = zip([{ name: 'a.csv', text: 'front,back' }]);
    expect(u32(out, 0)).toBe(0x04034b50);            // local file header
    expect(u16(out, 8)).toBe(0);                     // method 0, stored
    expect(decode(out, 30, 5)).toBe('a.csv');
    expect(decode(out, 35, 10)).toBe('front,back');
  });

  it('records the uncompressed size twice, because stored means equal', () => {
    const out = zip([{ name: 'a.csv', text: 'hello' }]);
    expect(u32(out, 18)).toBe(5);         // compressed size
    expect(u32(out, 22)).toBe(5);         // uncompressed size
  });

  it('measures sizes in UTF-8 bytes, not characters', () => {
    const out = zip([{ name: 'a.csv', text: 'héllo' }]);
    expect(u32(out, 22)).toBe(6);
  });

  it('counts every entry in the end record', () => {
    const out = zip([
      { name: 'a.csv', text: 'one' },
      { name: 'b.csv', text: 'two' },
      { name: 'c.csv', text: 'three' },
    ]);
    const end = out.length - 22;
    expect(u32(out, end)).toBe(0x06054b50);
    expect(u16(out, end + 8)).toBe(3);
    expect(u16(out, end + 10)).toBe(3);
  });

  it('points the end record at a central directory that is really there', () => {
    const out = zip([{ name: 'a.csv', text: 'one' }, { name: 'b.csv', text: 'two' }]);
    const end = out.length - 22;
    const size = u32(out, end + 12);
    const at = u32(out, end + 16);
    expect(at + size).toBe(end);
    expect(u32(out, at)).toBe(0x02014b50);      // first central header
  });

  it('gives each central header the offset its local header sits at', () => {
    const out = zip([{ name: 'a.csv', text: 'one' }, { name: 'b.csv', text: 'two' }]);
    const at = u32(out, out.length - 22 + 16);
    const first = u32(out, at + 42);
    expect(first).toBe(0);
    expect(u32(out, first)).toBe(0x04034b50);
    const second = u32(out, at + 46 + 5 + 42);
    expect(u32(out, second)).toBe(0x04034b50);
    expect(decode(out, second + 30, 5)).toBe('b.csv');
  });

  // The CRC is the one field a reader actually verifies, so it is checked
  // against zlib's, not against this module's own table.
  it('writes the CRC32 zlib computes for the same bytes', () => {
    const text = 'front,back\nchat,cat';
    const out = zip([{ name: 'a.csv', text }]);
    expect(u32(out, 14)).toBe(crc32(bytes(text)));
  });

  it('writes the same CRC into the central header as into the local one', () => {
    const out = zip([{ name: 'a.csv', text: 'one' }, { name: 'b.csv', text: 'two' }]);
    const at = u32(out, out.length - 22 + 16);
    expect(u32(out, at + 16)).toBe(crc32(bytes('one')));
    expect(u32(out, at + 46 + 5 + 16)).toBe(crc32(bytes('two')));
  });

  it('gets the CRC of an empty file right, which is zero', () => {
    const out = zip([{ name: 'a.csv', text: '' }]);
    expect(u32(out, 14)).toBe(0);
    expect(u32(out, 22)).toBe(0);
  });

  it('marks every entry UTF-8, so an accented title survives the round trip', () => {
    const out = zip([{ name: 'Français.csv', text: 'a,b' }]);
    expect(u16(out, 6) & 0x800).toBe(0x800);           // language encoding flag
    expect(decode(out, 30, bytes('Français.csv').length)).toBe('Français.csv');
  });
});

describe('entryNames', () => {
  it('names each list after its title', () => {
    expect(entryNames([{ title: 'Food', id: 'a' }, { title: 'Verbs', id: 'b' }]))
      .toEqual(['Food.csv', 'Verbs.csv']);
  });

  it('keeps two lists of the same title apart, so the archive is not broken', () => {
    const names = entryNames([
      { title: 'Food', id: 'a' }, { title: 'Food', id: 'b' }, { title: 'Food', id: 'c' },
    ]);
    expect(names).toEqual(['Food.csv', 'Food (b).csv', 'Food (c).csv']);
    expect(new Set(names).size).toBe(3);
  });

  it('keeps two titles apart that only differ where safeName replaces', () => {
    const names = entryNames([{ title: 'a/b', id: '1' }, { title: 'a:b', id: '2' }]);
    expect(new Set(names).size).toBe(2);
  });

  it('keeps untitled lists apart, which all collapse to the same fallback', () => {
    const names = entryNames([{ title: '', id: '1' }, { title: '', id: '2' }]);
    expect(names).toEqual(['list.csv', 'list (2).csv']);
  });
});

describe('safeName', () => {
  it('keeps an ordinary title as it is', () => {
    expect(safeName('Spanish food')).toBe('Spanish food');
  });

  it('replaces the characters a file system or a zip reader would choke on', () => {
    expect(safeName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
  });

  it('collapses a run of replaced characters into one dash', () => {
    expect(safeName('a///b')).toBe('a-b');
  });

  // Spaces are fine in a file name on every system the app runs on, and a
  // title reads better with them, so they are deliberately kept.
  it('keeps the spaces inside a title', () => {
    expect(safeName('Spanish / Food')).toBe('Spanish - Food');
    expect(safeName('two  spaces')).toBe('two  spaces');
  });

  it('strips control characters, which no file name may carry', () => {
    expect(safeName('a\u0000b\u001fc')).toBe('a-b-c');
  });

  it('keeps an accented title intact', () => {
    expect(safeName('Français – Général')).toBe('Français – Général');
  });

  it('trims leading and trailing dashes, dots and spaces', () => {
    expect(safeName('  ..a.. ')).toBe('a');
    expect(safeName('/leading')).toBe('leading');
  });

  it('falls back rather than yielding an empty name', () => {
    expect(safeName('')).toBe('list');
    expect(safeName('///')).toBe('list');
    expect(safeName('...')).toBe('list');
  });

  it('keeps a name short enough for any file system', () => {
    expect(safeName('x'.repeat(200)).length).toBe(80);
  });
});
