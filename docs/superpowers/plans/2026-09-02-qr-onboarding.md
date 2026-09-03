# QR onboarding — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a second device be brought into MyQuizzlet by pointing its camera at a QR code — either at two public links it can set itself up from, or, opt-in, at a link carrying this device's token, which lands on an adopt screen that asks before saving.

**Architecture:** One new pure module, `app/qr.js`, draws QR matrices itself, because no third-party generator may ever see a token. A second pure module, `app/setup.js`, owns the shape of the setup link and everything derived from a token — masking, expiry. One new screen, `app/screens/adopt.js`, is where a scanned link lands; it asks, and strips the fragment on either answer. `app/screens/settings.js` gains the "Add a device" section that shows the codes. The app contains no QR *decoder* and asks for no camera permission: the receiving phone's own camera app opens the URL.

**Tech Stack:** Hand-written ES modules, no build step, no dependencies. Vitest for the pure modules. `qrencode` 4.1.1 (development only) generated the fixtures, which are already in the working tree.

**Spec:** `devnotes/2026-09-01-myquizzlet-design.md`, the **Auth** section — binding. Scheduled by `docs/superpowers/specs/2026-09-02-app-reorganisation-design.md` §10, which changes nothing about it. Standing constraints in `CLAUDE.md`.

---

## Global Constraints

- **No build step, no framework, no CDN script, no new runtime dependency.** `npm` exists only to run tests. The deployed app has zero runtime dependencies.
- **Never write a token into a file in this repo.** Not in a fixture, not in a test, not in a doc, not in an example. Every token-shaped string in this plan is deliberately fake and says so. If a real one is ever committed it must be revoked on GitHub immediately.
- **The app contains no QR decoder and requests no camera permission.** The receiving phone's own camera app opens the URL.
- **Every new module goes into `SHELL` in `sw.js` and the cache name is bumped**, or the app stops working offline.
- **Pure modules are written test-first** and take no clock: today's date is passed in, as in `srs.js`.
- **Every colour comes from a custom property** in `app/style.css` (`test/style.test.js` enforces it). The one deliberate exception is the QR image itself, whose black-on-white is set as SVG attributes in JS, never in CSS — see Task 5.
- Screens import shared singletons from `app/app.js`, never from `app/main.js`.
- **Every commit message ends with these two lines:**

  ```
  Cyril Pitrou
  Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
  ```

- **Do not commit a task with a visual or interactive result.** Tasks 4–8 end by handing the user a click-only checklist and waiting. The user verifies in a browser at `http://localhost:8000` and does not use the browser console.

## Three roads that are closed

Do not propose, implement, or "improve towards" any of these. Each was considered and rejected in the design, with reasons:

- **A short pairing code.** Needs a server to broker the exchange. There is no server and there will not be one.
- **An encrypted blob on the `data` branch.** Makes a public, offline-brute-forceable file out of a token.
- **GitHub's OAuth device flow.** The code-for-token endpoint sends no CORS headers, and adding a proxy violates the no-cost, no-maintenance constraint.

## File structure

| File | Status | Responsibility |
|---|---|---|
| `test/fixtures/qr.json` | already in the tree | 31 reference matrices from `qrencode`, versions 1–13 |
| `test/fixtures/generate-qr-fixtures.mjs` | already in the tree | regenerates the above; documents exactly how |
| `app/qr.js` | create (Tasks 1–2) | pure. `encode(text) -> boolean[][]` |
| `test/qr.test.js` | create (Tasks 1–2) | fixture assertions, module for module |
| `app/setup.js` | create (Task 3) | pure. the setup link, token masking, expiry arithmetic |
| `test/setup.test.js` | create (Task 3) | |
| `app/screens/adopt.js` | create (Task 4) | the screen a scanned token link lands on |
| `app/main.js` | modify (Task 4) | one route: `#/adopt` |
| `sw.js` | modify (Task 4) | three new modules in `SHELL`, cache bumped to v10 |
| `app/screens/settings.js` | modify (Tasks 5–7) | "Add a device"; token field accepts a link; expiry warning |
| `app/style.css` | modify (Tasks 4–6) | `.facts`, `.qr`, `.qr-pair`, `.optin` |
| `app/screens/lists.js` | modify (Task 7) | the expiry banner on Home |
| `README.md`, `docs/architecture.md`, `docs/sync.md`, `app/screens/help.js` | modify (Task 8) | |

The two QR tasks come first and are the only ones with no visual result: the
encoder is either right against `qrencode` or it is not, and everything after
it is worthless until it is.

---

## Task 1: `qr.js` — a correct encoder for versions 1 to 5

Versions 1–5 at level L are single-block symbols with no version-information
blocks, so this task is the whole encoder *except* interleaving and the two
extra function patterns. That is the hard half: the bit stream, Galois-field
arithmetic, Reed–Solomon, the function patterns, the zigzag, the eight masks
and the penalty score. Task 2 adds the rest and lets the same test file loose
on every fixture.

**Files:**
- Create: `app/qr.js`
- Test: `test/qr.test.js`
- Read (do not modify): `test/fixtures/qr.json`, `test/fixtures/generate-qr-fixtures.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function encode(text: string): boolean[][]` — row-major, `matrix[row][col]`, `true` meaning a dark module, no quiet zone. Throws `Error` when the UTF-8 encoding of `text` exceeds 425 bytes.

### The fixture file

Already committed. Shape:

```json
{
  "generator": "qrencode 4.1.1, byte mode, level L, no quiet zone",
  "note": "Regenerate with test/fixtures/generate-qr-fixtures.mjs. Contains no real token.",
  "fixtures": [
    { "name": "a short payload", "text": "MyQuizzlet", "version": 1, "size": 21,
      "rows": ["111111100...", "…21 strings of 21 characters…"] }
  ]
}
```

`rows[r][c]` is `"1"` for a dark module. This is the oracle: it was produced by
`qrencode` on the developer's machine, not by any model. **Do not edit
`qr.json` by hand, and do not adjust a fixture to match the implementation. If
a fixture disagrees with the code, the code is wrong.**

- [ ] **Step 1: Write the failing test**

`test/qr.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { encode } from '../app/qr.js';

const { fixtures } = JSON.parse(
  readFileSync(new URL('./fixtures/qr.json', import.meta.url), 'utf8'));

// A matrix rendered the way the fixture stores it, so a failure prints two
// comparable pictures instead of a wall of booleans.
const asRows = (matrix) => matrix.map((row) => row.map((dark) => (dark ? '1' : '0')).join(''));

// Task 1 owns versions 1-5. Task 2 deletes this filter.
const covered = fixtures.filter((fixture) => fixture.version <= 5);

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
      .toEqual([1, 2, 3, 4, 5]);
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
});
```

- [ ] **Step 2: Run the test and watch it fail**

```sh
npm test -- qr
```

Expected: every case fails, `Failed to resolve import "../app/qr.js"`.

- [ ] **Step 3: Write the tables**

These are data from ISO/IEC 18004 and must be transcribed exactly. Put all
thirteen versions in now even though this task only exercises five — they are
the same table and splitting it would be worse.

