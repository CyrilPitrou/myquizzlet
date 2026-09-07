import { parseSetup } from './setup.js';

// The setup token must leave the address bar immediately, but rendering the
// route is not a one-shot event: the initial sync, a language change, or a
// visibility sync may repaint it. Keep the offer in memory for as long as the
// user remains on the adopt route. It deliberately does not survive a reload.
let pending = null;

export function adoptionFromHash(hash) {
  if ((hash || '').startsWith('#/adopt?')) pending = parseSetup(hash);
  return pending;
}

export function forgetAdoption() {
  pending = null;
}
