function findDelimiter(line) {
  // Scan for delimiters only outside quoted fields, in preference order: tab,
  // semicolon, comma. This mirrors splitLine's quote handling exactly so the
  // two functions cannot drift apart and cause delimiters inside quotes to
  // incorrectly influence the choice. A quoted character — including tab,
  // semicolon, and comma — must never vote.
  let quoted = false;
  let foundSemicolon = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { i++; } // Skip escaped quote
      else if (c === '"') quoted = false;
    } else if (c === '"') {
      quoted = true;
    } else if (c === '\t') {
      return '\t'; // Tab has highest priority, return immediately
    } else if (c === ';' && !foundSemicolon) {
      foundSemicolon = true; // Note that we found a semicolon, keep scanning for tab
    }
  }
  return foundSemicolon ? ';' : ','; // Return semicolon if found, else comma
}

function splitLine(line, delimiter) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      fields.push(field); field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields.map((f) => unescapeBreaks(f).trim());
}

// The second way to write a line break, for text typed by hand: a literal
// backslash-n, so one card can stay on one line. Unescaping before trimming
// is what makes the rule the same as the card editor's — blank ends dropped,
// breaks inside kept. A field holding a real backslash-n as text would be
// changed by this; a vocabulary card never does.
function unescapeBreaks(field) {
  return field.replace(/\\n/g, '\n');
}

// Records, not lines: a newline between quotes belongs to its field, so a card
// side may be several lines — the six forms of a tense. Splitting the text on
// newlines first, as this used to, made such a card unreadable, including one
// this module had itself exported: toCsv already quotes a field containing a
// newline. Each record remembers the physical line it started on, because that
// is the number the import dialog shows.
//
// An unterminated quote is reported rather than silently swallowing the rest
// of the file into one card, which is the one bad failure this format has.
function splitRecords(text) {
  const records = [];
  let current = '';
  let line = 1;
  let start = 1;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') { current += '""'; i++; }
    else if (c === '"') { quoted = !quoted; current += c; }
    else if (c === '\n' && !quoted) { records.push({ text: current, line: start }); current = ''; start = ++line; }
    else { if (c === '\n') line++; current += c; }
  }
  records.push({ text: current, line: start });
  return { records, unterminated: quoted };
}

// One record, carrying its own delimiter choice — tab first (it can't appear
// naturally in prose text), then semicolon, else comma. Returns null for a
// blank record (nothing to show, nothing to report), otherwise always a
// { front, back, error } row: even a record that fails to parse gets *some*
// front/back text, because the import dialog needs a row to make it editable.
function parseRecord(record, unterminated = false) {
  const trimmed = record.trim();
  if (trimmed === '') return null;
  if (unterminated) return { front: trimmed, back: '', error: 'unterminated quote' };
  const delimiter = findDelimiter(trimmed);
  const fields = splitLine(trimmed, delimiter);
  if (fields.length < 2) return { front: trimmed, back: '', error: 'no separator found' };
  const front = fields[0];
  const back = fields.slice(1).join(delimiter);
  if (front === '' || back === '') return { front, back, error: 'empty side' };
  return { front, back, error: null };
}

// Both entry points read the same rows; they differ only in what they keep.
// CRLF is normalised once, here, so no later step has to know about it — a
// \r\n inside a quoted field is a line break like any other.
function rows(text) {
  const { records, unterminated } = splitRecords(String(text).replace(/\r\n/g, '\n'));
  return records.map((record, index) => {
    const last = index === records.length - 1;
    const parsed = parseRecord(record.text, unterminated && last);
    return parsed && { ...parsed, line: record.line };
  }).filter((row) => row);
}

export function parseCards(text) {
  const cards = [];
  const errors = [];
  for (const row of rows(text)) {
    if (row.error) errors.push({ line: row.line, reason: row.error });
    else cards.push({ front: row.front, back: row.back });
  }
  return { cards, errors };
}

// Same parse as parseCards, but keeps every non-blank record — including the
// failed ones — in original order, for an editable preview.
export function previewRows(text) {
  return rows(text).map(({ front, back, error }) => ({ front, back, error }));
}

function quote(value) {
  return /[",;\n\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(cards) {
  return cards.map((c) => `${quote(c.front)},${quote(c.back)}`).join('\n');
}
