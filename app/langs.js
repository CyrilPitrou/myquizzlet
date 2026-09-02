// A column label like "French" or "Français" is also a language declaration.
// Anything unrecognised ("Date", "Event") is simply a label, and grading falls
// back to its language-neutral behaviour.
const NAMES = {
  en: ['english', 'anglais'],
  fr: ['french', 'français', 'francais'],
  es: ['spanish', 'español', 'espanol', 'espagnol'],
  de: ['german', 'deutsch', 'allemand'],
  it: ['italian', 'italiano', 'italien'],
  pt: ['portuguese', 'português', 'portugues', 'portugais'],
  nl: ['dutch', 'nederlands', 'néerlandais', 'neerlandais'],
  ru: ['russian', 'русский', 'russe'],
  pl: ['polish', 'polski', 'polonais'],
  el: ['greek', 'ελληνικά', 'grec'],
  la: ['latin'],
  he: ['hebrew', 'hébreu', 'hebreu'],
  ar: ['arabic', 'arabe'],
  ja: ['japanese', '日本語', 'japonais'],
  zh: ['chinese', '中文', 'chinois'],
  ko: ['korean', 'coréen', 'coreen'],
  tr: ['turkish', 'türkçe', 'turkce'],
  sv: ['swedish', 'svenska'],
  no: ['norwegian', 'norsk'],
  da: ['danish', 'dansk'],
  fi: ['finnish', 'suomi'],
  cs: ['czech', 'čeština', 'cestina'],
  hu: ['hungarian', 'magyar'],
  ro: ['romanian', 'română', 'romana'],
  ca: ['catalan', 'català'],
};

const fold = (text) => String(text).trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

const CODES = new Map();
for (const [code, names] of Object.entries(NAMES)) {
  CODES.set(code, code);
  for (const name of names) CODES.set(fold(name), code);
}

export function langOf(label) {
  if (!label) return null;
  return CODES.get(fold(label)) ?? null;
}
