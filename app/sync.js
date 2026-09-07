import { ConflictError } from './github.js';
import { mergeProgress, compareLists, listUnchanged, mergeProfiles } from './merge.js';

const listPath = (id) => `data/lists/${id}.json`;
const progressPath = (id, profileId = 'default') => `data/progress/${profileId}/${id}.json`;

export function createSync({ store, github, onStatus, onConflict, canPush }) {
  let timer = null;
  let running = null;
  let again = false;
  // Flat progress files are read as Default-profile progress, then moved on
  // the next push. This small in-memory queue only lasts for the current
  // sweep; an interrupted move is safe because the old file is discovered
  // again on the next pull.
  const legacyProgress = new Map();

  async function pullProfiles() {
    const key = 'profiles';
    const base = store.getBase(key);
    const remote = await github.getFile('data/profiles.json');
    if (!remote) {
      store.setBase(key, { sha: 'none', updatedAt: null, progressResetAt: null });
      return;
    }
    // An unchanged remote sha says nothing about local edits. Clearing a dirty
    // key here would lose creates, renames and tombstones before pushDirty().
    if (base && base.sha === remote.sha) return;
    const localProfiles = store.getProfiles();
    const resetAdvanced = remote.json.progressResetAt
      && (!base || base.progressResetAt !== remote.json.progressResetAt);
    if (resetAdvanced && store.purgeProfileProgress) store.purgeProfileProgress('default');
    const merged = mergeProfiles({
      profiles: localProfiles,
      deletedProfiles: store.deletedProfileTombstones ? store.deletedProfileTombstones() : [],
      updatedAt: base && base.updatedAt,
    }, remote.json);
    store.saveProfiles(merged.profiles);
    if (store.saveDeletedProfileTombstones) store.saveDeletedProfileTombstones(merged.deletedProfiles || []);
    if (store.purgeProfileProgress && store.deletedProfileIds) {
      for (const profileId of store.deletedProfileIds()) store.purgeProfileProgress(profileId);
    }
    if (JSON.stringify(merged.profiles) === JSON.stringify(remote.json.profiles)
        && JSON.stringify(merged.deletedProfiles || []) === JSON.stringify(remote.json.deletedProfiles || [])) {
      store.markClean(key);
    }
    store.setBase(key, {
      sha: remote.sha,
      updatedAt: merged.updatedAt,
      progressResetAt: remote.json.progressResetAt || null,
    });
  }

  async function pushProfiles() {
    const key = 'profiles';
    const base = store.getBase(key);
    const payload = {
      updatedAt: new Date().toISOString(),
      profiles: store.getProfiles(),
      deletedProfiles: store.deletedProfileTombstones ? store.deletedProfileTombstones() : [],
      ...(base && base.progressResetAt ? { progressResetAt: base.progressResetAt } : {}),
    };
    const { sha } = await github.putFile('data/profiles.json', payload, base && base.sha !== 'none' ? base.sha : null, 'update profiles');
    store.setBase(key, { sha, updatedAt: payload.updatedAt });
    store.markClean(key);
  }

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

  async function pullProgress(id, profileId = 'default', remotePath = null, legacy = false) {
    const key = `progress:${profileId}:${id}`;
    const path = remotePath || progressPath(id, profileId);
    const remote = await github.getFile(path);
    if (!remote) return;
    const merged = mergeProgress(store.getProgress(id, profileId), remote.json);
    const saved = store.saveProgress(merged, profileId);
    if (legacy) {
      // Its sha belongs to the old path, so it must never be used as the sha
      // for the new nested file. Keep it only to avoid re-reading unchanged
      // legacy data before this sweep gets a chance to move it.
      store.setBase(key, { sha: remote.sha, updatedAt: saved.updatedAt, legacy: true });
      legacyProgress.set(id, { path, sha: remote.sha });
    } else {
      if (JSON.stringify(saved.items) === JSON.stringify(remote.json.items)) store.markClean(key);
      store.setBase(key, { sha: remote.sha, updatedAt: saved.updatedAt });
    }
  }

  async function pullAll() {
    const listsPromise = github.listDir('data/lists');
    await pullProfiles();
    const entries = await listsPromise;
    const rawProgress = await (github.listEntries ? github.listEntries('data/progress') : github.listDir('data/progress'));
    const remoteProgressFiles = [];
    for (const item of rawProgress) {
      if (item.type === 'dir') {
        const sub = await github.listDir(item.path || `data/progress/${item.name}`);
        for (const file of sub) {
          if (file.name.endsWith('.json')) {
            remoteProgressFiles.push({
              profileId: item.name,
              listId: file.name.replace(/\.json$/, ''),
              path: file.path || `data/progress/${item.name}/${file.name}`,
              sha: file.sha,
            });
          }
        }
      } else if (item.path && item.path.split('/').length === 4) {
        const parts = item.path.split('/');
        remoteProgressFiles.push({
          profileId: parts[2],
          listId: parts[3].replace(/\.json$/, ''),
          path: item.path,
          sha: item.sha,
        });
      } else if (item.name.endsWith('.json')) {
        remoteProgressFiles.push({
          profileId: 'default',
          listId: item.name.replace(/\.json$/, ''),
          path: item.path || `data/progress/${item.name}`,
          sha: item.sha,
          isOldPath: true,
        });
      }
    }

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
    }

    const deletedProfiles = new Set(store.deletedProfileIds ? store.deletedProfileIds() : []);
    for (const { profileId, listId, path, sha, isOldPath } of remoteProgressFiles) {
      if (deleted.includes(listId)) continue;
      if (deletedProfiles.has(profileId)) continue;
      // Once a nested file exists, it is authoritative; do not merge its
      // already-migrated flat predecessor a second time.
      if (isOldPath && remoteProgressFiles.some((entry) => !entry.isOldPath
        && entry.profileId === profileId && entry.listId === listId)) continue;
      const key = `progress:${profileId}:${listId}`;
      const base = store.getBase(key) || (isOldPath ? store.getBase(`progress:${listId}`) : null);
      if (!(base && base.sha === sha)) {
        await pullProgress(listId, profileId, path, isOldPath);
      }
    }

    for (const id of store.listIds()) {
      if (entries.some((e) => e.name === `${id}.json`)) continue;
      if (store.getBase(`list:${id}`)) store.deleteList(id);
      else store.markDirty(`list:${id}`);
    }
  }

  function parseKey(key) {
    const parts = key.split(':');
    const kind = parts[0];
    if (kind === 'list') return { kind, id: parts[1], listId: parts[1] };
    if (kind === 'progress') {
      if (parts.length === 3) return { kind, profileId: parts[1], id: parts[2], listId: parts[2] };
      return { kind, profileId: 'default', id: parts[1], listId: parts[1] };
    }
    return { kind, id: parts[1], listId: parts[1] };
  }

  async function deleteRemote(key) {
    const { kind, id, profileId } = parseKey(key);
    if (kind === 'list') {
      const path = listPath(id);
      const base = store.getBase(key);
      let sha = base && base.sha;
      if (!sha) {
        const remote = await github.getFile(path);
        sha = remote && remote.sha;
      }
      if (sha) await github.deleteFile(path, sha, `delete ${kind} ${id}`);
      store.setBase(key, null);
      store.markClean(key);
    } else {
      const nestedPath = progressPath(id, profileId);
      const flatPath = `data/progress/${id}.json`;
      const paths = [nestedPath, flatPath];
      for (const path of paths) {
        const base = store.getBase(key) || store.getBase(`progress:${id}`);
        // A nested progress sha cannot delete the old flat file, and a
        // legacy sha cannot create or delete the nested one. Look up the
        // opposite path so each DELETE carries that file's own sha.
        let sha = path === nestedPath
          ? (base && !base.legacy && base.sha)
          : (base && base.legacy && base.sha);
        if (!sha) {
          const remote = await github.getFile(path);
          sha = remote && remote.sha;
        }
        if (sha) await github.deleteFile(path, sha, `delete progress ${id}`);
      }
      store.setBase(key, null);
      store.setBase(`progress:${id}`, null);
      store.markClean(key);
    }
  }

  async function pushOne(key) {
    if (key === 'profiles') return pushProfiles();
    const { kind, id, profileId, listId } = parseKey(key);
    if (store.deletedIds().includes(listId)) return deleteRemote(key);
    const path = kind === 'list' ? listPath(id) : `data/progress/${profileId}/${id}.json`;
    const payload = kind === 'list' ? store.getList(id) : store.getProgress(id, profileId);
    if (!payload) { store.markClean(key); return; }
    const base = store.getBase(key);
    const { sha } = await github.putFile(path, payload, base && !base.legacy && base.sha,
      `${kind === 'list' ? 'update list' : 'update progress'} ${id}`);
    store.setBase(key, { sha, updatedAt: payload.updatedAt });
    store.markClean(key);
  }

  async function deleteRemoteProfile(profileId) {
    const path = `data/progress/${profileId}`;
    const entries = await github.listDir(path);
    for (const entry of entries) {
      if (entry.name.endsWith('.json')) {
        await github.deleteFile(entry.path || `${path}/${entry.name}`, entry.sha,
          `delete progress for ${profileId}`);
      }
    }
  }

  async function deleteLegacyProgress() {
    for (const [id, { path, sha }] of legacyProgress) {
      await github.deleteFile(path, sha, `move progress ${id} to default profile`);
      legacyProgress.delete(id);
    }
  }

  async function pushDirty() {
    for (const key of store.dirtyKeys()) {
      try {
        await pushOne(key);
      } catch (error) {
        if (error instanceof ConflictError) {
          const { kind, id, profileId, listId } = parseKey(key);
          if (store.deletedIds().includes(listId)) {
            store.setBase(key, null);   // forces deleteRemote to re-read the live sha
            await pushOne(key);
          } else if (kind === 'progress') { await pullProgress(id, profileId); await pushOne(key); }
          else if (kind === 'profiles') { await pullProfiles(); await pushOne(key); }
          else { await pullList(id); await pushOne(key); }
        } else {
          throw error;
        }
      }
    }
    for (const profileId of store.deletedProfileIds ? store.deletedProfileIds() : []) {
      await deleteRemoteProfile(profileId);
    }
    await deleteLegacyProgress();
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
