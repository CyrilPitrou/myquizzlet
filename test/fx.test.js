import { describe, it, expect } from 'vitest';
import { wantsMotion, wantsFeedback } from '../app/fx.js';

describe('wantsMotion', () => {
  // Absent means on: a fresh install gets the motion without being asked.
  it('is on when the setting has never been touched', () => {
    expect(wantsMotion({}, false)).toBe(true);
  });

  it('is off when the switch is off', () => {
    expect(wantsMotion({ visualEffects: false }, false)).toBe(false);
  });

  it('is on when the switch is on', () => {
    expect(wantsMotion({ visualEffects: true }, false)).toBe(true);
  });

  // The OS wins for travel. Someone who asked their machine for less motion
  // should not have to find a second switch in a personal app.
  it('is off when the OS asks for reduced motion, whatever the switch says', () => {
    expect(wantsMotion({ visualEffects: true }, true)).toBe(false);
    expect(wantsMotion({}, true)).toBe(false);
  });
});

describe('wantsFeedback', () => {
  // The colour flash is not travel. Reduced-motion is about things moving
  // across the screen, and a verdict you can see is worth keeping.
  it('follows the switch alone', () => {
    expect(wantsFeedback({})).toBe(true);
    expect(wantsFeedback({ visualEffects: true })).toBe(true);
    expect(wantsFeedback({ visualEffects: false })).toBe(false);
  });
});
