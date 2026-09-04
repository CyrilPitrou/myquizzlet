import { describe, it, expect } from 'vitest';
import { formatDate } from '../app/dates.js';

describe('formatDate', () => {
  it('writes an ISO day the European way', () => {
    expect(formatDate('2026-09-03')).toBe('03/09/2026');
  });

  it('accepts a full timestamp and keeps only the day', () => {
    expect(formatDate('2026-01-31T12:00:00.000Z')).toBe('31/01/2026');
  });

  it('has nothing to say about a missing or malformed date', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('3 September 2026')).toBe('');
  });
});
