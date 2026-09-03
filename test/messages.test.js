import { describe, it, expect } from 'vitest';
import { bucketFor, pick } from '../app/messages.js';
import { messagesEn } from '../app/messages.en.js';
import { messagesFr } from '../app/messages.fr.js';

const BUCKETS = ['perfect', 'great', 'ok', 'rough'];

describe('bucketFor', () => {
  it('calls a clean sweep perfect', () => {
    expect(bucketFor(20, 20)).toBe('perfect');
    expect(bucketFor(1, 1)).toBe('perfect');
  });

  it('calls 85% and above great', () => {
    expect(bucketFor(17, 20)).toBe('great');
    expect(bucketFor(19, 20)).toBe('great');
  });

  it('calls 60% and above ok', () => {
    expect(bucketFor(12, 20)).toBe('ok');
    expect(bucketFor(16, 20)).toBe('ok');
  });

  it('calls the rest rough', () => {
    expect(bucketFor(0, 20)).toBe('rough');
    expect(bucketFor(11, 20)).toBe('rough');
  });

  // A session with nothing in it is not a perfect score.
  it('does not congratulate an empty session', () => {
    expect(bucketFor(0, 0)).toBe('ok');
  });
});

describe('pick', () => {
  it('returns the first line when the die reads zero', () => {
    expect(pick('perfect', 'en', () => 0)).toBe(messagesEn.perfect[0]);
  });

  it('returns the last line when the die reads just under one', () => {
    expect(pick('perfect', 'en', () => 0.999)).toBe(messagesEn.perfect.at(-1));
  });

  it('answers in the language it is asked in', () => {
    expect(messagesFr.perfect).toContain(pick('perfect', 'fr', () => 0.5));
  });

  it('falls back to English for a language it does not have', () => {
    expect(messagesEn.ok).toContain(pick('ok', 'de', () => 0.5));
  });
});

describe('the message lists', () => {
  it('covers every bucket in both languages', () => {
    for (const bucket of BUCKETS) {
      expect(messagesEn[bucket].length, bucket).toBeGreaterThanOrEqual(4);
      expect(messagesFr[bucket].length, bucket).toBeGreaterThanOrEqual(4);
    }
  });

  // The two languages are written independently, on purpose: this tone does
  // not survive translation. So they may differ in length — but not be empty.
  it('leaves no blank line', () => {
    const all = [messagesEn, messagesFr].flatMap((set) => BUCKETS.flatMap((b) => set[b]));
    expect(all.filter((line) => !line || !line.trim())).toEqual([]);
  });
});
