// Pure profile helpers. A profile is a named user identity whose progress
// is tracked independently. Lists are shared; progress is per-profile.

export const EMOJIS = [
  '😀', '🐻', '🦊', '🐱', '🐶', '🦁', '🐸', '🐧',
  '🌟', '🌈', '🎵', '🎮', '📚', '⚡', '🔥', '🍀',
  '🧑', '👧', '👦', '👤',
];

export function slugifyProfile(name) {
  return String(name).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'profile';
}

export function uniqueProfileId(name, existingIds = []) {
  const base = slugifyProfile(name);
  if (!existingIds.includes(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!existingIds.includes(candidate)) return candidate;
  }
}

export function createProfile(name, emoji, existingProfiles = []) {
  const existingIds = existingProfiles.map((p) => p.id);
  return {
    id: uniqueProfileId(name, existingIds),
    name: name.trim(),
    emoji,
  };
}

export function validateProfileName(name, existingProfiles = [], excludeId = null) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'empty';
  if (existingProfiles.some((p) =>
    p.id !== excludeId && p.name.toLowerCase() === trimmed.toLowerCase())) {
    return 'duplicate';
  }
  return null;
}

export function mergeProfiles(local, remote) {
  if (!remote || !remote.length) return local || [];
  if (!local || !local.length) return remote;
  const map = new Map();
  for (const p of local) map.set(p.id, p);
  for (const rp of remote) {
    const lp = map.get(rp.id);
    if (!lp) {
      map.set(rp.id, rp);
    } else {
      if (rp.updatedAt && (!lp.updatedAt || rp.updatedAt >= lp.updatedAt)) {
        map.set(rp.id, { ...lp, ...rp });
      }
    }
  }
  return [...map.values()];
}
