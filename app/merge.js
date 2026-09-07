const seenAt = (item) => (item && item.lastSeen ? item.lastSeen : '');
const itemRank = (item) => JSON.stringify(Object.keys(item || {}).sort()
  .map((key) => [key, item[key]]));
const recordRank = (record) => JSON.stringify(Object.keys(record || {}).sort()
  .map((key) => [key, record[key]]));

function itemIsNewer(candidate, current) {
  const candidateSeen = seenAt(candidate);
  const currentSeen = seenAt(current);
  if (candidateSeen !== currentSeen) return candidateSeen > currentSeen;
  // Equal millisecond timestamps have no temporal winner. A stable content
  // tiebreaker makes the merge commutative so every device still converges.
  return itemRank(candidate) > itemRank(current);
}

export function mergeProgress(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const items = { ...remote.items };
  for (const [key, mine] of Object.entries(local.items || {})) {
    const theirs = items[key];
    if (!theirs || itemIsNewer(mine, theirs)) items[key] = mine;
  }
  const updatedAt = (local.updatedAt || '') > (remote.updatedAt || '')
    ? local.updatedAt : remote.updatedAt;
  return { listId: local.listId || remote.listId, updatedAt, items };
}

export function compareLists({ local, remote, remoteSha, base }) {
  if (!local) return 'take-remote';
  if (!remote) return 'keep-local';
  if (!base) return 'conflict';
  const remoteMoved = remoteSha !== base.sha;
  const localChanged = local.updatedAt !== base.updatedAt;
  if (!remoteMoved && !localChanged) return 'same';
  if (remoteMoved && !localChanged) return 'take-remote';
  if (!remoteMoved && localChanged) return 'keep-local';
  return 'conflict';
}

// A directory listing already carries every file's sha, which is all the
// comparison above needs when nothing has moved: a list whose remote sha
// still matches the base, and whose local copy has not been touched since,
// can only be 'same'. Saying so from the listing saves downloading the file
// to learn nothing — the difference between one request a sync and one per
// list, which is what a few hundred lists on a phone turns into.
export function listUnchanged({ local, remoteSha, base }) {
  return Boolean(local && base && remoteSha === base.sha && local.updatedAt === base.updatedAt);
}

export function mergeProfiles(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const localList = Array.isArray(local) ? local : (local.profiles || []);
  const remoteList = Array.isArray(remote) ? remote : (remote.profiles || []);
  const localDeleted = Array.isArray(local) ? [] : (local.deletedProfiles || []);
  const remoteDeleted = Array.isArray(remote) ? [] : (remote.deletedProfiles || []);
  const map = new Map();
  for (const p of localList) map.set(p.id, p);
  for (const rp of remoteList) {
    const lp = map.get(rp.id);
    if (!lp) {
      map.set(rp.id, rp);
    } else {
      const remoteTime = rp.updatedAt || '';
      const localTime = lp.updatedAt || '';
      if (remoteTime > localTime
          || (remoteTime === localTime && recordRank(rp) > recordRank(lp))) {
        map.set(rp.id, { ...lp, ...rp });
      }
    }
  }
  const deleted = new Map();
  for (const entry of localDeleted.concat(remoteDeleted)) {
    const previous = deleted.get(entry.id);
    if (!previous || (entry.updatedAt || '') > (previous.updatedAt || '')) deleted.set(entry.id, entry);
  }
  // A deletion is a first-class change: without this filter, a device which
  // has not yet synced can re-add a profile another device removed.
  const mergedProfiles = [...map.values()].filter((profile) => {
    const removed = deleted.get(profile.id);
    return !removed || (profile.updatedAt || '') > (removed.updatedAt || '');
  });
  if (Array.isArray(local) && Array.isArray(remote)) return mergedProfiles;
  const updatedAt = ((local && local.updatedAt) || '') > ((remote && remote.updatedAt) || '')
    ? local.updatedAt : (remote && remote.updatedAt) || '';
  return { updatedAt, profiles: mergedProfiles, deletedProfiles: [...deleted.values()] };
}