```js
// app/qr.js
//
// A QR encoder. Byte mode, error correction level L, versions 1-13, which is
// as much as this app can ever need: the longest payload it draws is a setup
// link of about 140 bytes.
//
// It exists because no third-party generator may ever see a token, and the
// payload is dynamic, so a committed image cannot serve. See the Auth section
// of devnotes/2026-09-01-myquizzlet-design.md.
//
// Verified module for module against matrices produced by qrencode; see
// test/qr.test.js. Nothing in here should be changed without that test.

// Per version (index 0 is version 1), at error correction level L:
//   ecPerBlock  error correction codewords in each block
//   blocks      [count, data codewords] per group; two groups when they differ
const EC_L = [
  { ecPerBlock: 7,  blocks: [[1, 19]] },
  { ecPerBlock: 10, blocks: [[1, 34]] },
  { ecPerBlock: 15, blocks: [[1, 55]] },
  { ecPerBlock: 20, blocks: [[1, 80]] },
  { ecPerBlock: 26, blocks: [[1, 108]] },
  { ecPerBlock: 18, blocks: [[2, 68]] },
  { ecPerBlock: 20, blocks: [[2, 78]] },
  { ecPerBlock: 24, blocks: [[2, 97]] },
  { ecPerBlock: 30, blocks: [[2, 116]] },
  { ecPerBlock: 18, blocks: [[2, 68], [2, 69]] },
  { ecPerBlock: 20, blocks: [[4, 81]] },
  { ecPerBlock: 24, blocks: [[2, 92], [2, 93]] },
  { ecPerBlock: 26, blocks: [[4, 107]] },
];

// Alignment pattern centre coordinates, per version. Version 1 has none.
const ALIGNMENT = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
  [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
];

// Bits left over after the interleaved codewords, per version.
const REMAINDER_BITS = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0];

const MAX_VERSION = 13;
```

Derive, rather than transcribe, the two numbers that follow from the table —
a transcription error in a derived number is a bug the fixtures would only
sometimes catch:

```js
const dataCodewords = (version) => EC_L[version - 1].blocks
  .reduce((total, [count, data]) => total + count * data, 0);

const blockCount = (version) => EC_L[version - 1].blocks
  .reduce((total, [count]) => total + count, 0);

// 4 bits of mode plus the character count indicator: 8 bits up to version 9,
// 16 from version 10.
const countBits = (version) => (version <= 9 ? 8 : 16);

const capacity = (version) =>
  Math.floor((dataCodewords(version) * 8 - 4 - countBits(version)) / 8);
```

Sanity, for the implementer: `capacity` must come out 17, 32, 53, 78, 106,
134, 154, 192, 230, 271, 321, 367, 425 for versions 1 to 13. Those are exactly
the byte counts the fixtures are built on, so if they do not match, the table
is mistyped.

- [ ] **Step 4: Write the Galois field and Reed–Solomon**

GF(256) with primitive polynomial `0x11D`, generator 2 — the QR field.

```js
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// The generator polynomial of degree `degree`, coefficients high-order first:
// (x - 2^0)(x - 2^1)…(x - 2^(degree-1)).
function generator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

// Polynomial division of `data` by the generator; the remainder is the block's
// error correction codewords.
function ecCodewords(data, count) {
  const gen = generator(count);
  const remainder = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < count; i++) remainder[i] ^= mul(gen[i + 1], factor);
  }
  return remainder;
}
```

- [ ] **Step 5: Write the bit stream and the codeword sequence**

```js
// Mode 0100 (byte), the character count, the data, a terminator, then the
// alternating pad bytes, to exactly the version's data capacity.
function codewords(bytes, version) {
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, countBits(version));
  for (const byte of bytes) push(byte, 8);

  const total = dataCodewords(version) * 8;
  push(0, Math.min(4, total - bits.length));          // terminator
  while (bits.length % 8) bits.push(0);               // to a byte boundary

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let i = 0; data.length < dataCodewords(version); i++) {
    data.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return data;
}
```

Then split into blocks, compute each block's error correction, and interleave.
Write the general form now — with one block it is the identity, and Task 2
needs it correct.

```js
// Data codewords first, one from each block in turn, then the error
// correction codewords the same way. Blocks differ in length by at most one,
// so a short block simply contributes nothing to the last data round.
function interleave(data, version) {
  const { ecPerBlock, blocks: groups } = EC_L[version - 1];
  const blocks = [];
  let at = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      blocks.push(data.slice(at, at + size));
      at += size;
    }
  }
  const ec = blocks.map((block) => ecCodewords(block, ecPerBlock));

  const out = [];
  const longest = Math.max(...blocks.map((block) => block.length));
  for (let i = 0; i < longest; i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) for (const block of ec) out.push(block[i]);
  return out;
}
```

- [ ] **Step 6: Write the function patterns**

Keep a parallel `reserved` matrix: it is what the zigzag skips and what the
mask must not touch.

```js
const FINDER = [
  [1, 1, 1, 1, 1, 1, 1], [1, 0, 0, 0, 0, 0, 1], [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1], [1, 0, 1, 1, 1, 0, 1], [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
];

function blank(size) {
  return Array.from({ length: size }, () => new Array(size).fill(false));
}

function functionPatterns(version) {
  const size = version * 4 + 17;
  const modules = blank(size);
  const reserved = blank(size);
  const set = (row, col, dark) => {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    modules[row][col] = dark;
    reserved[row][col] = true;
  };

  // The three finders, each with its one-module separator all the way round.
  for (const [top, left] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r < 7 && c >= 0 && c < 7;
        set(top + r, left + c, inside ? FINDER[r][c] === 1 : false);
      }
    }
  }

  // Timing patterns: row 6 and column 6, alternating from the fixed corner.
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Alignment patterns, everywhere except the three that would sit on a finder.
  const centres = ALIGNMENT[version - 1];
  for (const row of centres) {
    for (const col of centres) {
      const corner = (row === centres[0] && col === centres[0])
        || (row === centres[0] && col === centres[centres.length - 1])
        || (row === centres[centres.length - 1] && col === centres[0]);
      if (corner) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          set(row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
        }
      }
    }
  }

  // The format information areas are reserved now and written per mask later.
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  set(size - 8, 8, true);     // the dark module, always dark

  return { size, modules, reserved };
}
```

Task 2 adds the version-information blocks here.

- [ ] **Step 7: Write the zigzag placement**

Two-module-wide columns, right to left, alternating upward and downward,
skipping column 6 because the vertical timing pattern lives there.

```js
function place(modules, reserved, bytes, version) {
  const size = modules.length;
  const bit = (i) => (i >> 3) < bytes.length
    && ((bytes[i >> 3] >> (7 - (i & 7))) & 1) === 1;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (reserved[row][col]) continue;
        modules[row][col] = bit(i);
        i += 1;
      }
    }
  }
}
```

The remainder bits fall out of this for free: `bit()` returns `false` past the
end of the codewords, which is what the remainder bits are. `REMAINDER_BITS` is
in the table for the reader's sake and as a check — after `place`, the number
of unreserved modules must equal `bytes.length * 8 + REMAINDER_BITS[version - 1]`.

- [ ] **Step 8: Write the masks, the format information and the penalty score**

