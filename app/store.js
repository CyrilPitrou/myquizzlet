import { swapSides as swapListSides } from './sides.js';
import { resetItems } from './srs.js';

const PREFIX = 'mq:';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const META = ['name', 'folder', 'frontLabel', 'backLabel', 'frontLang', 'backLang'];

function slugify(name) {
  return String(name).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'list';
}

export function recency({ list, progress }) {
  let latest = (list && list.updatedAt) || '';
  for (const item of Object.values((progress && progress.items) || {})) {
    if (item.lastSeen && item.lastSeen > latest) latest = item.lastSeen;
  }
  return latest;
}

export function createStore(storage, now = () => new Date()) {
  const read = (key, fallback) => {
    const raw = storage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  };
  const write = (key, value) => storage.setItem(PREFIX + key, JSON.stringify(value));
  const stamp = () => now().toISOString();

  const index = () => read('index', []);
  const setIndex = (ids) => write('index', ids);

  function markDirty(key) {
    const keys = read('dirty', []);
    if (!keys.includes(key)) write('dirty', keys.concat(key));
  }

  const deleted = () => read('deleted', []);
  const clearDeleted = (id) => write('deleted', deleted().filter((x) => x !== id));

  function newId() {
    let id = '';
    for (let i = 0; i < 6; i++) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return id;
  }

  function getList(id) {
    return read(`list:${id}`, null);
  }

  function saveList(list) {
    const saved = { ...list, updatedAt: stamp() };
    write(`list:${saved.id}`, saved);
    if (!index().includes(saved.id)) setIndex(index().concat(saved.id));
    clearDeleted(saved.id);
    markDirty(`list:${saved.id}`);
    return saved;
  }

  function createList({ name, folder = null, frontLabel = null, backLabel = null,
                        frontLang = null, backLang = null }) {
    const base = slugify(name);
    let id = base;
    for (let n = 2; index().includes(id); n++) id = `${base}-${n}`;
    return saveList({ id, name, folder, frontLabel, backLabel,
                      frontLang, backLang, cards: [] });
  }

  function mutateCards(listId, fn) {
    const list = getList(listId);
    if (!list) throw new Error(`no such list: ${listId}`);
    return saveList({ ...list, cards: fn(list.cards) });
  }

  return {
    newId,
    listIds: index,
    getList,
    saveList,
    createList,
    updateMeta(id, fields) {
      const list = getList(id);
      if (!list) throw new Error(`no such list: ${id}`);
      const patch = {};
      for (const key of META) if (key in fields) patch[key] = fields[key];
      return saveList({ ...list, ...patch });
    },
    renameList(id, name) {
      return this.updateMeta(id, { name });
    },
    folders() {
      const names = new Set();
      for (const id of index()) {
        const list = getList(id);
        if (list && list.folder) names.add(list.folder);
      }
      return [...names].sort((a, b) => a.localeCompare(b));
    },
    deleteList(id) {
      storage.removeItem(`${PREFIX}list:${id}`);
      storage.removeItem(`${PREFIX}progress:${id}`);
      setIndex(index().filter((x) => x !== id));
      if (!deleted().includes(id)) write('deleted', deleted().concat(id));
      markDirty(`list:${id}`);
      markDirty(`progress:${id}`);
    },
    deletedIds: deleted,
    clearDeleted,
    addCards: (listId, cards) => mutateCards(listId, (existing) =>
      existing.concat(cards.map((c) => ({ id: newId(), front: c.front, back: c.back })))),
    updateCard: (listId, cardId, fields) => mutateCards(listId, (cards) =>
      cards.map((c) => (c.id === cardId ? { ...c, ...fields } : c))),
    deleteCard: (listId, cardId) => mutateCards(listId, (cards) =>
      cards.filter((c) => c.id !== cardId)),
    swapSides(id) {
      const list = getList(id);
      if (!list) throw new Error(`no such list: ${id}`);
      const swapped = swapListSides({ list, progress: this.getProgress(id) });
      // mergeProgress resolves per key, newest lastSeen wins. Re-keying an
      // item to the other direction without restamping leaves it with its
      // pre-swap lastSeen, so a peer that hasn't seen this swap yet can beat
      // it at the *old* key and the merge resurrects the pre-swap
      // arrangement. Restamp so the swapped state is unambiguously newer
      // than anything a peer holds. Leave unstudied (lastSeen: null) items
      // alone so they can never outrank a peer's studied record.
      const items = Object.fromEntries(Object.entries(swapped.progress.items)
        .map(([key, item]) => [key, item.lastSeen ? { ...item, lastSeen: stamp() } : item]));
      const savedList = saveList(swapped.list);
      const savedProgress = this.saveProgress({ ...swapped.progress, items });
      return { list: savedList, progress: savedProgress };
    },
    getProgress: (listId) => read(`progress:${listId}`, { listId, updatedAt: null, items: {} }),
    resetProgress(id) {
      const progress = this.getProgress(id);
      const today = stamp().slice(0, 10);
      return this.saveProgress({ ...progress, items: resetItems(progress.items, today, stamp()) });
    },
    saveProgress(progress) {
      const saved = { ...progress, updatedAt: stamp() };
      const list = getList(saved.listId);
      if (list) {
        const live = new Set(list.cards.map((c) => c.id));
        saved.items = Object.fromEntries(Object.entries(saved.items || {})
          .filter(([key]) => live.has(key.slice(0, key.lastIndexOf(':')))));
      }
      write(`progress:${saved.listId}`, saved);
      markDirty(`progress:${saved.listId}`);
      return saved;
    },
    dirtyKeys: () => read('dirty', []),
    markDirty,
    markClean(key) {
      write('dirty', read('dirty', []).filter((k) => k !== key));
    },
    getBase: (key) => read('base', {})[key] || null,
    setBase(key, base) {
      write('base', { ...read('base', {}), [key]: base });
    },
  };
}
