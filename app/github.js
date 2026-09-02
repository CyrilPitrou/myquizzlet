export class ConflictError extends Error {}

const API = 'https://api.github.com';

function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(base64) {
  const binary = atob(String(base64).replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createGitHub({ repo, branch, token, fetchImpl = globalThis.fetch }) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const url = (path, query = '') => `${API}/repos/${repo}/contents/${path}${query}`;

  async function request(target, options = {}) {
    const response = await fetchImpl(target, { cache: 'no-store', ...options, headers: { ...headers, ...options.headers } });
    if (response.status === 404) return { missing: true };
    if (response.status === 409 || response.status === 422) {
      throw new ConflictError(`stale write: ${(await response.json()).message}`);
    }
    if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
    return { body: await response.json() };
  }

  return {
    async getFile(path) {
      const { missing, body } = await request(url(path, `?ref=${branch}`));
      if (missing) return null;
      return { json: JSON.parse(decode(body.content)), sha: body.sha };
    },

    async putFile(path, json, sha, message) {
      const { missing, body } = await request(url(path), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          branch,
          content: encode(JSON.stringify(json, null, 2)),
          ...(sha ? { sha } : {}),
        }),
      });
      if (missing) throw new Error(`GitHub 404: cannot write ${path}`);
      return { sha: body.content.sha };
    },

    async listDir(path) {
      const { missing, body } = await request(url(path, `?ref=${branch}`));
      if (missing) return [];
      return body.filter((entry) => entry.type === 'file')
        .map(({ name, path: p, sha }) => ({ name, path: p, sha }));
    },
  };
}
