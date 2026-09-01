import { describe, it, expect } from 'vitest';
import { mergeProgress, compareLists } from '../app/merge.js';

const item = (box, lastSeen) => ({ box, due: '2026-09-02', seen: box, lapses: 0, lastSeen });

describe('mergeProgress', () => {
  it('keeps items that exist on one side only', () => {
    const merged = mergeProgress(
      { listId: 'f', items: { 'a:f2b': item(1, '2026-09-01T10:00:00Z') } },
      { listId: 'f', items: { 'b:f2b': item(2, '2026-09-01T11:00:00Z') } },
    );
    expect(Object.keys(merged.items).sort()).toEqual(['a:f2b', 'b:f2b']);
  });

  it('keeps the record with the later lastSeen', () => {
    const merged = mergeProgress(
      { listId: 'f', items: { 'a:f2b': item(1, '2026-09-01T10:00:00Z') } },
      { listId: 'f', items: { 'a:f2b': item(4, '2026-09-01T12:00:00Z') } },
    );
    expect(merged.items['a:f2b'].box).toBe(4);
  });

  it('prefers local when local is later', () => {
    const merged = mergeProgress(
      { listId: 'f', items: { 'a:f2b': item(3, '2026-09-01T12:00:00Z') } },
      { listId: 'f', items: { 'a:f2b': item(4, '2026-09-01T10:00:00Z') } },
    );
    expect(merged.items['a:f2b'].box).toBe(3);
  });

  it('treats a never-seen record as older than any timestamp', () => {
    const merged = mergeProgress(
      { listId: 'f', items: { 'a:f2b': item(1, null) } },
      { listId: 'f', items: { 'a:f2b': item(5, '2026-09-01T10:00:00Z') } },
    );
    expect(merged.items['a:f2b'].box).toBe(5);
  });

  it('is order-independent', () => {
    const a = { listId: 'f', items: { 'a:f2b': item(1, '2026-09-01T10:00:00Z') } };
    const b = { listId: 'f', items: { 'a:f2b': item(4, '2026-09-01T12:00:00Z') } };
    expect(mergeProgress(a, b)).toEqual(mergeProgress(b, a));
  });

  it('copes with a missing remote', () => {
    const local = { listId: 'f', items: { 'a:f2b': item(1, '2026-09-01T10:00:00Z') } };
    expect(mergeProgress(local, null)).toEqual(local);
  });
});

describe('compareLists', () => {
  const synced = { id: 'f', updatedAt: '2026-09-01T10:00:00Z' };
  const edited = { id: 'f', updatedAt: '2026-09-01T12:00:00Z' };
  const base = { sha: 'sha1', updatedAt: '2026-09-01T10:00:00Z' };

  it('says same when neither side moved since the last sync', () => {
    expect(compareLists({ local: synced, remote: synced, remoteSha: 'sha1', base }))
      .toBe('same');
  });

  it('takes the remote when it moved on and we did not', () => {
    const theirs = { id: 'f', updatedAt: '2026-09-01T11:00:00Z' };
    expect(compareLists({ local: synced, remote: theirs, remoteSha: 'sha2', base }))
      .toBe('take-remote');
  });

  it('keeps local when we changed and the remote did not', () => {
    expect(compareLists({ local: edited, remote: synced, remoteSha: 'sha1', base }))
      .toBe('keep-local');
  });

  it('reports a conflict when both moved', () => {
    const theirs = { id: 'f', updatedAt: '2026-09-01T11:00:00Z' };
    expect(compareLists({ local: edited, remote: theirs, remoteSha: 'sha2', base }))
      .toBe('conflict');
  });

  it('takes the remote when there is no local copy', () => {
    expect(compareLists({ local: null, remote: synced, remoteSha: 'sha1', base: null }))
      .toBe('take-remote');
  });

  it('keeps local when there is no remote copy', () => {
    expect(compareLists({ local: edited, remote: null, remoteSha: null, base: null }))
      .toBe('keep-local');
  });

  it('reports a conflict when both exist but this file was never synced', () => {
    expect(compareLists({ local: edited, remote: synced, remoteSha: 'sha1', base: null }))
      .toBe('conflict');
  });
});
