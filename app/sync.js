import { ConflictError } from './github.js';
import { mergeProgress, compareLists, listUnchanged } from './merge.js';

const listPath = (id) => `data/lists/${id}.json`;
const progressPath = (id) => `data/progress/${id}.json`;

export function createSync({ store, github, onStatus, onConflict, canPush }) {
  let timer = null;
  let running = null;
  let again = false;

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
    // The progress directory is listed too, rather than guessed at: most
    // lists have no progress file yet, and asking for each one by name spent
    // a request per list to be told 404. One listing answers for all of them,
    // and carries the shas that say which of the rest are worth reading.
    const progressShas = new Map((await github.listDir('data/progress'))
      .map((entry) => [entry.name.replace(/\.json$/, ''), entry.sha]));
    const deleted = store.deletedIds();
    for (const entry of entries) {
      const id = entry.name.replace(/\.json$/, '');
      if (deleted.includes(id)) continue;
      const listKey = `list:${id}`;
      if (listUnchanged({ local: store.getList(id), remoteSha: entry.sha, base: store.getBase(listKey) })) {
        store.markClean(listKey);
      } else {
        await pullList(id);
      }
      // A progress file the remote does not have has nothing to merge, and
      // one whose sha has not moved holds exactly what was merged last time.
      const progressSha = progressShas.get(id);
      const progressBase = store.getBase(`progress:${id}`);
      if (progressSha && !(progressBase && progressBase.sha === progressSha)) await pullProgress(id);
    }
    // A list the remote does not have is one of two very different things.
    // If we have never had a sha for it, it is ours and was never uploaded,
    // so upload it. If we do have one, we and the remote agreed on this file
    // once and it is gone now: another device deleted it, and re-uploading it
    // would resurrect it — which is how a delete on one device kept coming
    // back on the other. Follow the deletion instead.
    //
    // An empty listing is not evidence of anything: a 404 on data/lists reads
    // the same whether every list was deleted or the token lost access to the
    // repo. Reconciling on it would wipe the device. Skip it; the last list
    // to be deleted simply needs its delete pushed from each device.
    if (!entries.length) return;
    for (const id of store.listIds()) {
      if (entries.some((e) => e.name === `${id}.json`)) continue;
      if (store.getBase(`list:${id}`)) store.deleteList(id);
      else store.markDirty(`list:${id}`);
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

  async function sweep() {
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

  // A phone asks for a sync every time it comes back to the app, and a sweep
  // over a few hundred lists easily outlives several of those. Left alone,
  // each request started another sweep beside the one already running: they
  // took each other's bandwidth, the dot never stopped spinning, and nothing
  // was ever repainted. So only one sweep runs. A request that arrives during
  // one does not start a second and does not vanish either — it is served by
  // one more sweep afterwards, which is what an edit made mid-sweep needs to
  // be pushed at all.
  function syncNow() {
    if (running) { again = true; return running; }
    running = (async () => {
      do {
        again = false;
        await sweep();
      } while (again);
    })().finally(() => { running = null; });
    return running;
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
