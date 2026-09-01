import { describe, it, expect, vi } from 'vitest';
import { createGitHub, ConflictError } from '../app/github.js';

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');

function client(responses) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, options = {}) => {
    calls.push({ url, options });
    const next = responses.shift();
    return {
      ok: next.status < 400,
      status: next.status,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    };
  });
  return {
    calls,
    gh: createGitHub({ repo: 'CyrilPitrou/myquizzlet', branch: 'data', token: 'tok', fetchImpl }),
  };
}

describe('getFile', () => {
  it('returns the parsed json and the sha', async () => {
    const { gh } = client([{ status: 200, body: { content: b64('{"a":1}'), sha: 'sha1' } }]);
    expect(await gh.getFile('data/lists/f.json')).toEqual({ json: { a: 1 }, sha: 'sha1' });
  });

  it('decodes accented characters correctly', async () => {
    const { gh } = client([{ status: 200, body: { content: b64('{"w":"château"}'), sha: 's' } }]);
    expect((await gh.getFile('p')).json.w).toBe('château');
  });

  it('returns null for a missing file', async () => {
    const { gh } = client([{ status: 404, body: {} }]);
    expect(await gh.getFile('data/lists/nope.json')).toBe(null);
  });

  it('requests the data branch with the token', async () => {
    const { gh, calls } = client([{ status: 404, body: {} }]);
    await gh.getFile('data/lists/f.json');
    expect(calls[0].url).toContain('/repos/CyrilPitrou/myquizzlet/contents/data/lists/f.json');
    expect(calls[0].url).toContain('ref=data');
    expect(calls[0].options.headers.Authorization).toBe('Bearer tok');
  });

  it('throws on an unexpected status', async () => {
    const { gh } = client([{ status: 500, body: { message: 'boom' } }]);
    await expect(gh.getFile('p')).rejects.toThrow(/500/);
  });
});

describe('putFile', () => {
  it('sends base64 content, the sha and the branch', async () => {
    const { gh, calls } = client([{ status: 200, body: { content: { sha: 'sha2' } } }]);
    const result = await gh.putFile('data/lists/f.json', { a: 1 }, 'sha1', 'update f');
    const body = JSON.parse(calls[0].options.body);
    expect(calls[0].options.method).toBe('PUT');
    expect(body.branch).toBe('data');
    expect(body.sha).toBe('sha1');
    expect(body.message).toBe('update f');
    expect(Buffer.from(body.content, 'base64').toString('utf8')).toBe(JSON.stringify({ a: 1 }, null, 2));
    expect(result).toEqual({ sha: 'sha2' });
  });

  it('omits sha when creating a new file', async () => {
    const { gh, calls } = client([{ status: 201, body: { content: { sha: 'new' } } }]);
    await gh.putFile('p', { a: 1 }, null, 'create');
    expect(JSON.parse(calls[0].options.body).sha).toBeUndefined();
  });

  it('throws ConflictError when the sha is stale', async () => {
    const { gh } = client([{ status: 409, body: { message: 'is at ... but expected ...' } }]);
    await expect(gh.putFile('p', {}, 'old', 'm')).rejects.toBeInstanceOf(ConflictError);
  });

  it('treats 422 as a conflict too', async () => {
    const { gh } = client([{ status: 422, body: { message: 'sha does not match' } }]);
    await expect(gh.putFile('p', {}, 'old', 'm')).rejects.toBeInstanceOf(ConflictError);
  });

  it('encodes accented characters correctly', async () => {
    const { gh, calls } = client([{ status: 200, body: { content: { sha: 'sha3' } } }]);
    await gh.putFile('data/lists/f.json', { w: 'château' }, 'sha1', 'update');
    const body = JSON.parse(calls[0].options.body);
    expect(Buffer.from(body.content, 'base64').toString('utf8')).toBe(JSON.stringify({ w: 'château' }, null, 2));
  });

  it('throws an error with the status when a write gets a 404', async () => {
    const { gh } = client([{ status: 404, body: {} }]);
    await expect(gh.putFile('data/lists/f.json', {}, 'sha1', 'm')).rejects.toThrow(/404/);
  });
});

describe('listDir', () => {
  it('returns names, paths and shas', async () => {
    const { gh } = client([{ status: 200, body: [
      { name: 'food.json', path: 'data/lists/food.json', sha: 's1', type: 'file' },
      { name: 'sub', path: 'data/lists/sub', sha: 's2', type: 'dir' },
    ] }]);
    expect(await gh.listDir('data/lists')).toEqual([
      { name: 'food.json', path: 'data/lists/food.json', sha: 's1' },
    ]);
  });

  it('returns an empty array when the directory does not exist yet', async () => {
    const { gh } = client([{ status: 404, body: {} }]);
    expect(await gh.listDir('data/lists')).toEqual([]);
  });
});
