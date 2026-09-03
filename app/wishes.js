// The parts of the suggestions box that are decisions rather than layout.
// Pure, and knowing nothing about i18n: the seed prefix arrives already
// translated, the way ui.js's menu() takes its label.

// "Empty" has to mean one thing to three parties: the workflow that notifies
// on a non-empty box, the skill that stops on an empty one, and whoever
// cleared the box and left a newline behind.
export function suggestionsDoc(text, nowIso) {
  return { updatedAt: nowIso, text: text.trim() ? text : '' };
}

// The box is shared. Seeding it from a list menu adds to what is there and
// never replaces it.
export function seedWish(text, prefix) {
  const body = text.replace(/\s+$/, '');
  if (!body) return prefix;
  if (body.endsWith(prefix.replace(/\s+$/, ''))) return text;
  return `${body}\n\n${prefix}`;
}

export function recentEntries(log, limit = 5) {
  const entries = (log && log.entries) || [];
  return [...entries]
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, limit);
}
