import { settings, saveSettings, ctx } from './app.js';
import { en } from './i18n.en.js';
import { fr } from './i18n.fr.js';

export const DICTS = { en, fr };

// French puts zero in the singular, English does not. That is the entire rule.
export function plural(langCode, n) {
  if (langCode === 'fr') return n < 2 ? 'one' : 'other';
  return n === 1 ? 'one' : 'other';
}

// Pure, so it can be tested without a browser or a settings blob.
// A missing key falls back to the English string; only a key that exists in
// neither dictionary comes back as itself.
export function translate(dict, fallbackDict, langCode, key, params = {}) {
  const wanted = params.n === undefined ? key : `${key}_${plural(langCode, params.n)}`;
  const text = dict[wanted] ?? fallbackDict[wanted] ?? key;
  return text.replace(/\{(\w+)\}/g, (whole, name) =>
    (params[name] === undefined ? whole : String(params[name])));
}

export function lang() {
  return settings().lang === 'fr' ? 'fr' : 'en';
}

export function t(key, params) {
  const code = lang();
  const text = translate(DICTS[code], en, code, key, params);
  if (text === key) console.warn(`i18n: no string for ${key}`);
  return text;
}

// The language is per-device, like the theme: it lives in the same local
// settings blob and is never synced.
export function setLang(code) {
  saveSettings({ ...settings(), lang: code });
  document.documentElement.lang = code;
  ctx.render();
}
