import { ConflictError } from './github.js';
import { mergeProgress, compareLists } from './merge.js';

const listPath = (id) => `data/lists/${id}.json`;
const progressPath = (id) => `data/progress/${id}.json`;

export function createSync({ store, github, onStatus, onConflict, canPush }) {
  let timer = null;

  async function pullList(id) {
    const key = `list:${id}`;
    const remote = await github.getFile(listPath(id));
    const verdict = compareLists({
      local: store.getList(id),
      remote: remote && remote.json,
      remoteSha: remote && remote.sha,
      base: store.getBase(key),
    });
    if (verdict === 'take-remote') {
      const saved = store.saveList(remote.json);
      store.markClean(key);
      store.setBase(key, { sha: remote.sha, updatedAt: saved.updatedAt });
    } else if (verdict === 'same') {
      store.markClean(key);
    } else if (verdict === 'conflict') {
      await new Promise((done) => onConflict({
        listId: id,
        local: store.getList(id),
        remote: remote.json,
        resolve: (choice) => {
          if (choice === 'remote') {
            const saved = store.saveList(remote.json);
            store.markClean(key);
            store.setBase(key, { sha: remote.sha, updatedAt: saved.updatedAt });
          } else {
            store.setBase(key, { sha: remote.sha, updatedAt: null });
            store.markDirty(key);
          }
          done();
        },
      }));
    }
  }

  async function pullProgress(id) {
    const key = `progress:${id}`;
    const remote = await github.getFile(progressPath(id));
    if (!remote) return;
    const merged = mergeProgress(store.getProgress(id), remote.json);
    const saved = store.saveProgress(merged);
    if (JSON.stringify(saved.items) === JSON.stringify(remote.json.items)) store.markClean(key);
    store.setBase(key, { sha: remote.sha, updatedAt: saved.updatedAt });
  }

  async function pullAll() {
    const entries = await github.listDir('data/lists');
    const deleted = store.deletedIds();
    for (const entry of entries) {
      const id = entry.name.replace(/\.json$/, '');
      if (deleted.includes(id)) continue;
      await pullList(id);
      await pullProgress(id);
    }
    for (const id of store.listIds()) {
      if (!entries.some((e) => e.name === `${id}.json`)) store.markDirty(`list:${id}`);
    }
  }

  async function deleteRemote(key) {
    const [kind, id] = key.split(':');
    const path = kind === 'list' ? listPath(id) : progressPath(id);
    const base = store.getBase(key);
    let sha = base && base.sha;
    if (!sha) {
      const remote = await github.getFile(path);
      sha = remote && remote.sha;
    }
    if (sha) await github.deleteFile(path, sha, `delete ${kind} ${id}`);
    store.setBase(key, null);
    store.markClean(key);
  }

  async function pushOne(key) {
    const [kind, id] = key.split(':');
    if (store.deletedIds().includes(id)) return deleteRemote(key);
    const path = kind === 'list' ? listPath(id) : progressPath(id);
    const payload = kind === 'list' ? store.getList(id) : store.getProgress(id);
    if (!payload) { store.markClean(key); return; }
    const base = store.getBase(key);
    const { sha } = await github.putFile(path, payload, base && base.sha,
      `${kind === 'list' ? 'update list' : 'update progress'} ${id}`);
    store.setBase(key, { sha, updatedAt: payload.updatedAt });
    store.markClean(key);
  }

  async function pushDirty() {
    for (const key of store.dirtyKeys()) {
      try {
        await pushOne(key);
      } catch (error) {
        if (error instanceof ConflictError) {
          const [kind, id] = key.split(':');
          if (store.deletedIds().includes(id)) {
            store.setBase(key, null);   // forces deleteRemote to re-read the live sha
            await pushOne(key);
          } else if (kind === 'progress') { await pullProgress(id); await pushOne(key); }
          else { await pullList(id); await pushOne(key); }
        } else {
          throw error;
        }
      }
    }
    for (const id of store.deletedIds()) {
      const outstanding = store.dirtyKeys().some((key) => key.endsWith(`:${id}`));
      if (!outstanding) store.clearDeleted(id);
    }
  }

  async function syncNow() {
    if (!navigator.onLine) return onStatus('offline');
    try {
      onStatus('syncing');
      await pullAll();
      if (canPush) await pushDirty();
      onStatus(!canPush ? 'off' : store.dirtyKeys().length ? 'pending' : 'synced');
    } catch (error) {
      onStatus('error', error.message);
    }
  }

  return {
    pullAll,
    pushDirty,
    syncNow,
    schedule() {
      clearTimeout(timer);
      onStatus('pending');
      timer = setTimeout(syncNow, 4000);
    },
    stop() {
      clearTimeout(timer);
    },
  };
}