```js
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// 15 bits: two for the level (01 for L), three for the mask, an 11-bit BCH
// remainder, the whole thing XORed with 0x5412 so it is never all zero.
function formatBits(mask) {
  const data = (0b01 << 3) | mask;
  let rest = data << 10;
  for (let i = 14; i >= 10; i--) if ((rest >> i) & 1) rest ^= 0x537 << (i - 10);
  return ((data << 10) | rest) ^ 0x5412;
}

function writeFormat(modules, mask) {
  const size = modules.length;
  const bits = formatBits(mask);
  const bit = (i) => ((bits >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) modules[i][8] = bit(i);
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let i = 9; i < 15; i++) modules[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) modules[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) modules[size - 15 + i][8] = bit(i);
  modules[size - 8][8] = true;
}
```

The four penalty rules, with the standard weights 3, 3, 40, 10:

```js
function penalty(modules) {
  const size = modules.length;
  let score = 0;

  // Rule 1: a run of five or more of one colour, in a row or a column.
  // Rule 3: the finder-like pattern 1011101 with four light modules beside it.
  const line = (get) => {
    let runColour = get(0);
    let runLength = 1;
    const window = [get(0)];
    for (let i = 1; i < size; i++) {
      const here = get(i);
      if (here === runColour) runLength += 1;
      else { runColour = here; runLength = 1; }
      if (runLength === 5) score += 3;
      else if (runLength > 5) score += 1;

      window.push(here);
      if (window.length > 11) window.shift();
      if (window.length === 11) {
        const shape = window.map((dark) => (dark ? '1' : '0')).join('');
        if (shape === '10111010000' || shape === '00001011101') score += 40;
      }
    }
  };
  for (let i = 0; i < size; i++) {
    line((j) => modules[i][j]);
    line((j) => modules[j][i]);
  }

  // Rule 2: every 2x2 block of one colour.
  for (let r = 0; r + 1 < size; r++) {
    for (let c = 0; c + 1 < size; c++) {
      const first = modules[r][c];
      if (first === modules[r][c + 1] && first === modules[r + 1][c]
        && first === modules[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 4: how far the proportion of dark modules strays from half, in steps
  // of five percent. Written without floating point so it cannot drift.
  const total = size * size;
  const dark = modules.flat().filter(Boolean).length;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;

  return score;
}
```

- [ ] **Step 9: Write `encode`**

```js
export function encode(text) {
  const bytes = new TextEncoder().encode(text);
  const version = EC_L.findIndex((_, i) => capacity(i + 1) >= bytes.length) + 1;
  if (version === 0) {
    throw new Error(`${bytes.length} bytes is more than a version ${MAX_VERSION} QR code holds`);
  }

  const stream = interleave(codewords(bytes, version), version);
  const { modules, reserved } = functionPatterns(version);
  place(modules, reserved, stream, version);

  // Try all eight masks and keep the least offensive, which is what a decoder
  // expects and what the reference encoder does.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = modules.map((row) => [...row]);
    for (let r = 0; r < candidate.length; r++) {
      for (let c = 0; c < candidate.length; c++) {
        if (!reserved[r][c] && MASKS[mask](r, c)) candidate[r][c] = !candidate[r][c];
      }
    }
    writeFormat(candidate, mask);
    const score = penalty(candidate);
    if (best === null || score < best.score) best = { score, candidate };
  }
  return best.candidate;
}
```

- [ ] **Step 10: Run the tests until every version 1–5 fixture passes**

```sh
npm test -- qr
```

Expected: all pass. When one does not, the printed rows are the picture
`qrencode` drew beside the picture the code drew — read them, do not weaken
the test. The three usual causes, in order of likelihood: a mistyped table
entry, a mask condition with rows and columns swapped, and a penalty rule that
picks a different mask (the symbol then differs everywhere, not in one spot).

- [ ] **Step 11: Run the whole suite**

```sh
npm test
```

Expected: all files pass. Nothing else in the app has changed yet.

- [ ] **Step 12: Commit**

```sh
git add app/qr.js test/qr.test.js test/fixtures/qr.json test/fixtures/generate-qr-fixtures.mjs
git commit -m "$(cat <<'MSG'
feat: a QR encoder for versions 1-5, against qrencode fixtures

No third-party generator may ever see a token, so the app draws the code
itself. The fixtures come from qrencode and are the oracle: they are asserted
module for module, and they contain no real token.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
MSG
)"
```

---

## Task 2: `qr.js` — versions 6 to 13

Three things change above version 5: symbols carry more than one error
correction block, so the codewords interleave; version 7 and up carry an
18-bit version-information block twice; and the alignment grid grows to nine
patterns. `interleave` was already written in its general form in Task 1, so
if it is right this task is small — and if it is wrong, this is where the
fixtures say so.

**Files:**
- Modify: `app/qr.js`
- Test: `test/qr.test.js`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: the same `encode(text)`, now correct for the whole range the app can reach.

- [ ] **Step 1: Widen the test**

In `test/qr.test.js`, replace the filter and the coverage assertion:

```js
// Every fixture, versions 1 to 13.
const covered = fixtures;
```

```js
  it('covers every version it claims to', () => {
    expect([...new Set(covered.map((f) => f.version))].sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });
```

- [ ] **Step 2: Run the test and watch it fail**

```sh
npm test -- qr
```

Expected: versions 1–5 still pass; some or all of versions 6–13 fail. Note
which — if version 6 fails, interleaving is wrong; if 6 passes and 7 fails,
the version information is missing, which is the expected state at this point.

- [ ] **Step 3: Add the version information**

An 18-bit block, written twice, for version 7 and up. Add to `app/qr.js`:

```js
// 6 bits of version and a 12-bit BCH remainder, placed twice: above the
// bottom-left finder and to the left of the top-right one.
function versionBits(version) {
  let rest = version << 12;
  for (let i = 17; i >= 12; i--) if ((rest >> i) & 1) rest ^= 0x1f25 << (i - 12);
  return (version << 12) | rest;
}
```

and, at the end of `functionPatterns`, immediately before `return`:

```js
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >> i) & 1) === 1;
      const near = size - 11 + (i % 3);
      const far = Math.floor(i / 3);
      set(far, near, dark);        // the block beside the top-right finder
      set(near, far, dark);        // and its transpose, above the bottom-left
    }
  }
```

- [ ] **Step 4: Run the tests until every fixture passes**

```sh
npm test -- qr
```

Expected: all 31 fixtures pass, versions 1 to 13.

If versions 6, 10 and 12 fail while their neighbours pass, the fault is in
`interleave`: 6 is the first with two blocks, and 10 and 12 are the first with
two groups of *different* lengths. If only 7 and up fail, it is the version
information — check the bit order before assuming the BCH is wrong.

- [ ] **Step 5: Check the module against its own budget**

Add to `test/qr.test.js`:

```js
it('stays inside the size the design budgeted for it', () => {
  const source = readFileSync(new URL('../app/qr.js', import.meta.url), 'utf8');
  const code = source.split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('//'));
  expect(code.length).toBeLessThan(320);
});
```

The design calls this "250 lines of Galois-field arithmetic". A little over is
fine; twice that means something has been generalised past what the app needs.

