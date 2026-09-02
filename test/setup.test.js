import { describe, it, expect } from 'vitest';
import { setupLink, parseSetup, maskToken, expiryWarning, APP_URL } from '../app/setup.js';

// Not a token. Never put a real one in a file in this repo.
const FAKE = 'github_pat_EXAMPLE_NOT_A_REAL_TOKEN_0000000000000000';

describe('setupLink', () => {
  it('builds a link the receiving device can simply open', () => {
    expect(setupLink({ token: FAKE, expiry: '2027-08-31' }))
      .toBe(`${APP_URL}#/adopt?t=${FAKE}&e=2027-08-31`);
  });

  it('leaves the expiry out when there is none', () => {
    expect(setupLink({ token: FAKE, expiry: null })).toBe(`${APP_URL}#/adopt?t=${FAKE}`);
  });

  it('escapes a token that is not URL-safe', () => {
    expect(setupLink({ token: 'a b&c', expiry: null })).toBe(`${APP_URL}#/adopt?t=a%20b%26c`);
  });
});

describe('parseSetup', () => {
  it('reads back a link it built', () => {
    expect(parseSetup(setupLink({ token: FAKE, expiry: '2027-08-31' })))
      .toEqual({ token: FAKE, expiry: '2027-08-31' });
  });

  it('reads a link with no expiry', () => {
    expect(parseSetup(`${APP_URL}#/adopt?t=${FAKE}`)).toEqual({ token: FAKE, expiry: null });
  });

  it('reads a bare fragment, which is what the address bar shows', () => {
    expect(parseSetup(`#/adopt?t=${FAKE}&e=2027-08-31`))
      .toEqual({ token: FAKE, expiry: '2027-08-31' });
  });

  it('decodes an escaped token', () => {
    expect(parseSetup('#/adopt?t=a%20b%26c')).toEqual({ token: 'a b&c', expiry: null });
  });

  it('accepts a bare token, which is what a paste usually is', () => {
    expect(parseSetup(`  ${FAKE}\n`)).toEqual({ token: FAKE, expiry: null });
  });

  it('refuses an adopt link carrying no token', () => {
    expect(parseSetup(`${APP_URL}#/adopt?e=2027-08-31`)).toBe(null);
  });

  it('refuses a URL that is not a setup link', () => {
    expect(parseSetup('https://github.com/CyrilPitrou/myquizzlet')).toBe(null);
  });

  it('refuses empty or whitespace-riddled text', () => {
    expect(parseSetup('')).toBe(null);
    expect(parseSetup('   ')).toBe(null);
    expect(parseSetup('two words')).toBe(null);
  });

  it('ignores an expiry that is not a date', () => {
    expect(parseSetup(`#/adopt?t=${FAKE}&e=soon`)).toEqual({ token: FAKE, expiry: null });
  });
});

describe('maskToken', () => {
  it('shows enough to recognise a token and not enough to use one', () => {
    const masked = maskToken(FAKE);
    expect(masked).toBe('github_pat…0000');
    expect(masked).not.toContain('NOT_A_REAL_TOKEN');
  });

  it('gives away nothing about a short string', () => {
    expect(maskToken('short')).toBe('…');
    expect(maskToken('')).toBe('…');
  });

  it('draws the line where the hidden middle would be shorter than the reveal', () => {
    expect(maskToken('x'.repeat(27))).toBe('…');
    expect(maskToken('x'.repeat(28))).toBe(`${'x'.repeat(10)}…${'x'.repeat(4)}`);
  });
});

describe('expiryWarning', () => {
  it('says nothing when the expiry is far off', () => {
    expect(expiryWarning('2027-08-31', '2026-09-02')).toBe(null);
  });

  it('says nothing when there is no expiry recorded', () => {
    expect(expiryWarning(null, '2026-09-02')).toBe(null);
  });

  it('says nothing for a shaped-but-impossible date', () => {
    expect(expiryWarning('2026-13-01', '2026-09-02')).toBe(null);
  });

  it('warns a fortnight ahead', () => {
    expect(expiryWarning('2026-09-16', '2026-09-02'))
      .toBe('This token expires in 14 days, on 2026-09-16.');
  });

  it('counts down in the singular on the last day', () => {
    expect(expiryWarning('2026-09-03', '2026-09-02'))
      .toBe('This token expires in 1 day, on 2026-09-03.');
  });

  it('says today plainly', () => {
    expect(expiryWarning('2026-09-02', '2026-09-02')).toBe('This token expires today.');
  });

  it('states the past tense once it has lapsed', () => {
    expect(expiryWarning('2026-08-30', '2026-09-02'))
      .toBe('This token expired on 2026-08-30. Changes stay on this device until you replace it.');
  });
});
