import { settings } from './app.js';
import { el } from './ui.js';

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
// Only a wrong answer is washed. A right one already says so — the ✓ on the
// choice, the card flying off to the right — and a green flash on top of that
// is one confirmation too many.
//
// Answering re-renders the screen, so the verdict cannot be washed over the
// prompt itself — that node is thrown away before the animation is seen.
// `#screen` is emptied and refilled but never replaced, so a wash on it
// outlives the answer without making anyone wait for it.
export function flashWrong(node) {
  if (!node || !feedbackOn()) return;
  node.classList.remove('flash-bad');
  void node.offsetWidth;      // restart the animation when the verdict repeats
  node.classList.add('flash-bad');
  node.addEventListener('animationend',
    () => node.classList.remove('flash-bad'), { once: true });
}

// Counts to the final number, or arrives there at once when motion is off.
export function countUp(node, to, ms = 700) {
  if (!motionOn() || to === 0) { node.textContent = String(to); return; }
  const started = performance.now();
  const tick = (now) => {
    const share = Math.min(1, (now - started) / ms);
    node.textContent = String(Math.round(to * share));
    if (share < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// A conic-gradient dial. The fill is set from a custom property so the
// animation is a single transition rather than a redraw.
export function ring(pct) {
  const number = el('span', { class: 'ring-num', text: '0' });
  const node = el('div', { class: 'ring' }, [el('span', { class: 'ring-label' }, [number, '%'])]);
  node.style.setProperty('--pct', motionOn() ? '0' : String(pct));
  if (motionOn()) requestAnimationFrame(() => node.style.setProperty('--pct', String(pct)));
  countUp(number, pct);
  return node;
}

export function confetti(node) {
  if (!motionOn()) return;
  const box = el('div', { class: 'confetti' });
  for (let i = 0; i < 40; i += 1) {
    const bit = el('span', { class: `bit c${(i % 4) + 1}` });
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.animationDelay = `${Math.random() * 0.5}s`;
    bit.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    bit.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.append(bit);
  }
  node.append(box);
  // The whole burst removes itself; nothing else has to remember it exists.
  setTimeout(() => box.remove(), 3600);
}