- [ ] **Step 6: Run the whole suite**

```sh
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```sh
git add app/qr.js test/qr.test.js
git commit -m "$(cat <<'MSG'
feat: QR versions 6-13 — block interleaving and version information

Every fixture qrencode produced now passes, versions 1 through 13, which is
the whole range a setup link can need.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
MSG
)"
```

---

## Task 3: `setup.js` — the setup link, masking and expiry

Everything about a token that is not storage or network: the link the QR
encodes, reading one back, showing one safely, and the expiry arithmetic.
Pure, so it is tested; and putting it here is what keeps the adopt screen and
the settings screen thin.

**Files:**
- Create: `app/setup.js`
- Test: `test/setup.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `APP_URL: string` — `'https://cyrilpitrou.github.io/myquizzlet/'`
  - `TOKEN_PAGE: string` — `'https://github.com/settings/personal-access-tokens/new'`
  - `setupLink({ token, expiry, base }): string`
  - `parseSetup(text): { token: string, expiry: string | null } | null`
  - `maskToken(token): string`
  - `expiryWarning(expiry, today): string | null`

- [ ] **Step 1: Write the failing test**

`test/setup.test.js`. Note that every token in here is obviously fake, and
must stay that way:

```js
import { describe, it, expect } from 'vitest';
import { setupLink, parseSetup, maskToken, expiryWarning, APP_URL } from '../app/setup.js';

// Not a token. Never put a real one in a file in this repo.
const FAKE = 'github_pat_EXAMPLE_NOT_A_REAL_TOKEN_0000000000000000';

describe('setupLink', () => {
  it('builds a link the receiving device can simply open', () => {
    expect(setupLink({ token: FAKE, expiry: '2027-08-31' }))
      .toBe(`${APP_URL}#/adopt?t=${FAKE}&e=2027-08-31`);
  });

  it('leaves the expiry out when there is none', () => {
    expect(setupLink({ token: FAKE, expiry: null })).toBe(`${APP_URL}#/adopt?t=${FAKE}`);
  });

  it('escapes a token that is not URL-safe', () => {
    expect(setupLink({ token: 'a b&c', expiry: null })).toBe(`${APP_URL}#/adopt?t=a%20b%26c`);
  });
});

describe('parseSetup', () => {
  it('reads back a link it built', () => {
    expect(parseSetup(setupLink({ token: FAKE, expiry: '2027-08-31' })))
      .toEqual({ token: FAKE, expiry: '2027-08-31' });
  });

  it('reads a link with no expiry', () => {
    expect(parseSetup(`${APP_URL}#/adopt?t=${FAKE}`)).toEqual({ token: FAKE, expiry: null });
  });

  it('reads a bare fragment, which is what the address bar shows', () => {
    expect(parseSetup(`#/adopt?t=${FAKE}&e=2027-08-31`))
      .toEqual({ token: FAKE, expiry: '2027-08-31' });
  });

  it('decodes an escaped token', () => {
    expect(parseSetup('#/adopt?t=a%20b%26c')).toEqual({ token: 'a b&c', expiry: null });
  });

  it('accepts a bare token, which is what a paste usually is', () => {
    expect(parseSetup(`  ${FAKE}\n`)).toEqual({ token: FAKE, expiry: null });
  });

  it('refuses an adopt link carrying no token', () => {
    expect(parseSetup(`${APP_URL}#/adopt?e=2027-08-31`)).toBe(null);
  });

  it('refuses a URL that is not a setup link', () => {
    expect(parseSetup('https://github.com/CyrilPitrou/myquizzlet')).toBe(null);
  });

  it('refuses empty or whitespace-riddled text', () => {
    expect(parseSetup('')).toBe(null);
    expect(parseSetup('   ')).toBe(null);
    expect(parseSetup('two words')).toBe(null);
  });

  it('ignores an expiry that is not a date', () => {
    expect(parseSetup(`#/adopt?t=${FAKE}&e=soon`)).toEqual({ token: FAKE, expiry: null });
  });
});

describe('maskToken', () => {
  it('shows enough to recognise a token and not enough to use one', () => {
    const masked = maskToken(FAKE);
    expect(masked).toBe('github_pat…0000');
    expect(masked).not.toContain('NOT_A_REAL_TOKEN');
  });

  it('gives away nothing about a short string', () => {
    expect(maskToken('short')).toBe('…');
    expect(maskToken('')).toBe('…');
  });
});

