import { describe, it, expect } from 'vitest';
import { syncProblem } from '../app/syncerror.js';

// github.js throws `GitHub <status>: <raw body>`, and the raw body is a lump of
// JSON. Showing that to the one person who uses this app tells them nothing
// they can act on, so the status code is turned back into a sentence and a
// verdict on whether the token is the thing to go and look at.
describe('syncProblem', () => {
  it('reads 401 as a token GitHub will not accept', () => {
    const problem = syncProblem('GitHub 401: {"message":"Bad credentials"}');
    expect(problem).toEqual({ key: 'sync.problem.auth', token: true });
  });

  it('reads 403 as a token that is not allowed near this repository', () => {
    expect(syncProblem('GitHub 403: {"message":"Resource not accessible"}'))
      .toEqual({ key: 'sync.problem.forbidden', token: true });
  });

  it('reads 404 as the repository or branch not being there', () => {
    expect(syncProblem('GitHub 404: cannot write data/lists/x.json'))
      .toEqual({ key: 'sync.problem.missing', token: false });
  });

  it('reads a 5xx as GitHub’s own problem, not the token’s', () => {
    expect(syncProblem('GitHub 500: <html>')).toEqual({ key: 'sync.problem.github', token: false });
    expect(syncProblem('GitHub 503: ')).toEqual({ key: 'sync.problem.github', token: false });
  });

  // What fetch throws when the request never arrived. Every browser words it
  // differently, which is exactly why this is matched in one place.
  it('reads a failed request as the network', () => {
    for (const detail of ['Failed to fetch', 'NetworkError when attempting to fetch resource.',
                          'Load failed', 'The Internet connection appears to be offline.']) {
      expect(syncProblem(detail)).toEqual({ key: 'sync.problem.network', token: false });
    }
  });

  it('falls back to a general line for anything it does not recognise', () => {
    expect(syncProblem('something else entirely'))
      .toEqual({ key: 'sync.problem.unknown', token: false });
  });

  // setStatus defaults detail to '', and an error with no message is possible.
  it('treats a missing detail as unrecognised rather than throwing', () => {
    expect(syncProblem('')).toEqual({ key: 'sync.problem.unknown', token: false });
    expect(syncProblem(undefined)).toEqual({ key: 'sync.problem.unknown', token: false });
  });

  // 429 is a rate limit, which reads as "wait", not "your token is wrong".
  it('reads 429 as too many requests', () => {
    expect(syncProblem('GitHub 429: {"message":"rate limit"}'))
      .toEqual({ key: 'sync.problem.rate', token: false });
  });
});
