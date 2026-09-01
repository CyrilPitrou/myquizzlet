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

export function parseCards(text) {
  const cards = [];
  const errors = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    const delimiter = line.includes('\t') ? '\t' : ',';
    const fields = splitLine(line, delimiter);
    if (fields.length < 2) {
      errors.push({ line: index + 1, reason: 'no separator found' });
      return;
    }
    const front = fields[0];
    const back = fields.slice(1).join(delimiter);
    if (front === '' || back === '') {
      errors.push({ line: index + 1, reason: 'empty side' });
      return;
    }
    cards.push({ front, back });
  });
  return { cards, errors };
}

function quote(value) {
  return /[",\n\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(cards) {
  return cards.map((c) => `${quote(c.front)},${quote(c.back)}`).join('\n');
}