describe('expiryWarning', () => {
  it('says nothing when the expiry is far off', () => {
    expect(expiryWarning('2027-08-31', '2026-09-02')).toBe(null);
  });

  it('says nothing when there is no expiry recorded', () => {
    expect(expiryWarning(null, '2026-09-02')).toBe(null);
  });

  it('warns a fortnight ahead', () => {
    expect(expiryWarning('2026-09-16', '2026-09-02'))
      .toBe('This token expires in 14 days, on 2026-09-16.');
  });

  it('counts down in the singular on the last day', () => {
    expect(expiryWarning('2026-09-03', '2026-09-02'))
      .toBe('This token expires in 1 day, on 2026-09-03.');
  });

  it('says today plainly', () => {
    expect(expiryWarning('2026-09-02', '2026-09-02')).toBe('This token expires today.');
  });

  it('states the past tense once it has lapsed', () => {
    expect(expiryWarning('2026-08-30', '2026-09-02'))
      .toBe('This token expired on 2026-08-30. Changes stay on this device until you replace it.');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```sh
npm test -- setup
```

Expected: `Failed to resolve import "../app/setup.js"`.

- [ ] **Step 3: Write the module**

```js
// app/setup.js
//
// Pure. The shape of a setup link and everything else derived from a token:
// how it is shown, and when it runs out. No storage, no network, no clock —
// today is passed in, as it is to srs.js.

export const APP_URL = 'https://cyrilpitrou.github.io/myquizzlet/';
export const TOKEN_PAGE = 'https://github.com/settings/personal-access-tokens/new';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// A URL rather than a bare secret, so the receiving phone's own camera app can
// open it. The token rides in the fragment, which no server ever sees.
export function setupLink({ token, expiry, base = APP_URL }) {
  const query = `t=${encodeURIComponent(token)}`;
  return `${base}#/adopt?${query}${expiry ? `&e=${encodeURIComponent(expiry)}` : ''}`;
}

// Accepts a whole setup link, the bare fragment of one, or a plain token —
// the settings field takes all three, because a paste is as likely as a scan.
export function parseSetup(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const hash = trimmed.indexOf('#/adopt?');
  if (hash !== -1) {
    const params = new URLSearchParams(trimmed.slice(hash + '#/adopt?'.length));
    const token = (params.get('t') || '').trim();
    if (!token) return null;
    const expiry = (params.get('e') || '').trim();
    return { token, expiry: ISO_DATE.test(expiry) ? expiry : null };
  }

  if (/\s/.test(trimmed) || trimmed.includes('://')) return null;
  return { token: trimmed, expiry: null };
}

// Enough to tell two tokens apart, not enough to use one.
export function maskToken(token) {
  return (token || '').length > 14 ? `${token.slice(0, 10)}…${token.slice(-4)}` : '…';
}

const DAY = 24 * 60 * 60 * 1000;

export function expiryWarning(expiry, today) {
  if (!expiry || !ISO_DATE.test(expiry)) return null;
  const days = Math.round(
    (Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (days > 14) return null;
  if (days < 0) {
    return `This token expired on ${expiry}. Changes stay on this device until you replace it.`;
  }
  if (days === 0) return 'This token expires today.';
  return `This token expires in ${days} day${days === 1 ? '' : 's'}, on ${expiry}.`;
}
```

- [ ] **Step 4: Run the test**

```sh
npm test -- setup
```

Expected: PASS.

- [ ] **Step 5: Check that no real token can have slipped in**

```sh
grep -rn "github_pat_" app test docs README.md | grep -v EXAMPLE_NOT_A_REAL_TOKEN | grep -v "github_pat_…"
```

Expected: no output. Every occurrence must be either the obviously-fake
fixture token or the placeholder in the settings field. If anything else
appears, stop and tell the user: a committed token must be revoked on GitHub.

- [ ] **Step 6: Run the whole suite**

```sh
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```sh
git add app/setup.js test/setup.test.js
git commit -m "$(cat <<'MSG'
feat: setup links, token masking and expiry warnings

Pure, so the fiddly half of onboarding is tested rather than trusted: the link
a QR carries, reading one back from a scan or a paste, and how long a token
has left.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
MSG
)"
```

---

## Task 4: the adopt screen

Where a scanned link lands. **It must never save silently** — a URL can arrive
by accident, and a token appearing on a device with nothing said is the
surprise this design avoids everywhere. Either answer strips the fragment
first, so the token leaves the address bar and the history before anything
else happens.

**Files:**
- Create: `app/screens/adopt.js`
- Modify: `app/main.js` (the import block and `render()`)
- Modify: `sw.js` (`SHELL` and `CACHE`)
- Modify: `app/style.css` (append)

**Interfaces:**
- Consumes: `parseSetup`, `maskToken` from `app/setup.js`; `screen`, `settings`, `saveSettings`, `go`, `ctx`, `REPO` from `app/app.js`; `el` from `app/ui.js`.
- Produces: `export function showAdopt(): void`.

- [ ] **Step 1: Write the screen**

`app/screens/adopt.js`:

```js
import { el } from '../ui.js';
import { screen, settings, saveSettings, go, ctx, REPO } from '../app.js';
import { parseSetup, maskToken } from '../setup.js';

// The token is in the fragment, which main.js has already cut the query off
// of, so read it from the address bar directly.
function answered() {
  history.replaceState(null, '', `${location.pathname}${location.search}#/adopt`);
}

export function showAdopt() {
  const view = screen();
  const found = parseSetup(location.hash);

  view.append(el('h2', { text: 'Add this device?' }));

  if (!found) {
    view.append(el('p', { text: 'That link carried no token, so there is nothing to add.' }));
    view.append(el('p', { class: 'muted',
      text: 'Scan the code again, or paste the token by hand in Settings.' }));
    view.append(el('div', { class: 'actions' }, [
      el('a', { class: 'btn primary', href: '#/settings', text: 'Open Settings',
        onclick: answered }),
    ]));
    return;
  }

  const { token, expiry } = found;
  view.append(el('p', { text: 'A link has offered this device a token for saving your changes.' }));

  view.append(el('dl', { class: 'facts' }, [
    el('dt', { text: 'Repository' }), el('dd', { text: REPO }),
    el('dt', { text: 'Token' }), el('dd', { text: maskToken(token) }),
    el('dt', { text: 'Expires' }), el('dd', { text: expiry || 'not recorded' }),
  ]));

  view.append(el('p', { class: 'warn', text: 'Both devices will then use the same token. '
    + 'Revoking it later cuts off both of them, not just one.' }));

  view.append(el('div', { class: 'actions' }, [
    el('button', {
      class: 'primary', text: 'Save it on this device',
      onclick: () => {
        answered();
        saveSettings({ ...settings(), token, tokenExpiry: expiry });
        ctx.initSync();
        go('#/settings');
      },
    }),
    el('button', {
      text: 'No thanks',
      onclick: () => {
        answered();
        go('#/');
      },
    }),
  ]));
}
```

`answered()` runs first in both handlers. That ordering is the requirement, not
a detail: the token must leave the address bar and the history before anything
else happens.

- [ ] **Step 2: Route it in `app/main.js`**

Add the import beside the others:

```js
import { showAdopt } from './screens/adopt.js';
```

and the route, in `render()`, immediately before the `settings` line:

```js
  else if (route === 'adopt') showAdopt();
```

`render()` already does `location.hash.split('?')` before splitting the path,
so `#/adopt?t=…&e=…` routes on `#/adopt` and the screen reads the query itself.

- [ ] **Step 3: Keep it working offline**

In `sw.js`, bump the cache and add all three new modules:

```js
const CACHE = 'myquizzlet-v10';
```

Add `'./app/qr.js', './app/setup.js',` to the module list and
`'./app/screens/adopt.js',` to the screens list. Every new module must be in
`SHELL` or the app breaks the moment the network is gone.

- [ ] **Step 4: Style the fact list**

Append to `app/style.css`:

```css
.facts { display: grid; grid-template-columns: auto 1fr; gap: .35rem .75rem; margin: 1rem 0; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; overflow-wrap: anywhere; }
```

No literal colour, so `test/style.test.js` stays green.

- [ ] **Step 5: Run the whole suite**

```sh
npm test
```

Expected: all pass, `style.test.js` included.

- [ ] **Step 6: Stop. Do not commit.**

Report that the task is ready for a browser check and hand over the checklist
below verbatim. Wait for confirmation before committing.

**Checklist for the user** — `python3 -m http.server 8000`, then:

1. Open `http://localhost:8000/#/adopt?t=github_pat_EXAMPLE_NOT_A_REAL_TOKEN_0000000000000000&e=2027-08-31`. The screen asks "Add this device?", names `CyrilPitrou/myquizzlet`, shows the token as `github_pat…0000` and the expiry as 2027-08-31, and warns that both devices will share the token.
2. Confirm the full token is **not** on the screen anywhere.
3. Press **No thanks**. You land on Lists, and the address bar no longer has the token in it.
4. Press the browser Back button. You do not return to a URL containing the token.
5. Open the same link again and press **Save it on this device**. You land on Settings with the token filled in, the expiry set to 2027-08-31, and the address bar clean.
6. Open Settings, clear the token field and press **Save token** — the fake token must not be left behind for the next tasks.
7. Open `http://localhost:8000/#/adopt` with no query. It says the link carried no token and offers Settings.
8. Turn Wi-Fi off, reload, and confirm the app still opens.

- [ ] **Step 7: Commit, once the user confirms**

```sh
git add app/screens/adopt.js app/main.js sw.js app/style.css
git commit -m "$(cat <<'MSG'
feat: an adopt screen, which asks before saving a token

A URL can arrive by accident, so a token that arrives by one is named, masked
and offered, never saved. Either answer strips the fragment first, so the
token leaves the address bar and the history before anything else happens.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
MSG
)"
```

---

## Task 5: "Add a device", path 1 — the two public codes

Two QR codes of public links: the app's own address, and GitHub's token page.
Neither carries a secret, so this section is always safe to show. This is the
path with the smallest blast radius, and it stays first.

**Files:**
- Modify: `app/screens/settings.js`
- Modify: `app/style.css` (append)

**Interfaces:**
- Consumes: `encode` from `app/qr.js`; `APP_URL`, `TOKEN_PAGE` from `app/setup.js`.
- Produces: within `settings.js`, local helpers `qrNode(text, label)` and `qrCard(text, caption, label)`, both returning an `HTMLElement`. Task 6 uses `qrCard`.

- [ ] **Step 1: Add the renderer**

In `app/screens/settings.js`, add to the imports:

```js
import { encode } from '../qr.js';
import { APP_URL, TOKEN_PAGE } from '../setup.js';
```

and these helpers below them:

```js
// One <rect> per dark module inside a viewBox of modules, so the browser
// scales it and nothing has to know about pixels. Deliberately black on white
// in every theme, with the four-module quiet zone the standard asks for: this
// is an image meant for a camera, not a piece of the interface, and a scanner
// pointed at a dark theme is a scanner that fails. Those two colours are set
// here rather than in the stylesheet for exactly that reason.
function qrNode(text, label) {
  const matrix = encode(text);
  const size = matrix.length;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size + 8} ${size + 8}`);
  svg.setAttribute('class', 'qr');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);

  const ground = document.createElementNS(ns, 'rect');
  ground.setAttribute('width', String(size + 8));
  ground.setAttribute('height', String(size + 8));
  ground.setAttribute('fill', '#ffffff');
  svg.append(ground);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix[row][col]) continue;
      const cell = document.createElementNS(ns, 'rect');
      cell.setAttribute('x', String(col + 4));
      cell.setAttribute('y', String(row + 4));
      cell.setAttribute('width', '1');
      cell.setAttribute('height', '1');
      cell.setAttribute('fill', '#000000');
      svg.append(cell);
    }
  }
  return svg;
}

