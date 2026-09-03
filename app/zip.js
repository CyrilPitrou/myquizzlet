// app/zip.js
//
// Pure. A minimal zip writer: `zip(files) -> Uint8Array`.
//
// Entries are STORED, never deflated. The app has no runtime dependencies and
// no build step, so the alternative to ~70 lines here is a library, and a
// library is not on offer. Compression is the part that would cost real code;
// leaving it out costs only size, and the payload is a few kilobytes of CSV.
//
// Deliberately not implemented, because nothing here needs it: deflate, zip64,
// directory entries, timestamps beyond a fixed one, and reading.

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;

// Bit 11 says the name is UTF-8, which is the only way an accented list title
// survives into a reader.
const UTF8 = 0x800;

// Zip stores a DOS timestamp, and there is no clock in a pure module. Every
// entry therefore gets the same fixed date — 1980-01-01, the epoch of the
// format itself, which readers render without complaint.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c >>> 0;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A growable little-endian byte sink. Zip is little-endian throughout.
function writer() {
  let bytes = [];
  return {
    u16(value) { bytes.push(value & 0xff, (value >>> 8) & 0xff); },
    u32(value) {
      bytes.push(value & 0xff, (value >>> 8) & 0xff,
        (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    },
    raw(chunk) { for (const byte of chunk) bytes.push(byte); },
    get length() { return bytes.length; },
    done() { return new Uint8Array(bytes); },
  };
}

// A list title is not a file name: it can hold a slash, a colon, or nothing at
// all. Everything Windows, macOS or a zip reader would object to becomes a
// dash, runs collapse, and the result is capped well under any file system's
// limit — with room left for the ".csv" the caller appends.
export function safeName(title) {
  const cleaned = String(title || '')
    .replace(/[/\\:*?"<>|]+|[\u0000-\u001f]+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .slice(0, 80)
    .replace(/[-. ]+$/, '');
  return cleaned || 'list';
}

// Two lists may share a title, and two entries of the same name in one zip is
// a broken archive. A repeat therefore carries its own id, which is stable, so
// a list keeps the same entry name from one export to the next.
//
// items: [{ title, id }] -> [string], one name per item, in the same order.
export function entryNames(items, extension = '.csv') {
  const used = new Set();
  return items.map(({ title, id }) => {
    const base = safeName(title);
    const name = used.has(base) ? `${base} (${id})` : base;
    used.add(name);
    return `${name}${extension}`;
  });
}

// files: [{ name, text }] — `name` is the full entry name, `.csv` and all.
export function zip(files) {
  const encoder = new TextEncoder();
  const out = writer();
  const central = [];

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const at = out.length;

    out.u32(LOCAL);
    out.u16(20);              // version needed: 2.0
    out.u16(UTF8);
    out.u16(0);               // method 0, stored
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(crc);
    out.u32(data.length);     // compressed size — stored, so the same
    out.u32(data.length);
    out.u16(name.length);
    out.u16(0);               // extra field length
    out.raw(name);
    out.raw(data);

    central.push({ name, crc, size: data.length, at });
  }

  const directoryAt = out.length;
  for (const entry of central) {
    out.u32(CENTRAL);
    out.u16(20);              // version made by
    out.u16(20);              // version needed
    out.u16(UTF8);
    out.u16(0);               // method 0, stored
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(entry.crc);
    out.u32(entry.size);
    out.u32(entry.size);
    out.u16(entry.name.length);
    out.u16(0);               // extra field length
    out.u16(0);               // comment length
    out.u16(0);               // disk number
    out.u16(0);               // internal attributes
    out.u32(0);               // external attributes
    out.u32(entry.at);
    out.raw(entry.name);
  }

  const directorySize = out.length - directoryAt;

  out.u32(END);
  out.u16(0);                 // this disk
  out.u16(0);                 // disk the directory starts on
  out.u16(central.length);
  out.u16(central.length);
  out.u32(directorySize);
  out.u32(directoryAt);
  out.u16(0);                 // comment length
  return out.done();
}
