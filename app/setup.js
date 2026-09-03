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

// Enough to tell two tokens apart, not enough to use one. The reveal is a
// fixed 10 + 4 characters, so below 28 the hidden middle would be shorter
// than what is shown — collapse those to the same blank mask instead.
export function maskToken(token) {
  return (token || '').length >= 28 ? `${token.slice(0, 10)}…${token.slice(-4)}` : '…';
}

const DAY = 24 * 60 * 60 * 1000;

// ISO_DATE only checks digit shape; a shaped-but-impossible date like
// '2026-02-30' still parses, because Date normalizes it (to 2026-03-02)
// instead of failing. Round-tripping through the parsed UTC date catches
// both that and outright unparseable input in one check.
function isValidExpiry(expiry) {
  const parsed = new Date(`${expiry}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === expiry;
}

// Returns data, not prose, so this module stays pure and testable without a
// language: { key, params } for t(), or null when there is nothing to warn
// about. The two callers run the result through t().
export function expiryWarning(expiry, today) {
  if (!expiry || !ISO_DATE.test(expiry) || !isValidExpiry(expiry)) return null;
  const days = Math.round(
    (Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (days > 14) return null;
  if (days < 0) return { key: 'token.expired', params: { expiry } };
  if (days === 0) return { key: 'token.expiresToday', params: {} };
  return { key: 'token.expiresIn', params: { n: days, expiry } };
}
