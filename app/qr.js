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

const dataCodewords = (version) => EC_L[version - 1].blocks
  .reduce((total, [count, data]) => total + count * data, 0);

const blockCount = (version) => EC_L[version - 1].blocks
  .reduce((total, [count]) => total + count, 0);

// 4 bits of mode plus the character count indicator: 8 bits up to version 9,
// 16 from version 10.
const countBits = (version) => (version <= 9 ? 8 : 16);

const capacity = (version) =>
  Math.floor((dataCodewords(version) * 8 - 4 - countBits(version)) / 8);

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

  return { size, modules, reserved };
}

// 6 bits of version and a 12-bit BCH remainder, placed twice: above the
// bottom-left finder and to the left of the top-right one.
function versionBits(version) {
  let rest = version << 12;
  for (let i = 17; i >= 12; i--) if ((rest >> i) & 1) rest ^= 0x1f25 << (i - 12);
  return (version << 12) | rest;
}

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

// Run lengths of a row or column, alternating colour. If it starts dark,
// index 0 is a -1 sentinel and the first real run is at index 1; either way
// every dark run then falls on an odd index, which the rule 3 check below
// relies on. Matches qrencode's Mask_calcRunLengthH/V.
function runLengths(get, size) {
  const runs = [];
  let head = 0;
  if (get(0)) { runs[0] = -1; head = 1; }
  runs[head] = 1;
  let prev = get(0);
  for (let i = 1; i < size; i++) {
    const here = get(i);
    if (here !== prev) { head += 1; runs[head] = 1; prev = here; }
    else runs[head] += 1;
  }
  return runs;
}

// Rule 1: a run of five or more of one colour, worth 3 plus one per module
// past the fifth.
// Rule 3: a dark run three times some unit, flanked on both sides by a
// light run and a dark run of that unit, with a light run of at least four
// units just before or after the whole five-run group — the 1:1:3:1:1
// finder-like pattern, at any scale, not just one module wide. This is
// qrencode's actual Mask_calcN1N3, not the naive fixed-width bit-pattern
// search a literal reading of the spec suggests; the naive search misses
// scaled patterns and picks a different mask on some inputs.
function runPenalty(runs) {
  let score = 0;
  const length = runs.length;
  for (let i = 0; i < length; i++) {
    if (runs[i] >= 5) score += 3 + (runs[i] - 5);
    if (i % 2 === 1 && i >= 3 && i < length - 2 && runs[i] % 3 === 0) {
      const fact = runs[i] / 3;
      if (runs[i - 2] === fact && runs[i - 1] === fact
        && runs[i + 1] === fact && runs[i + 2] === fact) {
        if (i === 3 || runs[i - 3] >= 4 * fact) score += 40;
        else if (i + 4 >= length || runs[i + 3] >= 4 * fact) score += 40;
      }
    }
  }
  return score;
}

function penalty(modules) {
  const size = modules.length;
  let score = 0;

  for (let i = 0; i < size; i++) {
    score += runPenalty(runLengths((j) => modules[i][j], size));
    score += runPenalty(runLengths((j) => modules[j][i], size));
  }

  // Rule 2: every 2x2 block of one colour.
  for (let r = 0; r + 1 < size; r++) {
    for (let c = 0; c + 1 < size; c++) {
      const first = modules[r][c];
      if (first === modules[r][c + 1] && first === modules[r + 1][c]
        && first === modules[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 4: how far the proportion of dark modules strays from half, in
  // steps of five percent. The percentage is rounded to the nearest whole
  // point via two truncating integer divisions, matching qrencode's
  // ((200 * blacks + total) / total) / 2 rather than a single floating
  // point round.
  const total = size * size;
  const dark = modules.flat().filter(Boolean).length;
  const percent = Math.floor(Math.floor((200 * dark + total) / total) / 2);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

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