function qrCard(text, caption, label) {
  return el('figure', { class: 'qr-card' }, [qrNode(text, label),
    el('figcaption', { class: 'muted', text: caption })]);
}
```

- [ ] **Step 2: Add the section**

In `showSettings`, immediately after the **GitHub token** section and before
**About**, add:

```js
  if (current.token) {
    view.append(section('Add a device', [
      el('p', { class: 'muted', text: 'Point the new device’s camera at these. '
        + 'Neither one carries a secret.' }),
      el('div', { class: 'qr-pair' }, [
        qrCard(APP_URL, '1. Open the app', 'A QR code of the app’s address'),
        qrCard(TOKEN_PAGE, '2. Make it a token there',
          'A QR code of GitHub’s token page'),
      ]),
      el('p', { class: 'muted', text: 'The token is then created on the device that '
        + 'will hold it, and can be revoked on its own. A device you only study on '
        + 'needs no token at all — the first code is the whole of its setup.' }),
    ]));
  }
```

Guarding on `current.token` is deliberate, and it is what the design's screen
order asks for: a device without a token already gets **Set up this device** at
the top, and asking it both questions at once would be noise.

- [ ] **Step 3: Style it**

Append to `app/style.css`:

```css
.qr-pair { display: flex; flex-wrap: wrap; gap: 1rem; margin: .75rem 0; }
.qr-card { margin: 0; flex: 1 1 8rem; max-width: 12rem; }
.qr-card figcaption { margin-top: .35rem; font-size: .85rem; }
.qr { display: block; width: 100%; height: auto; border-radius: 6px;
  image-rendering: pixelated; }
```

`image-rendering: pixelated` keeps the modules crisp when the SVG is scaled up.
There is no colour in these rules, so `test/style.test.js` stays green.

- [ ] **Step 4: Run the whole suite**

```sh
npm test
```

Expected: all pass.

- [ ] **Step 5: Stop. Do not commit.** Hand over this checklist and wait.

**Checklist for the user:**

1. Open Settings with no token saved. There is a **Set up this device** section at the top and **no** "Add a device" section.
2. Paste `not-a-real-token` into the token field and press **Save token**.
3. **Add a device** now appears below **GitHub token**, with two QR codes side by side, captioned "1. Open the app" and "2. Make it a token there".
4. Both codes are black on white, square, and sharp-edged rather than blurry.
5. Point your phone's camera at the first: it offers `cyrilpitrou.github.io/myquizzlet`.
6. Point it at the second: it offers GitHub's new-fine-grained-token page.
7. Switch the theme to Focus (the dark one) in **Appearance**. Both codes are still black on white, and still scan.
8. Narrow the window to phone width. The two codes wrap or shrink; nothing is cut off and the page does not scroll sideways.
9. Clear the token field and **Save token**. The section disappears again.

- [ ] **Step 6: Commit, once the user confirms**

```sh
git add app/screens/settings.js app/style.css
git commit -m "$(cat <<'MSG'
feat: Add a device — two QR codes of public links

The path with the smallest blast radius: the new device opens the app and
makes its own token, so that token can be revoked on its own. Both codes are
public links and neither carries a secret. Black on white in every theme,
because a code is for a camera, not for the eye.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
MSG
)"
```

---

## Task 6: "Add a device", path 2 — Show token QR

The one place in this app where a real secret goes on screen. It is opt-in,
behind an explicit button, honestly labelled, and it hides itself again after
a minute.

**Files:**
- Modify: `app/screens/settings.js`
- Modify: `app/style.css` (append)

**Interfaces:**
- Consumes: `qrCard` from Task 5; `setupLink` from `app/setup.js`; `clear` from `app/ui.js`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Extend the imports**

```js
import { el, clear } from '../ui.js';
import { APP_URL, TOKEN_PAGE, setupLink } from '../setup.js';
```

- [ ] **Step 2: Write the opt-in block**

Add this helper to `settings.js`, above `showSettings`:

```js
const SHOW_FOR = 60_000;

// The token itself, on screen, as a link the other phone's camera can open.
// Boxed off and behind a button because it is the only secret this app ever
// displays, and hidden again on a timer so it does not sit there forgotten.
function tokenQr(current) {
  const box = el('div', { class: 'optin' });

  const reveal = () => {
    const link = setupLink({ token: current.token, expiry: current.tokenExpiry || null });
    const timer = setTimeout(() => { if (box.isConnected) show(); }, SHOW_FOR);

    clear(box);
    box.append(el('h4', { text: 'Scan this on the other device' }));
    box.append(qrCard(link, 'Opens the app and asks before saving',
      'A QR code carrying this device’s token'));
    box.append(el('p', { class: 'muted', text: 'The other device will ask you to confirm '
      + 'before it saves anything. This code hides itself again in a minute.' }));
    box.append(el('button', { text: 'Hide it now',
      onclick: () => { clearTimeout(timer); show(); } }));
  };

  const show = () => {
    clear(box);
    box.append(el('h4', { text: 'Or copy this device’s token' }));
    box.append(el('p', { class: 'muted', text: 'Faster, and the honest price: both devices '
      + 'then share one token, so revoking it cuts off both. The token is briefly on '
      + 'screen, so do this where nobody is watching.' }));
    box.append(el('button', { text: 'Show token QR', onclick: reveal }));
  };

  show();
  return box;
}
```

- [ ] **Step 3: Put it in the section**

In the **Add a device** section from Task 5, append `tokenQr(current)` as the
last node, after the closing paragraph:

```js
      el('p', { class: 'muted', text: 'The token is then created on the device that '
        + 'will hold it, and can be revoked on its own. A device you only study on '
        + 'needs no token at all — the first code is the whole of its setup.' }),
      tokenQr(current),
    ]));
