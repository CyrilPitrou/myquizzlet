// app/syncerror.js
//
// Pure. Turns the message on a failed sync into something worth reading.
//
// github.js throws `GitHub <status>: <raw body>`, and the status line put that
// straight on screen — `GitHub 401: {"message":"Bad credentials","documentation_url":…}`.
// The status code is the only part that carries meaning, and the useful half of
// that meaning is a single question: is the token the thing to go and fix?

const FAILED_REQUEST = /failed to fetch|networkerror|load failed|connection appears to be offline/i;

const BY_STATUS = {
  401: { key: 'sync.problem.auth', token: true },
  403: { key: 'sync.problem.forbidden', token: true },
  404: { key: 'sync.problem.missing', token: false },
  429: { key: 'sync.problem.rate', token: false },
};

export function syncProblem(detail) {
  const text = String(detail || '');

  const status = Number((text.match(/^GitHub (\d{3})/) || [])[1]);
  if (BY_STATUS[status]) return BY_STATUS[status];
  if (status >= 500) return { key: 'sync.problem.github', token: false };

  if (FAILED_REQUEST.test(text)) return { key: 'sync.problem.network', token: false };

  return { key: 'sync.problem.unknown', token: false };
}
