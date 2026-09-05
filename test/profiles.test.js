import { describe, it, expect } from 'vitest';
import {
  EMOJIS,
  slugifyProfile,
  uniqueProfileId,
  createProfile,
  validateProfileName,
  mergeProfiles,
} from '../app/profiles.js';

describe('profiles pure module', () => {
  describe('slugifyProfile', () => {
    it('lowercases and replaces spaces with dashes', () => {
      expect(slugifyProfile('Cyril Pitrou')).toBe('cyril-pitrou');
    });

    it('strips accents and special characters', () => {
      expect(slugifyProfile('Éléonore & Zoë')).toBe('eleonore-zoe');
    });

    it('trims leading/trailing dashes', () => {
      expect(slugifyProfile('---Hello---')).toBe('hello');
    });

    it('falls back to "profile" if empty after stripping', () => {
      expect(slugifyProfile('???')).toBe('profile');
      expect(slugifyProfile('')).toBe('profile');
    });
  });

  describe('uniqueProfileId', () => {
    it('returns slug if not taken', () => {
      expect(uniqueProfileId('Cyril', ['alice', 'bob'])).toBe('cyril');
    });

    it('appends incrementing number if taken', () => {
      expect(uniqueProfileId('Cyril', ['cyril'])).toBe('cyril-2');
      expect(uniqueProfileId('Cyril', ['cyril', 'cyril-2'])).toBe('cyril-3');
    });
  });

  describe('createProfile', () => {
    it('constructs a profile with id, trimmed name, and emoji', () => {
      const p = createProfile('  Alice  ', '🦊', []);
      expect(p).toEqual({
        id: 'alice',
        name: 'Alice',
        emoji: '🦊',
      });
    });

    it('uses emoji from palette', () => {
      expect(EMOJIS).toContain('🐻');
      expect(EMOJIS).toContain('👤');
    });
  });

  describe('validateProfileName', () => {
    const existing = [
      { id: 'cyril', name: 'Cyril', emoji: '🐻' },
      { id: 'lea', name: 'Léa', emoji: '🦊' },
    ];

    it('returns "empty" for empty or whitespace-only name', () => {
      expect(validateProfileName('', existing)).toBe('empty');
      expect(validateProfileName('   ', existing)).toBe('empty');
      expect(validateProfileName(null, existing)).toBe('empty');
    });

    it('returns "duplicate" if name already exists case-insensitively', () => {
      expect(validateProfileName('cyril', existing)).toBe('duplicate');
      expect(validateProfileName('CYRIL', existing)).toBe('duplicate');
      expect(validateProfileName('  Léa ', existing)).toBe('duplicate');
    });

    it('allows same name if excludeId matches (editing existing profile)', () => {
      expect(validateProfileName('Cyril', existing, 'cyril')).toBeNull();
    });

    it('returns null for valid new name', () => {
      expect(validateProfileName('Bob', existing)).toBeNull();
    });
  });

  describe('mergeProfiles', () => {
    it('returns other side if one is empty', () => {
      const p1 = [{ id: 'a', name: 'A' }];
      expect(mergeProfiles(p1, [])).toEqual(p1);
      expect(mergeProfiles([], p1)).toEqual(p1);
      expect(mergeProfiles(null, p1)).toEqual(p1);
    });

    it('combines unique profiles by id', () => {
      const local = [{ id: 'a', name: 'A', emoji: '🐻' }];
      const remote = [{ id: 'b', name: 'B', emoji: '🦊' }];
      const merged = mergeProfiles(local, remote);
      expect(merged).toHaveLength(2);
      expect(merged.map((p) => p.id)).toEqual(['a', 'b']);
    });

    it('resolves conflict using newer updatedAt if present', () => {
      const local = [{ id: 'a', name: 'Old', updatedAt: '2026-09-01T00:00:00Z' }];
      const remote = [{ id: 'a', name: 'New', updatedAt: '2026-09-02T00:00:00Z' }];
      const merged = mergeProfiles(local, remote);
      expect(merged).toEqual([{ id: 'a', name: 'New', updatedAt: '2026-09-02T00:00:00Z' }]);
    });
  });
});
