import { describe, it, expect, afterEach } from 'vitest';
import { adoptionFromHash, forgetAdoption } from '../app/adoption.js';

// Deliberately fake: a real GitHub token must never be written into the repo.
const FAKE = 'github_pat_EXAMPLE_NOT_A_REAL_TOKEN_0000000000000000';

afterEach(forgetAdoption);

describe('pending token adoption', () => {
  it('survives redraws after the secret has been stripped from the URL', () => {
    expect(adoptionFromHash(`#/adopt?t=${FAKE}&e=2027-08-31`))
      .toEqual({ token: FAKE, expiry: '2027-08-31' });
    expect(adoptionFromHash('#/adopt'))
      .toEqual({ token: FAKE, expiry: '2027-08-31' });
  });

  it('forgets the offer after it has been answered or the route is left', () => {
    adoptionFromHash(`#/adopt?t=${FAKE}`);
    forgetAdoption();
    expect(adoptionFromHash('#/adopt')).toBeNull();
  });

  it('does not treat a bare adopt route as a token', () => {
    expect(adoptionFromHash('#/adopt')).toBeNull();
  });
});