```

- [ ] **Step 4: Style the box**

Append to `app/style.css`:

```css
.optin { border: 1px dashed var(--rule); border-radius: 10px;
  padding: .75rem; margin-top: 1rem; }
.optin h4 { margin: 0 0 .35rem; }
.optin .qr-card { max-width: 14rem; }
```

- [ ] **Step 5: Run the whole suite**

```sh
npm test
```

Expected: all pass.

- [ ] **Step 6: Stop. Do not commit.** Hand over this checklist and wait.

**Checklist for the user.** Use a throwaway string as the token for steps 1–7;
a real one is only needed for the optional end-to-end run.

1. In Settings, save `not-a-real-token` as the token and set an expiry a year out.
2. **Add a device** now ends with a dashed box: "Or copy this device's token", a paragraph saying both devices then share one token and that it is briefly on screen, and a **Show token QR** button.
3. No code is visible until you press that button.
4. Press it. A code appears, captioned "Opens the app and asks before saving", plus a **Hide it now** button.
5. Press **Hide it now**. The code goes away and the button comes back.
6. Press **Show token QR** again and leave the page alone for a minute. The code disappears on its own.
7. Show it again and point your phone's camera at it. It offers a `cyrilpitrou.github.io` link. **Do not open it on the phone yet** — this token is fake.
8. Optional, and the real end-to-end run: save your **actual** token, show the code, and scan it with the phone. The phone opens the adopt screen, names the repository, shows the token masked, and asks. Accept it, and the phone's sync dot turns to ●.
9. Whatever you did in step 8, finish by clearing the token field on any device you did not mean to leave a token on.

- [ ] **Step 7: Commit, once the user confirms**

```sh
git add app/screens/settings.js app/style.css
git commit -m "$(cat <<'MSG'
feat: Show token QR, opt-in and on a timer

Making a fine-grained token on a phone means working a desktop form on a
phone, every time. This is the shortcut, with its price stated where it is
taken: one token on two devices, briefly on screen. Behind a button, boxed
off, and hidden again after a minute.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
MSG
)"
```

---

## Task 7: a pasted link in the token field, and the expiry warning

Two smaller things the design asks for. The token field accepts a setup link
as well as a bare token, which is the fallback when there is no camera to
hand; and an expiry is warned about a fortnight ahead, so a lapse is a
reminder rather than a discovery mid-session.

**Files:**
- Modify: `app/screens/settings.js`
- Modify: `app/screens/lists.js`

**Interfaces:**
- Consumes: `parseSetup`, `expiryWarning` from `app/setup.js`; `todayStr` from `app/app.js`.
- Produces: nothing.

- [ ] **Step 1: Read the two files you are changing**

`app/screens/settings.js` — the **GitHub token** section — and
`app/screens/lists.js` in full. Keep to the shapes already there.
`lists.js` already imports `settings` and `todayStr` from `../app.js`; only
`expiryWarning` is new to it.

- [ ] **Step 2: Extend the imports in `settings.js`**

```js
import { store, settings, saveSettings, REPO, screen, ctx, todayStr } from '../app.js';
import { APP_URL, TOKEN_PAGE, setupLink, parseSetup, expiryWarning } from '../setup.js';
```

- [ ] **Step 3: Rewrite the token section**

Replace the whole **GitHub token** section with this. It takes either form,
refuses to save something that is neither, and shows the expiry warning where
the expiry is edited:

```js
  const token = el('input', { type: 'password', value: current.token || '',
    placeholder: 'github_pat_… or a setup link' });
  const expiry = el('input', { type: 'date', value: current.tokenExpiry || '' });
  const problem = el('p', { class: 'muted' });
  const warning = expiryWarning(current.tokenExpiry, todayStr());

  view.append(section('GitHub token', [
    el('p', { class: 'muted', text: 'Needed only to save changes. Studying works without one.' }),
    ...(warning ? [el('p', { class: 'warn', text: warning })] : []),
    el('label', { class: 'field' }, ['Token, or a setup link from another device', token]),
    el('label', { class: 'field' }, ['Expires on (from the GitHub page)', expiry]),
    problem,
    el('button', {
      class: 'primary', text: 'Save token',
      onclick: () => {
        const typed = token.value.trim();
        if (!typed) {
          saveSettings({ ...settings(), token: '', tokenExpiry: null });
        } else {
          const found = parseSetup(typed);
          if (!found) {
            problem.textContent = 'That is neither a token nor a setup link.';
            return;
          }
          saveSettings({ ...settings(), token: found.token,
            tokenExpiry: found.expiry || expiry.value || null });
        }
        ctx.initSync();
        ctx.render();
      },
    }),
  ]));
```

`problem` is always in the DOM — it is empty until something goes wrong. It is
a separate node from the warning on purpose: they can both be showing at once,
and an error that has nowhere to appear is an error the user never sees.

Note the precedence: an expiry carried by a pasted link wins over whatever is
in the date field, because the link knows and the field is a leftover.

- [ ] **Step 4: Warn on Home too**

In `app/screens/lists.js`, add to the imports:

```js
import { expiryWarning } from '../setup.js';
```

Then, as the first thing appended to the view — before the heading, so it
cannot be missed:

```js
  const expiring = expiryWarning(settings().tokenExpiry, todayStr());
  if (expiring) {
    view.append(el('p', { class: 'warn' }, [`${expiring} `,
      el('a', { href: '#/settings', text: 'Replace it' })]));
  }
```

Home and Settings are the two places this belongs. It stays off the study
screens on purpose: a banner in the middle of a session is exactly the
interruption the design is trying to avoid.

- [ ] **Step 5: Run the whole suite**

```sh
npm test
```

Expected: all pass.

- [ ] **Step 6: Stop. Do not commit.** Hand over this checklist and wait.

**Checklist for the user:**

1. In Settings, clear the token and press **Save token**. The sync dot becomes ⊘ and the app is read-only.
2. Paste `https://cyrilpitrou.github.io/myquizzlet/#/adopt?t=not-a-real-token&e=2026-09-10` into the token field and press **Save token**. The field keeps a token and the expiry date becomes 2026-09-10. (Use a date within a fortnight of today if today has moved past that one.)
3. A warning now sits in the token section: "This token expires in N days, on 2026-09-10."
4. Go to **Lists**. The same warning is at the top of the page, with a **Replace it** link that takes you to Settings.
5. Set the expiry to a date a year out and **Save token**. Both warnings go away.
6. Set the expiry to yesterday and **Save token**. Both places now read "This token expired on …".
7. Type `two words` into the token field and press **Save token**. It refuses, says so on the screen, and the saved token is unchanged.
8. Clear the field and **Save token**. Both warnings go, the dot is ⊘, and nothing is left saved.

