// app/tokennote.js
//
// The reminder that this device has nowhere to save what you are about to do.
//
// It follows the fx.js rule: a screen never asks whether the note is wanted,
// it appends what this returns. Without a token that is a box; with one it is
// nothing, and the screen is exactly as it was.
//
// It lives on the Train and Test setup screens — before the answer loop, never
// inside it — because that is where a session is decided on, and because the
// setup screens are the two places a new device is most likely to be pointed
// at first. It carries no dismiss button: it goes away when a token is saved,
// which is the only ending worth having.
import { el } from './ui.js';
import { settings } from './app.js';
import { t } from './i18n.js';

export function tokenNote() {
  if (settings().token) return null;

  return el('div', { class: 'warn notice' }, [
    el('h4', { text: t('tokennote.title') }),
    el('p', { text: t('tokennote.body') }),
    el('a', { class: 'btn', href: '#/token', text: t('tokennote.button') }),
  ]);
}
