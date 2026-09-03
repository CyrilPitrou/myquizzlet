import { describe, it, expect } from 'vitest';
import { SOUNDS } from '../app/audio.js';

const NAMES = ['right', 'wrong', 'typo', 'graduate', 'perfect', 'great', 'ok', 'rough'];

describe('the sound table', () => {
  it('has an entry for every sound the app asks for', () => {
    expect(Object.keys(SOUNDS).sort()).toEqual([...NAMES].sort());
  });

  it('gives every note a frequency, a start, a length and a wave', () => {
    const waves = ['sine', 'square', 'sawtooth', 'triangle'];
    for (const [name, notes] of Object.entries(SOUNDS)) {
      expect(notes.length, name).toBeGreaterThan(0);
      for (const note of notes) {
        expect(note.freq, name).toBeGreaterThan(20);
        expect(note.freq, name).toBeLessThan(20000);
        expect(note.at, name).toBeGreaterThanOrEqual(0);
        expect(note.dur, name).toBeGreaterThan(0);
        expect(waves, name).toContain(note.wave);
      }
    }
  });

  // A blip between questions must not outstay its welcome.
  it('keeps the answer sounds short', () => {
    for (const name of ['right', 'wrong', 'typo']) {
      const end = Math.max(...SOUNDS[name].map((note) => note.at + note.dur));
      expect(end, name).toBeLessThan(0.35);
    }
  });
});
