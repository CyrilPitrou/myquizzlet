import { settings } from './app.js';

// Every sound is a few notes. Keeping them as data means the table can be
// tested and retuned without touching the player.
export const SOUNDS = {
  right:    [{ freq: 659.25, at: 0,    dur: 0.09, wave: 'triangle' },
             { freq: 880.00, at: 0.08, dur: 0.12, wave: 'triangle' }],
  wrong:    [{ freq: 160.00, at: 0,    dur: 0.14, wave: 'square' }],
  typo:     [{ freq: 493.88, at: 0,    dur: 0.12, wave: 'triangle' }],
  graduate: [{ freq: 523.25, at: 0,    dur: 0.08, wave: 'triangle' },
             { freq: 659.25, at: 0.07, dur: 0.08, wave: 'triangle' },
             { freq: 783.99, at: 0.14, dur: 0.16, wave: 'triangle' }],
  perfect:  [{ freq: 523.25, at: 0,    dur: 0.10, wave: 'triangle' },
             { freq: 659.25, at: 0.09, dur: 0.10, wave: 'triangle' },
             { freq: 783.99, at: 0.18, dur: 0.10, wave: 'triangle' },
             { freq: 1046.5, at: 0.27, dur: 0.22, wave: 'triangle' },
             { freq: 1318.5, at: 0.40, dur: 0.30, wave: 'triangle' }],
  great:    [{ freq: 523.25, at: 0,    dur: 0.10, wave: 'triangle' },
             { freq: 659.25, at: 0.09, dur: 0.10, wave: 'triangle' },
             { freq: 880.00, at: 0.18, dur: 0.26, wave: 'triangle' }],
  ok:       [{ freq: 440.00, at: 0,    dur: 0.11, wave: 'triangle' },
             { freq: 523.25, at: 0.10, dur: 0.20, wave: 'triangle' }],
  rough:    [{ freq: 392.00, at: 0,    dur: 0.12, wave: 'sine' },
             { freq: 329.63, at: 0.11, dur: 0.24, wave: 'sine' }],
};

let context = null;

// Built on the first sound, which is always inside a click or a keypress —
// browsers refuse to start an audio context anywhere else. While the switch
// is off no context is ever created at all.
function ready() {
  if (!settings().audioEffects) return null;
  if (!context) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

export function play(name) {
  const audio = ready();
  const notes = SOUNDS[name];
  if (!audio || !notes) return;
  const now = audio.currentTime;
  for (const note of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = note.wave;
    osc.frequency.value = note.freq;
    // A ramp at each end: a square wave switched on at full volume clicks.
    gain.gain.setValueAtTime(0.0001, now + note.at);
    gain.gain.exponentialRampToValueAtTime(0.18, now + note.at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + note.at);
    osc.stop(now + note.at + note.dur + 0.02);
  }
}
