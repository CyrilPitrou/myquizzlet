import { describe, it, expect } from 'vitest';
import {
  createProfileLock,
  verifyProfilePassword,
  passwordProblem,
  isProfileLocked,
} from '../app/profilelock.js';

describe('profile locks', () => {
  it('stores a salted verifier, never the password', async () => {
    const lock = await createProfileLock('correct horse', { iterations: 1000 });

    expect(lock).toMatchObject({ algorithm: 'PBKDF2-SHA-256', iterations: 1000 });
    expect(lock.salt).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(lock.verifier).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(JSON.stringify(lock)).not.toContain('correct horse');
  });

  it('accepts the right password and rejects a different one', async () => {
    const lock = await createProfileLock('six letters', { iterations: 1000 });

    expect(await verifyProfilePassword('six letters', lock)).toBe(true);
    expect(await verifyProfilePassword('wrong password', lock)).toBe(false);
  });

  it('uses a fresh salt for each profile', async () => {
    const first = await createProfileLock('same password', { iterations: 1000 });
    const second = await createProfileLock('same password', { iterations: 1000 });

    expect(first.salt).not.toBe(second.salt);
    expect(first.verifier).not.toBe(second.verifier);
  });

  it('rejects short passwords and mismatched confirmation', () => {
    expect(passwordProblem('short', 'short')).toBe('short');
    expect(passwordProblem('long enough', 'not the same')).toBe('mismatch');
    expect(passwordProblem('long enough', 'long enough')).toBeNull();
  });

  it('recognises only complete supported locks', () => {
    expect(isProfileLocked({ lock: {
      algorithm: 'PBKDF2-SHA-256', iterations: 1000, salt: 'AA==', verifier: 'AA==',
    } })).toBe(true);
    expect(isProfileLocked({})).toBe(false);
    expect(isProfileLocked({ lock: { algorithm: 'future' } })).toBe(false);
  });
});
