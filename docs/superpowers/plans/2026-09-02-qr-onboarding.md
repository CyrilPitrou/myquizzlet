# QR encoder — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `app/qr.js` — a pure module that turns a string into a QR matrix — verified module for module against reference matrices produced by `qrencode`.

**Architecture:** One file, no dependencies, no I/O. `encode(text) -> boolean[][]`, byte mode, error correction level L, versions 1–13. It exists because no third-party generator may ever see a token and the payload is dynamic, so a committed image cannot serve. The fixtures are the whole safety net: 250 lines of Galois-field arithmetic are only safe to own because a reference encoder says, matrix by matrix, that they are right.

**Tech Stack:** Hand-written ES module, no build step. Vitest. `qrencode` 4.1.1 — development only, and only to regenerate fixtures that are already committed.

**Spec:** `devnotes/2026-09-01-myquizzlet-design.md`, the **Auth** section — binding, and in particular the paragraph "Why the app draws the code itself". Scheduled by `docs/superpowers/specs/2026-09-02-app-reorganisation-design.md` §10. Standing constraints in `CLAUDE.md`.

**Scope.** This plan is the encoder and nothing else. The rest of QR onboarding — `setup.js`, the adopt screen, the "Add a device" settings section, the expiry warning — is deliberately not here and gets its own plan once this module exists and is trusted.

---

## Global Constraints

- **No build step, no framework, no CDN script, no new runtime dependency.** `npm` exists only to run tests. The deployed app has zero runtime dependencies.
- **Never write a token into a file in this repo.** Not in a fixture, not in a test, not in a doc, not in an example. The one token-shaped string in the fixtures is deliberately fake and says so in its own text. If a real one is ever committed it must be revoked on GitHub immediately.
- **`qr.js` is pure**: no DOM, no storage, no network, no clock. It returns a matrix; drawing one is somebody else's job, in a later plan.
- **Written test-first**, against the committed fixtures. `qrencode` produced them on the developer's machine; no model invented a single module.
- **The app contains no QR decoder** and will never request a camera permission. Nothing in this plan reads a code.
- **Every new module goes into `SHELL` in `sw.js` and the cache name is bumped** — Task 2, Step 5.
- **Every commit message ends with these two lines:**

  ```
  Cyril Pitrou
  Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
  ```

- Nothing in this plan has a visual or interactive result, so there is no browser checklist. `npm test` is the whole verification.

## Three roads that are closed

Not this module's business, but named so nobody wanders off into them while thinking about onboarding. Each was considered and rejected in the design:

- **A short pairing code.** Needs a server to broker the exchange. There is no server and there will not be one.
- **An encrypted blob on the `data` branch.** Makes a public, offline-brute-forceable file out of a token.
- **GitHub's OAuth device flow.** The code-for-token endpoint sends no CORS headers, and adding a proxy violates the no-cost, no-maintenance constraint.

## File structure

| File | Status | Responsibility |
|---|---|---|
| `test/fixtures/qr.json` | already committed | 31 reference matrices from `qrencode`, versions 1–13 |
| `test/fixtures/generate-qr-fixtures.mjs` | already committed | regenerates the above; documents exactly how |
| `app/qr.js` | create (Tasks 1–2) | pure. `encode(text) -> boolean[][]` |
| `test/qr.test.js` | create (Tasks 1–2) | fixture assertions, module for module |
| `sw.js` | modify (Task 2) | `qr.js` in `SHELL`, cache bumped to v10 |

The split between the two tasks is where the reviewer's gate belongs: Task 1 is the whole encoder for single-block symbols — bit stream, Galois field, Reed–Solomon, function patterns, zigzag, eight masks, penalty score — and Task 2 is what changes above version 5. If Task 1 is right, Task 2 is small; if Task 1's `interleave` is wrong, Task 2 is where the fixtures say so.

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
  expect(code.length).toBeLessThan(300);
});
```

The design calls this "250 lines of Galois-field arithmetic". A little over is
fine; twice that means something has been generalised past what the app needs.

- [ ] **Step 6: Keep the module working offline**

`CLAUDE.md`: every new module goes into `SHELL` in `sw.js` and the cache name
is bumped, or it is never cached and the app breaks offline the moment the
network is gone. Nothing imports `qr.js` yet, but the rule is kept where the
module is created rather than remembered later.

In `sw.js`, change the cache name and add the module to the list beside the
other pure ones:

```js
const CACHE = 'myquizzlet-v10';
```

```js
  './app/grade.js', './app/csv.js', './app/merge.js', './app/qr.js',
```

- [ ] **Step 7: Check that no token has slipped in**

```sh
grep -rn "github_pat_" app test | grep -v EXAMPLE_NOT_A_REAL_TOKEN
```

Expected: no output. The only token-shaped string in the tree is the
obviously-fake one inside a fixture payload. If anything else appears, stop and
tell the user: a committed token must be revoked on GitHub immediately.

- [ ] **Step 8: Run the whole suite**

```sh
npm test
```

Expected: all pass — `qr.test.js` and every test that was already there.

- [ ] **Step 9: Commit**

```sh
git add app/qr.js test/qr.test.js sw.js
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


## Self-review against the spec

Every claim the design's Auth section makes about `qr.js`, and where it lands:

| Requirement | Task |
|---|---|
| Pure, `encode(text) -> boolean[][]` | 1 |
| Byte mode | 1, Step 5 |
| Error correction level L | 1, Steps 3 and 8 |
| Versions 1–13 | 1 (1–5), 2 (6–13) |
| Fixtures generated with `qrencode`, asserted module for module | committed; asserted in 1 and 2 |
| Short and long payloads, and each version boundary the app can reach | the fixture set: every version 1–13 filled to capacity, and one byte past each |
| "~250 lines of Galois-field arithmetic" — sized, not generalised | 2, Step 5 |
| No token in any file in this repo | 2, Step 7 |
| Every new module in `SHELL`, cache bumped | 2, Step 6 |

Out of scope by design, and named here so a reader does not go looking: nothing
in this plan draws a matrix, builds a link, reads a code, or touches Settings.
