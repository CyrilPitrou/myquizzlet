// Regenerates test/fixtures/qr.json from the reference encoder.
//
//   qrencode 4.1.1   (port install qrencode / brew install qrencode)
//   node test/fixtures/generate-qr-fixtures.mjs
//
// Every fixture is byte mode (-8), error correction level L, no quiet zone
// (-m 0), and the version qrencode itself chose. The matrix is read back from
// its ASCII rendering, where a dark module is "##" and a light one two spaces.
//
// NOTHING IN HERE IS A SECRET. The adopt payload carries an obviously fake
// token; a real one must never be written into a file in this repo.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const FAKE_TOKEN = 'github_pat_EXAMPLE_NOT_A_REAL_TOKEN_0000000000000000';

// Byte-mode capacity at level L, versions 1-13. Each is the largest payload
// that still fits, so it pins the boundary the next version starts at.
const CAPACITY_L = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.';
const filler = (n) => Array.from({ length: n }, (_, i) => ALPHABET[i % ALPHABET.length]).join('');

function encode(text) {
  const run = spawnSync('qrencode', ['-8', '-l', 'L', '-m', '0', '-t', 'ASCII', '-o', '-', text],
                        { encoding: 'utf8', maxBuffer: 1 << 24 });
  if (run.status !== 0) throw new Error(`qrencode failed: ${run.stderr}`);
  const rows = run.stdout.split('\n').filter((line) => line.length > 0)
    .map((line) => line.match(/.{2}/g).map((cell) => (cell === '##' ? '1' : '0')).join(''));
  const size = rows.length;
  if (rows.some((row) => row.length !== size)) throw new Error('non-square matrix');
  return { version: (size - 17) / 4, size, rows };
}

const cases = [
  ['a short payload', 'MyQuizzlet'],
  ['the app’s own address', 'https://cyrilpitrou.github.io/myquizzlet/'],
  ['GitHub’s token page', 'https://github.com/settings/personal-access-tokens/new'],
  ['an adopt link (fake token)',
   `https://cyrilpitrou.github.io/myquizzlet/#/adopt?t=${FAKE_TOKEN}&e=2027-08-31`],
  ['non-ASCII, encoded as UTF-8 bytes', 'Café — naïve façade · 日本語'],
  ['a single character', 'x'],
];

for (const [i, capacity] of CAPACITY_L.entries()) {
  cases.push([`version ${i + 1} filled to capacity (${capacity} bytes)`, filler(capacity)]);
  if (i + 1 < CAPACITY_L.length) {
    cases.push([`one byte past version ${i + 1} (${capacity + 1} bytes)`, filler(capacity + 1)]);
  }
}

const fixtures = cases.map(([name, text]) => ({ name, text, ...encode(text) }));

const byVersion = [...new Set(fixtures.map((f) => f.version))].sort((a, b) => a - b);
if (byVersion.some((v) => v > 13)) throw new Error(`a fixture exceeded version 13: ${byVersion}`);

writeFileSync(new URL('./qr.json', import.meta.url),
  `${JSON.stringify({
    generator: 'qrencode 4.1.1, byte mode, level L, no quiet zone',
    note: 'Regenerate with test/fixtures/generate-qr-fixtures.mjs. Contains no real token.',
    fixtures,
  }, null, 1)}\n`);

console.log(`${fixtures.length} fixtures, versions ${byVersion.join(' ')}`);
