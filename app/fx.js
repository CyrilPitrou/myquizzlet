import { settings } from './app.js';

// One place decides whether an effect happens. Screens call these helpers
// unconditionally and never ask the settings blob themselves.

// Absent means on. The switch is a way to turn motion off, not a thing you
// have to find before the app feels finished.
export function wantsMotion(blob, reducedMotion) {
  if (reducedMotion) return false;
  return blob.visualEffects !== false;
}

// The colour flash survives reduced-motion: it is feedback, not travel.
export function wantsFeedback(blob) {
  return blob.visualEffects !== false;
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const motionOn = () => wantsMotion(settings(), reduced());
export const feedbackOn = () => wantsFeedback(settings());

// Every helper resolves immediately when motion is off, so a screen can await
// it unconditionally. A transition that never fires must not hang a session,
// hence the timeout alongside transitionend.
function settle(node, ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      node.removeEventListener('transitionend', finish);
      resolve();
    };
    node.addEventListener('transitionend', finish);
    setTimeout(finish, ms);
  });
}

export function flip(node) {
  node.classList.toggle('flipped');
  if (!motionOn()) return Promise.resolve();
  return settle(node, 450);
}
