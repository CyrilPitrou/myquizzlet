// Dates are stored as plain ISO days, 2026-09-03, because that is what sorts
// and what a human can still read in the JSON. They are shown European,
// 03/09/2026, in both languages: the owner reads both and writes dates one
// way. Anything that is not an ISO day comes back empty rather than
// half-formatted, so a list without a creation date simply shows none.
export function formatDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!match) return '';
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