- [ ] **Step 7: Commit, once the user confirms**

```sh
git add app/screens/settings.js app/screens/lists.js
git commit -m "$(cat <<'MSG'
feat: the token field takes a setup link, and expiry is warned about

Pasting the link is the fallback when there is no camera to hand, so the field
takes either form. Fine-grained tokens last a year at most, so the app says so
a fortnight ahead, on Home and in Settings — never mid-session.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
MSG
)"
```

---

## Task 8: the documentation, and the last look over the whole feature

**Files:**
- Modify: `README.md` (the token section, around lines 40–90)
- Modify: `docs/architecture.md` (the module list)
- Modify: `docs/sync.md` (the token section)
- Modify: `app/screens/help.js`

- [ ] **Step 1: Read all four files** before writing a word, and match each one's voice. The README speaks to a person setting the app up; `docs/` explains the machinery; `help.js` is in-app and short.

- [ ] **Step 2: README — the token section**

Keep the existing walk-through of making a token on GitHub; it is path 1 and
it stays first. After it, add:

```markdown
### Adding a second device

**The safe way.** On a device that already works, open **Settings → Add a
device**. It shows two QR codes: point the new phone's camera at the first to
open the app, and at the second to reach GitHub's token page, where the phone
makes its own token. That token belongs to that phone and can be revoked on
its own.

A device you only ever study on needs no token at all — the first code is the
whole of its setup.

**The quick way, if you accept the price.** The same section has an opt-in
**Show token QR** button. It draws a link carrying this device's token; the
other phone's camera opens it, and the app asks before saving anything. Two
things to know before you use it: both devices then share one token, so
revoking it cuts off both, and the token is briefly on screen, so do it where
nobody is looking. The code hides itself again after a minute.

The app draws these codes itself and sends nothing to a QR service — a token
must never be handed to one. It reads no codes: your phone's own camera app
opens the link, so the app asks for no camera permission.

No camera to hand? The token field also accepts the whole setup link, pasted.
```

- [ ] **Step 3: README — expiry**

The README already says the app records the expiry date. Extend that sentence
so it says what the app now does with it: it warns on Home and in Settings for
the last fortnight, and once the date passes it says so and keeps your changes
on the device until you replace the token.

- [ ] **Step 4: `docs/architecture.md` — the module list**

Add two entries in the style of the ones already there:

```markdown
- `qr.js` — pure. `encode(text) -> boolean[][]`, a QR matrix: byte mode, error
  correction level L, versions 1–13. It exists because no third-party
  generator may ever see a token and the payload is dynamic, so a committed
  image cannot serve. Tested module for module against fixtures from
  `qrencode`; see `test/fixtures/generate-qr-fixtures.mjs`.
- `setup.js` — pure. The setup link and everything else derived from a token:
  building the link a QR carries, reading one back from a scan or a paste,
  masking a token for display, and how long one has left.
```

Add the adopt screen to whatever list of screens that file keeps.

- [ ] **Step 5: `docs/sync.md` — the token section**

Add a short paragraph after the existing one: a second device gets its token
either by making its own (two public QR codes, nothing secret) or by adopting
this one's over a link, which lands on `#/adopt` and is saved only if the
person there says yes. Say plainly that a shared token means revoking it cuts
off both devices, and that a fragment never reaches a server, so the token is
not sent to GitHub Pages by this route.

- [ ] **Step 6: `app/screens/help.js`**

Add one section, in the file's existing `section`/`p`/`b` style, near the end:

```js
  view.append(section('Adding another device', [
    p(['Settings → ', b('Add a device'), ' shows two codes. Point the new phone at '
      + 'the first to open the app, and at the second to make it a token of its own. '
      + 'That is the safe route: the new token can be revoked on its own.']),
    p(['The ', b('Show token QR'), ' button below them is the shortcut — it hands this '
      + 'device’s token over instead. Both devices then share one token, so revoking '
      + 'it cuts off both, and the code is on screen while you scan it. The other '
      + 'device always asks before it saves anything.']),
    p(['A device you only study on needs no token at all.']),
  ]));
```

- [ ] **Step 7: Run the whole suite**

```sh
npm test
```

Expected: all pass.

- [ ] **Step 8: Check the whole branch for a leaked token, one last time**

```sh
git diff main --stat
grep -rn "github_pat_" app test docs README.md | grep -v EXAMPLE_NOT_A_REAL_TOKEN | grep -v "github_pat_…"
```

Expected: the second command prints nothing. If it prints anything, stop and
tell the user immediately — a committed token must be revoked on GitHub.

- [ ] **Step 9: Check the constraints held**

```sh
grep -n "CACHE\|qr.js\|setup.js\|adopt.js" sw.js
```

Expected: `myquizzlet-v10`, and all three new modules in `SHELL`.

Then read the diff of `app/` and confirm by eye: no bundler, no framework, no
CDN `<script>`, nothing added to `package.json`'s runtime, no code asking for
`getUserMedia`, and no QR decoder.

- [ ] **Step 10: Stop. Do not commit.** Hand over this final checklist and wait.

**Checklist for the user:**

1. Open **Help**. The new "Adding another device" section reads correctly and says the other device always asks.
2. Read the new README section. It matches what the app actually does.
3. With a token saved, walk the whole thing once more: Settings → Add a device → scan the first code on your phone → the app opens. Then **Show token QR** → scan → the phone asks → accept → the phone's dot goes ●.
4. On the phone, open Settings and confirm the token is there and masked in the field.
5. Turn Wi-Fi off on the laptop, reload, and confirm the app still opens and Settings still draws both codes.

- [ ] **Step 11: Commit, once the user confirms**

```sh
git add README.md docs/architecture.md docs/sync.md app/screens/help.js
git commit -m "$(cat <<'MSG'
docs: how a second device gets in, and what each route costs

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
MSG
)"
```

---

## Self-review against the spec

Each requirement in the Auth section of the design, and where it lands:

| Requirement | Task |
|---|---|
| `qr.js`, pure, `encode(text) -> boolean[][]`, byte mode, level L, versions 1–13 | 1, 2 |
| Fixtures generated with `qrencode`, asserted module for module | fixtures in the tree; asserted in 1 and 2 |
| Path 1: two QR codes of public links, no secret | 5 |
| Path 2: opt-in, behind an explicit button, hides after a minute | 6 |
| The link is `<app>/#/adopt?t=<token>&e=<expiry>` | 3 |
| The adopt screen names repository, masked token and expiry | 4 |
| It states that both devices will share one token | 4 |
| It never saves silently | 4 |
| Either answer strips the fragment with `history.replaceState` first | 4 |
| No QR decoder, no camera permission | held throughout; checked in 8 |
| The token field also accepts a pasted setup link | 7 |
| Expiry stored beside the token, warned about a fortnight ahead | 3, 7 |
| Settings ordering: Set up this device / Appearance / Sync / GitHub token / Add a device / About | 5 |
| Every new module in `SHELL`, cache bumped | 4 |
| No token in any file in this repo | checked in 3 and 8 |
