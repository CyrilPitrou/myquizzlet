// A profile lock is a family safeguard, not an account system. The public
// data file carries only a salted, deliberately expensive verifier. A person
// with the repository token or developer tools can still bypass the UI.

export const PROFILE_LOCK_ALGORITHM = 'PBKDF2-SHA-256';
export const PROFILE_LOCK_ITERATIONS = 250000;
export const PROFILE_PASSWORD_MIN_LENGTH = 6;

const textBytes = (text) => new TextEncoder().encode(String(text).normalize('NFC'));

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derive(password, salt, iterations, cryptoImpl) {
  const key = await cryptoImpl.subtle.importKey(
    'raw', textBytes(password), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await cryptoImpl.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt, iterations,
  }, key, 256);
  return new Uint8Array(bits);
}

export function passwordProblem(password, confirmation) {
  if (Array.from(password || '').length < PROFILE_PASSWORD_MIN_LENGTH) return 'short';
  if (password !== confirmation) return 'mismatch';
  return null;
}

export function isProfileLocked(profile) {
  const lock = profile && profile.lock;
  return Boolean(lock && lock.algorithm === PROFILE_LOCK_ALGORITHM
    && Number.isInteger(lock.iterations) && lock.iterations > 0
    && typeof lock.salt === 'string' && lock.salt
    && typeof lock.verifier === 'string' && lock.verifier);
}

export async function createProfileLock(password, {
  cryptoImpl = globalThis.crypto,
  iterations = PROFILE_LOCK_ITERATIONS,
} = {}) {
  const salt = cryptoImpl.getRandomValues(new Uint8Array(16));
  const verifier = await derive(password, salt, iterations, cryptoImpl);
  return {
    algorithm: PROFILE_LOCK_ALGORITHM,
    iterations,
    salt: toBase64(salt),
    verifier: toBase64(verifier),
  };
}

export async function verifyProfilePassword(password, lock, cryptoImpl = globalThis.crypto) {
  try {
    if (!isProfileLocked({ lock })) return false;
    const expected = fromBase64(lock.verifier);
    const actual = await derive(password, fromBase64(lock.salt), lock.iterations, cryptoImpl);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
    return difference === 0;
  } catch {
    return false;
  }
}
