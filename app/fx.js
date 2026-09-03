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

export function flyOut(node, dir) {
  if (!motionOn()) return Promise.resolve();
  node.classList.add('flying');
  // A frame between the transition class and the target class, or the browser
  // collapses the two and there is nothing to animate from. The inline
  // transform a drag left behind goes at the same moment, so the flight
  // starts where the finger let go.
  requestAnimationFrame(() => {
    node.style.transition = '';
    node.style.transform = '';
    node.classList.add(dir === 'right' ? 'fly-right' : 'fly-left');
  });
  return settle(node, 350);
}

// The incoming card comes from the side the outgoing one left towards.
export function slideIn(node, dir) {
  if (!motionOn()) return;
  node.classList.add(dir === 'right' ? 'in-right' : 'in-left');
  node.addEventListener('animationend', () => node.classList.remove('in-right', 'in-left'), { once: true });
}

export function lift(node, on) {
  if (!motionOn()) return;
  node.classList.toggle('lifted', on);
}

// Feedback, not travel: this one survives prefers-reduced-motion.
//
// Answering re-renders the screen, so the verdict cannot be washed over the
// prompt itself — that node is thrown away before the animation is seen.
// `#screen` is emptied and refilled but never replaced, so a wash on it
// outlives the answer without making anyone wait for it.
export function flash(node, kind) {
  if (!node || !feedbackOn()) return;
  node.classList.remove('flash-ok', 'flash-bad');
  void node.offsetWidth;      // restart the animation when the verdict repeats
  node.classList.add(kind === 'ok' ? 'flash-ok' : 'flash-bad');
  node.addEventListener('animationend',
    () => node.classList.remove('flash-ok', 'flash-bad'), { once: true });
}
