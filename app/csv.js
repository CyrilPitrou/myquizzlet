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
  return fields.map((f) => f.trim());
}

// One line, still carrying its own delimiter choice — tab first (it can't
// appear naturally in prose text), then semicolon, else comma. Returns null
// for a blank line (nothing to show, nothing to report), otherwise always a
// { front, back, error } row: even a line that fails to parse gets *some*
// front/back text, because the import dialog needs a row to make it editable.
function parseLine(line) {
  const trimmed = line.trim();
  if (trimmed === '') return null;
  const delimiter = trimmed.includes('\t') ? '\t' : trimmed.includes(';') ? ';' : ',';
  const fields = splitLine(trimmed, delimiter);
  if (fields.length < 2) return { front: trimmed, back: '', error: 'no separator found' };
  const front = fields[0];
  const back = fields.slice(1).join(delimiter);
  if (front === '' || back === '') return { front, back, error: 'empty side' };
  return { front, back, error: null };
}

export function parseCards(text) {
  const cards = [];
  const errors = [];
  String(text).split(/\r?\n/).forEach((raw, index) => {
    const parsed = parseLine(raw);
    if (!parsed) return;
    if (parsed.error) errors.push({ line: index + 1, reason: parsed.error });
    else cards.push({ front: parsed.front, back: parsed.back });
  });
  return { cards, errors };
}

// Same per-line parse as parseCards, but keeps every non-blank line — including
// the failed ones — in original order, for an editable preview.
export function previewRows(text) {
  return String(text).split(/\r?\n/).map(parseLine).filter((row) => row !== null);
}

function quote(value) {
  return /[",\n\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(cards) {
  return cards.map((c) => `${quote(c.front)},${quote(c.back)}`).join('\n');
}
