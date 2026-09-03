// app/install.js
//
// The browser's own install offer, kept for later.
//
// Chrome fires `beforeinstallprompt` once, early — usually before any screen
// has rendered — and the offer is lost unless something catches it there and
// then. So this module listens at import time, and `main.js` imports it before
// it renders anything.
//
// Why the app needs its own button at all: the install item lives in Chrome's
// ⋮ menu, and the menu is exactly what a QR scan hides. A scanned link opens a
// Custom Tab, which has no install item — and where this event never fires, so
// `canInstall()` is false and the screen falls back to written steps.
//
// Browser-side, like status.js: no unit test, verified by using it.

let offer = null;
let notify = () => {};

window.addEventListener('beforeinstallprompt', (event) => {
  // Keep Chrome's own banner out of the way; the app asks in its own words.
  event.preventDefault();
  offer = event;
  notify();
});

window.addEventListener('appinstalled', () => {
  offer = null;
  notify();
});

// True once the app runs from the home screen rather than a browser tab.
//
// `display-mode: standalone` is the real answer, but it only holds where the
// browser made a real app of it. Firefox for Android makes a shortcut instead:
// it opens in Firefox, with the address bar, so standalone stays false and the
// Install section would nag forever on a device that is as installed as that
// browser allows. The manifest's start_url therefore carries `?home=1`, which
// a launch from the home screen brings with it and an ordinary visit does not.
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true
  || new URLSearchParams(window.location.search).has('home');

// True only where the browser has actually offered — never a guess.
export const canInstall = () => offer !== null;

// Settings redraws itself when the offer arrives or the app is installed,
// because either can happen while the screen is already on show.
export function onInstallChange(fn) { notify = fn; }

// Resolves to 'accepted', 'dismissed', or 'unavailable'. An offer can only be
// used once, so it is dropped whatever the answer: a dismissed prompt cannot
// be reopened, and Chrome will fire a fresh event when it is willing again.
export async function promptInstall() {
  if (!offer) return 'unavailable';
  const event = offer;
  offer = null;
  event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome;
}
