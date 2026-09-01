# MyQuizzlet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A personal Quizlet-like vocabulary trainer — word lists, flashcards, typed answers, Leitner scheduling — running as a static site on GitHub Pages, usable on macOS and Android, with lists and progress synced through JSON files in the same repo.

**Architecture:** Plain ES modules loaded directly by the browser, no build step. `main.js` owns the DOM; `store.js` owns browser storage; `github.js` owns the network; `srs.js`, `grade.js`, `csv.js` and `merge.js` are pure and fully unit-tested. A study session touches only the working copy in `localStorage`; syncing to the repo's `data` branch happens outside the answer loop.

**Tech Stack:** HTML, CSS, vanilla JavaScript (ES modules). Vitest for tests (dev-only). GitHub Pages for hosting, GitHub contents API for storage. No runtime dependencies whatsoever.

**Spec:** `devnotes/2026-09-01-myquizzlet-design.md` — read it before starting. This plan implements it and does not repeat its reasoning.

## Global Constraints

Every task's requirements implicitly include these. They come from the spec and from `CLAUDE.md`.

- **No build step.** Source files are served as-is. Never add a bundler, transpiler, framework, or `<script src="https://cdn...">`. `git push` is the deploy.
- **No runtime dependencies.** `package.json` may contain `vitest` as a devDependency and nothing else. The browser loads only files from this repo.
- **ES modules only.** `import` / `export`, `<script type="module">`. Requires a local http server for development: `python3 -m http.server 8000`.
- **Pure modules take their inputs as arguments** — including today's date. Never call `new Date()` inside `srs.js`, `grade.js`, `csv.js` or `merge.js`; tests must be able to time-travel.
- **Repo:** `CyrilPitrou/myquizzlet`, public. Code on `main`, data on the `data` branch under `data/lists/` and `data/progress/`.
- **Dates:** `due` is a `YYYY-MM-DD` string. `updatedAt` and `lastSeen` are ISO-8601 UTC timestamps (`2026-09-01T14:03:00Z`).
- **Card ids are permanent.** Never regenerate an id for an existing card.
- **Never write a token to a file in this repo.** Tokens live only in `localStorage`.
- **Leitner intervals:** `[1, 3, 7, 16, 35]` days for boxes 1–5.
- **Direction keys:** `f2b` (front shown, back expected) and `b2f`. Progress item key is `` `${cardId}:${direction}` ``.
- **Commits:** conventional prefixes (`feat:`, `test:`, `fix:`, `docs:`, `chore:`). Commit at the end of every task.

## Stages, and where to stop

The twelve tasks group into four stages. Each stage ends with an app that works
and is committed, and needs nothing from the conversation that built the previous
one — so the context can be cleared between stages, and only between them.

| Stage | Tasks | Ends with |
|---|---|---|
| **A — Local core** | 1–4 | Lists and cards on one device: create, edit, import CSV. No studying yet. |
| **B — Studying** | 5–7 | Flashcards, typed answers and Leitner scheduling. A genuinely usable app, one device only. |
| **C — Sync** | 8–10 | Lists and progress shared through GitHub, with a status indicator and a Settings screen. |
| **D — Install** | 11–12 | Conflict resolution and a real installable app on Android. |

Do not clear mid-stage: tasks within a stage share interfaces that are easier to
keep straight in one sitting. At each stage boundary, `npm test` passes and the
app runs.

## File Structure

```
index.html          shell; loads app/main.js as a module
app/
  main.js           screens, routing, all DOM work
  ui.js             tiny DOM helpers shared by screens (el, clear, on)
  store.js          working copy in localStorage; the only storage toucher
  github.js         GitHub contents API; the only network toucher
  sync.js           orchestration: pull, merge, push, status
  srs.js            pure: Leitner scheduling
  grade.js          pure: answer checking
  csv.js            pure: CSV/TSV parsing and serialising
  merge.js          pure: progress and list merge rules
  style.css
test/
  csv.test.js  grade.test.js  srs.test.js  merge.test.js  store.test.js
manifest.webmanifest
sw.js
icons/icon-192.png  icons/icon-512.png
package.json
```

`ui.js` and `sync.js` are not named in the spec's module list; they exist because
`main.js` would otherwise carry both DOM plumbing and sync orchestration, and the
spec requires each file to have one job. Note them in `CLAUDE.md` when Task 1
runs.

---

### Task 1: Project skeleton and test harness

**Files:**
- Create: `package.json`, `index.html`, `app/style.css`, `app/ui.js`, `app/main.js`, `.gitignore`
- Modify: `CLAUDE.md` (module list)

**Interfaces:**
- Consumes: nothing.
- Produces: `ui.js` exports `el(tag, props, children) -> HTMLElement`, `clear(node) -> void`, `$(selector) -> HTMLElement`. `main.js` exports nothing; it self-starts on load.

- [ ] **Step 1: Initialise git and npm**

```bash
git init
npm init -y
npm install --save-dev vitest
npm pkg set scripts.test="vitest run" scripts.dev="python3 -m http.server 8000" type="module"
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
.DS_Store
```

- [ ] **Step 3: Write a smoke test proving the harness runs**

`test/smoke.test.js`:

```javascript
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: 1 test passing.

- [ ] **Step 5: Write `app/ui.js`**

```javascript
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export const $ = (selector) => document.querySelector(selector);
```

- [ ] **Step 6: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>MyQuizzlet</title>
  <link rel="stylesheet" href="app/style.css">
</head>
<body>
  <header id="topbar"><h1>MyQuizzlet</h1><span id="sync-dot" title="not configured">○</span></header>
  <main id="screen"></main>
  <script type="module" src="app/main.js"></script>
</body>
</html>
```

- [ ] **Step 7: Write `app/main.js` as a placeholder that proves modules load**

```javascript
import { el, clear, $ } from './ui.js';

function render() {
  const screen = $('#screen');
  clear(screen);
  screen.append(el('p', { text: 'MyQuizzlet is alive.' }));
}

render();
```

- [ ] **Step 8: Write `app/style.css`**

Mobile-first, system fonts, large tap targets. Minimum: `body { margin: 0; font: 16px/1.5 system-ui, sans-serif; }`, `button { min-height: 44px; font-size: 1rem; }`, `main { padding: 1rem; max-width: 40rem; margin: 0 auto; }`, `#topbar { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; border-bottom: 1px solid #ddd; }`.

- [ ] **Step 9: Verify in a browser**

Run: `npm run dev`, open `http://localhost:8000`.
Expected: "MyQuizzlet is alive." with no console errors. A module error here means the http server was skipped.

- [ ] **Step 10: Record the two extra modules in `CLAUDE.md`**

Add `ui.js` (shared DOM helpers) and `sync.js` (pull/merge/push orchestration) to the layout block, so future sessions do not think they are strays.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: project skeleton, vitest harness, app shell"
```

---

### Task 2: `csv.js` — importing and exporting cards

**Files:**
- Create: `app/csv.js`, `test/csv.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseCards(text) -> { cards: [{ front, back }], errors: [{ line, reason }] }` and `toCsv(cards) -> string`. Cards carry no `id` — `store.js` assigns those.

Delimiter is auto-detected per line: a tab if present, otherwise a comma. This is what makes both a spreadsheet paste and a `.csv` file work with one function.

- [ ] **Step 1: Write the failing tests**

`test/csv.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { parseCards, toCsv } from '../app/csv.js';

describe('parseCards', () => {
  it('parses comma-separated pairs', () => {
    expect(parseCards('el pan,le pain\nla leche,le lait').cards)
      .toEqual([{ front: 'el pan', back: 'le pain' }, { front: 'la leche', back: 'le lait' }]);
  });

  it('parses tab-separated pairs pasted from a spreadsheet', () => {
    expect(parseCards('el pan\tle pain').cards).toEqual([{ front: 'el pan', back: 'le pain' }]);
  });

  it('respects quotes around a field containing the delimiter', () => {
    expect(parseCards('"pan, integral",pain complet').cards)
      .toEqual([{ front: 'pan, integral', back: 'pain complet' }]);
  });

  it('joins extra columns into the back field', () => {
    expect(parseCards('a,b,c').cards).toEqual([{ front: 'a', back: 'b,c' }]);
  });

  it('trims surrounding whitespace', () => {
    expect(parseCards('  el pan ,  le pain  ').cards).toEqual([{ front: 'el pan', back: 'le pain' }]);
  });

  it('skips blank lines without reporting them', () => {
    const result = parseCards('a,b\n\n   \nc,d');
    expect(result.cards).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it('reports a line with no delimiter instead of throwing', () => {
    const result = parseCards('a,b\noops\nc,d');
    expect(result.cards).toHaveLength(2);
    expect(result.errors).toEqual([{ line: 2, reason: 'no separator found' }]);
  });

  it('reports a line with an empty side', () => {
    expect(parseCards('a,').errors).toEqual([{ line: 1, reason: 'empty side' }]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCards('a,b\r\nc,d').cards).toHaveLength(2);
  });
});

describe('toCsv', () => {
  it('round-trips through parseCards', () => {
    const cards = [{ front: 'el pan', back: 'le pain' }, { front: 'pan, integral', back: 'complet' }];
    expect(parseCards(toCsv(cards)).cards).toEqual(cards);
  });

  it('quotes fields containing a comma or a quote', () => {
    expect(toCsv([{ front: 'a,b', back: 'say "hi"' }])).toBe('"a,b","say ""hi"""');
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `npx vitest run test/csv.test.js`
Expected: FAIL — `Failed to resolve import "../app/csv.js"`.

- [ ] **Step 3: Implement `app/csv.js`**

```javascript
function splitLine(line, delimiter) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      fields.push(field); field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

export function parseCards(text) {
  const cards = [];
  const errors = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    const delimiter = line.includes('\t') ? '\t' : ',';
    const fields = splitLine(line, delimiter);
    if (fields.length < 2) {
      errors.push({ line: index + 1, reason: 'no separator found' });
      return;
    }
    const front = fields[0];
    const back = fields.slice(1).join(delimiter);
    if (front === '' || back === '') {
      errors.push({ line: index + 1, reason: 'empty side' });
      return;
    }
    cards.push({ front, back });
  });
  return { cards, errors };
}

function quote(value) {
  return /[",\n\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(cards) {
  return cards.map((c) => `${quote(c.front)},${quote(c.back)}`).join('\n');
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/csv.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add app/csv.js test/csv.test.js
git commit -m "feat: CSV/TSV card import and export"
```

---

### Task 3: `store.js` — the working copy

**Files:**
- Create: `app/store.js`, `test/store.test.js`
- Delete: `test/smoke.test.js` (its job is done)

**Interfaces:**
- Consumes: nothing.
- Produces: `createStore(storage, now)` where `storage` is a `localStorage`-shaped object (`getItem`, `setItem`, `removeItem`) and `now` is a `() => Date` injected for tests. Returns an object with:
  - `listIds() -> string[]`
  - `getList(id) -> list | null`
  - `createList({ name, frontLang, backLang }) -> list`
  - `saveList(list) -> list` (stamps `updatedAt`, marks dirty)
  - `deleteList(id) -> void`
  - `addCards(listId, [{ front, back }]) -> list`
  - `updateCard(listId, cardId, { front, back }) -> list`
  - `deleteCard(listId, cardId) -> list`
  - `getProgress(listId) -> { listId, updatedAt, items }`
  - `saveProgress(progress) -> progress`
  - `dirtyKeys() -> string[]`, `markClean(key) -> void`, `markDirty(key) -> void`
  - `newId() -> string`
- Storage keys: `mq:index` (array of list ids), `mq:list:<id>`, `mq:progress:<id>`, `mq:dirty` (array of keys such as `list:es-food`).

- [ ] **Step 1: Write the failing tests**

`test/store.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../app/store.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const FIXED = new Date('2026-09-01T14:03:00Z');
let storage, store;

beforeEach(() => {
  storage = fakeStorage();
  store = createStore(storage, () => FIXED);
});

describe('lists', () => {
  it('starts empty', () => {
    expect(store.listIds()).toEqual([]);
  });

  it('creates a list with an id derived from the name', () => {
    const list = store.createList({ name: 'Spanish – Food' });
    expect(list.id).toBe('spanish-food');
    expect(list.cards).toEqual([]);
    expect(store.listIds()).toEqual(['spanish-food']);
  });

  it('avoids colliding ids', () => {
    store.createList({ name: 'Food' });
    expect(store.createList({ name: 'Food' }).id).toBe('food-2');
  });

  it('stamps updatedAt on save', () => {
    const list = store.createList({ name: 'Food' });
    expect(list.updatedAt).toBe('2026-09-01T14:03:00.000Z');
  });

  it('round-trips through storage', () => {
    store.createList({ name: 'Food', frontLang: 'es', backLang: 'fr' });
    const reloaded = createStore(storage, () => FIXED);
    expect(reloaded.getList('food').frontLang).toBe('es');
  });

  it('returns null for an unknown list', () => {
    expect(store.getList('nope')).toBe(null);
  });

  it('deletes a list and its progress', () => {
    store.createList({ name: 'Food' });
    store.saveProgress({ listId: 'food', items: { 'a:f2b': { box: 1 } } });
    store.deleteList('food');
    expect(store.listIds()).toEqual([]);
    expect(storage.getItem('mq:progress:food')).toBe(null);
  });
});

describe('cards', () => {
  beforeEach(() => store.createList({ name: 'Food' }));

  it('adds cards with generated ids', () => {
    const list = store.addCards('food', [{ front: 'el pan', back: 'le pain' }]);
    expect(list.cards).toHaveLength(1);
    expect(list.cards[0].id).toMatch(/^[a-z0-9]{6}$/);
  });

  it('gives each card a distinct id', () => {
    const list = store.addCards('food', [{ front: 'a', back: 'b' }, { front: 'c', back: 'd' }]);
    expect(list.cards[0].id).not.toBe(list.cards[1].id);
  });

  it('keeps the id when a card is edited', () => {
    const id = store.addCards('food', [{ front: 'a', back: 'b' }]).cards[0].id;
    const list = store.updateCard('food', id, { front: 'A', back: 'B' });
    expect(list.cards[0]).toEqual({ id, front: 'A', back: 'B' });
  });

  it('deletes a card', () => {
    const id = store.addCards('food', [{ front: 'a', back: 'b' }]).cards[0].id;
    expect(store.deleteCard('food', id).cards).toEqual([]);
  });
});

describe('progress', () => {
  it('returns an empty record for a list never studied', () => {
    expect(store.getProgress('food')).toEqual({ listId: 'food', updatedAt: null, items: {} });
  });

  it('saves and reloads progress', () => {
    store.saveProgress({ listId: 'food', items: { 'a:f2b': { box: 2 } } });
    expect(store.getProgress('food').items['a:f2b'].box).toBe(2);
  });

  it('stamps updatedAt on save', () => {
    expect(store.saveProgress({ listId: 'food', items: {} }).updatedAt)
      .toBe('2026-09-01T14:03:00.000Z');
  });

  it('prunes progress for cards that no longer exist', () => {
    store.createList({ name: 'Food' });
    const id = store.addCards('food', [{ front: 'a', back: 'b' }]).cards[0].id;
    store.saveProgress({ listId: 'food', items: { [`${id}:f2b`]: { box: 1 }, 'gone:f2b': { box: 1 } } });
    expect(Object.keys(store.getProgress('food').items)).toEqual([`${id}:f2b`]);
  });
});

describe('dirty tracking', () => {
  it('marks a created list dirty', () => {
    store.createList({ name: 'Food' });
    expect(store.dirtyKeys()).toEqual(['list:food']);
  });

  it('marks progress dirty separately', () => {
    store.createList({ name: 'Food' });
    store.saveProgress({ listId: 'food', items: {} });
    expect(store.dirtyKeys().sort()).toEqual(['list:food', 'progress:food']);
  });

  it('does not duplicate a key saved twice', () => {
    const list = store.createList({ name: 'Food' });
    store.saveList(list);
    expect(store.dirtyKeys()).toEqual(['list:food']);
  });

  it('clears a key once pushed', () => {
    store.createList({ name: 'Food' });
    store.markClean('list:food');
    expect(store.dirtyKeys()).toEqual([]);
  });

  it('survives a reload', () => {
    store.createList({ name: 'Food' });
    expect(createStore(storage, () => FIXED).dirtyKeys()).toEqual(['list:food']);
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `npx vitest run test/store.test.js`
Expected: FAIL — cannot resolve `../app/store.js`.

- [ ] **Step 3: Implement `app/store.js`**

```javascript
const PREFIX = 'mq:';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function slugify(name) {
  return String(name).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'list';
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
    markDirty(`list:${saved.id}`);
    return saved;
  }

  function createList({ name, frontLang = null, backLang = null }) {
    const base = slugify(name);
    let id = base;
    for (let n = 2; index().includes(id); n++) id = `${base}-${n}`;
    return saveList({ id, name, frontLang, backLang, cards: [] });
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
    deleteList(id) {
      storage.removeItem(`${PREFIX}list:${id}`);
      storage.removeItem(`${PREFIX}progress:${id}`);
      setIndex(index().filter((x) => x !== id));
      markDirty(`list:${id}`);
      markDirty(`progress:${id}`);
    },
    addCards: (listId, cards) => mutateCards(listId, (existing) =>
      existing.concat(cards.map((c) => ({ id: newId(), front: c.front, back: c.back })))),
    updateCard: (listId, cardId, fields) => mutateCards(listId, (cards) =>
      cards.map((c) => (c.id === cardId ? { ...c, ...fields } : c))),
    deleteCard: (listId, cardId) => mutateCards(listId, (cards) =>
      cards.filter((c) => c.id !== cardId)),
    getProgress: (listId) => read(`progress:${listId}`, { listId, updatedAt: null, items: {} }),
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
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/store.test.js`
Expected: PASS, 19 tests. If the id-format test fails, check `newId` produces exactly six characters from the alphabet.

- [ ] **Step 5: Remove the smoke test and run the whole suite**

```bash
rm test/smoke.test.js
npm test
```
Expected: PASS, csv + store suites.

- [ ] **Step 6: Commit**

```bash
git add app/store.js test/store.test.js
git rm test/smoke.test.js
git commit -m "feat: working copy in localStorage with dirty tracking"
```

---

### Task 4: Home and List screens — usable on one device

**Files:**
- Modify: `app/main.js` (replace the placeholder), `app/style.css`
- Consumes: `createStore` (Task 3), `parseCards` / `toCsv` (Task 2), `el` / `clear` / `$` (Task 1).
- Produces: `showHome()`, `showList(listId)`, and a `render()` router driven by `location.hash`. Later tasks add `showSession(...)` and `showSettings()` to the same switch.

Routes are hash-based so GitHub Pages needs no server-side rewriting: `#/` is Home, `#/list/<id>` a list, later `#/study/<id>` and `#/settings`.

This task has no unit tests — it is DOM work, and the spec says screens are verified by use. The verification steps below are the test.

- [ ] **Step 1: Replace `app/main.js`**

```javascript
import { el, clear, $ } from './ui.js';
import { createStore } from './store.js';
import { parseCards, toCsv } from './csv.js';

const store = createStore(localStorage);

function go(hash) {
  location.hash = hash;
}

function screen() {
  const node = $('#screen');
  clear(node);
  return node;
}

function showHome() {
  const view = screen();
  view.append(el('h2', { text: 'Lists' }));
  const ids = store.listIds();
  if (ids.length === 0) {
    view.append(el('p', { class: 'empty', text: 'No lists yet. Create one below.' }));
  }
  for (const id of ids) {
    const list = store.getList(id);
    view.append(el('div', { class: 'row' }, [
      el('a', { href: `#/list/${id}`, text: list.name }),
      el('span', { class: 'muted', text: `${list.cards.length} cards` }),
    ]));
  }
  const name = el('input', { placeholder: 'New list name', id: 'new-list-name' });
  view.append(el('form', {
    class: 'newlist',
    onsubmit: (e) => {
      e.preventDefault();
      if (!name.value.trim()) return;
      const list = store.createList({ name: name.value.trim() });
      go(`#/list/${list.id}`);
    },
  }, [name, el('button', { type: 'submit', text: 'Create list' })]));
}

function showList(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: list.name }));

  const front = el('input', { placeholder: 'front (e.g. el pan)' });
  const back = el('input', { placeholder: 'back (e.g. le pain)' });
  view.append(el('form', {
    class: 'addcard',
    onsubmit: (e) => {
      e.preventDefault();
      if (!front.value.trim() || !back.value.trim()) return;
      store.addCards(id, [{ front: front.value.trim(), back: back.value.trim() }]);
      front.value = '';
      back.value = '';
      render();
      front.focus();
    },
  }, [front, back, el('button', { type: 'submit', text: 'Add' })]));

  const table = el('table', { class: 'cards' });
  for (const card of list.cards) {
    table.append(el('tr', {}, [
      el('td', {}, [editableCell(id, card, 'front')]),
      el('td', {}, [editableCell(id, card, 'back')]),
      el('td', {}, [el('button', {
        class: 'link', text: '✕', title: 'delete',
        onclick: () => { store.deleteCard(id, card.id); render(); },
      })]),
    ]));
  }
  view.append(table);
  view.append(importExport(id));
}

function editableCell(listId, card, side) {
  return el('input', {
    value: card[side],
    onchange: (e) => store.updateCard(listId, card.id, { [side]: e.target.value.trim() }),
  });
}

function importExport(listId) {
  const box = el('textarea', {
    placeholder: 'Paste rows: el pan, le pain — one card per line. Tabs work too.',
    rows: '4',
  });
  const status = el('p', { class: 'muted' });
  const doImport = () => {
    const { cards, errors } = parseCards(box.value);
    if (cards.length) store.addCards(listId, cards);
    box.value = '';
    status.textContent = errors.length
      ? `Imported ${cards.length}. Skipped lines: ${errors.map((e) => e.line).join(', ')}.`
      : `Imported ${cards.length}.`;
    render();
    $('#import-status')?.replaceWith(status);
  };
  const file = el('input', {
    type: 'file', accept: '.csv,.txt,text/csv',
    onchange: async (e) => {
      const chosen = e.target.files[0];
      if (!chosen) return;
      box.value = await chosen.text();
      doImport();
    },
  });
  const exportLink = el('button', {
    text: 'Export CSV',
    onclick: () => {
      const list = store.getList(listId);
      const blob = new Blob([toCsv(list.cards)], { type: 'text/csv' });
      const a = el('a', { href: URL.createObjectURL(blob), download: `${listId}.csv` });
      a.click();
      URL.revokeObjectURL(a.href);
    },
  });
  status.id = 'import-status';
  return el('details', { class: 'io' }, [
    el('summary', { text: 'Import / export' }),
    box,
    el('div', { class: 'row' }, [
      el('button', { text: 'Import pasted text', onclick: doImport }),
      file,
      exportLink,
    ]),
    status,
  ]);
}

function render() {
  const [, route, arg] = location.hash.split('/');
  if (route === 'list' && arg) showList(arg);
  else showHome();
}

window.addEventListener('hashchange', render);
render();
```

- [ ] **Step 2: Add the styles these screens need**

Append to `app/style.css`: `.row { display: flex; justify-content: space-between; align-items: center; gap: .5rem; padding: .5rem 0; border-bottom: 1px solid #eee; }`, `.muted { color: #777; }`, `table.cards { width: 100%; border-collapse: collapse; }`, `table.cards input { width: 100%; border: 1px solid transparent; padding: .4rem; font-size: 1rem; }`, `table.cards input:focus { border-color: #999; }`, `form.addcard, form.newlist { display: flex; gap: .5rem; margin: 1rem 0; }`, `form input { flex: 1; padding: .5rem; font-size: 1rem; }`, `textarea { width: 100%; font-size: 1rem; }`, `button.link { background: none; border: none; color: #a00; font-size: 1rem; }`.

- [ ] **Step 3: Verify by hand**

Run `npm run dev`, open `http://localhost:8000`, then:

1. Create a list named `Spanish – Food`. Expect to land on its page, URL `#/list/spanish-food`.
2. Add `el pan` / `le pain`. It appears in the table.
3. Edit a cell and reload the page. The edit survived.
4. Open Import/export, paste two lines (`la leche, le lait` and a line with no comma), press Import. Expect "Imported 1. Skipped lines: 2."
5. Export CSV and confirm the file's contents.
6. Go back to Lists and confirm the card count.
7. Narrow the window to phone width. Nothing overflows horizontally.

- [ ] **Step 4: Commit**

```bash
git add app/main.js app/style.css
git commit -m "feat: home and list screens with card editing and CSV import"
```

---

### Task 5: `grade.js` — checking typed answers

**Files:**
- Create: `app/grade.js`, `test/grade.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `grade(expected, typed) -> 'correct' | 'typo' | 'wrong'`, and `normalise(text) -> string` exported for tests.

Rules from the spec: ignore case, accents, surrounding and repeated whitespace, terminal punctuation, and a leading article. One edit away is `typo`. Everything else is `wrong`.

- [ ] **Step 1: Write the failing tests**

`test/grade.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { grade, normalise } from '../app/grade.js';

describe('normalise', () => {
  it('strips case, accents, articles and punctuation', () => {
    expect(normalise('  Le Château!  ')).toBe('chateau');
  });
  it('collapses repeated whitespace', () => {
    expect(normalise('a   b')).toBe('a b');
  });
});

describe('grade', () => {
  it('accepts an exact match', () => {
    expect(grade('le pain', 'le pain')).toBe('correct');
  });
  it('ignores case', () => {
    expect(grade('le pain', 'Le Pain')).toBe('correct');
  });
  it('ignores accents', () => {
    expect(grade('château', 'chateau')).toBe('correct');
  });
  it('ignores a missing leading article', () => {
    expect(grade('le pain', 'pain')).toBe('correct');
  });
  it('ignores an added leading article', () => {
    expect(grade('pain', 'le pain')).toBe('correct');
  });
  it('handles Spanish and English articles too', () => {
    expect(grade('el pan', 'pan')).toBe('correct');
    expect(grade('the bread', 'bread')).toBe('correct');
  });
  it('ignores surrounding whitespace and final punctuation', () => {
    expect(grade('le pain', ' le pain. ')).toBe('correct');
  });
  it('accepts any one of several answers separated by a slash or comma', () => {
    expect(grade('le pain / la miche', 'la miche')).toBe('correct');
    expect(grade('bread, loaf', 'loaf')).toBe('correct');
  });
  it('calls a one-letter difference a typo', () => {
    expect(grade('le pain', 'le pian')).toBe('typo');
    expect(grade('bread', 'bred')).toBe('typo');
    expect(grade('bread', 'breads')).toBe('typo');
  });
  it('calls two differences wrong', () => {
    expect(grade('bread', 'brad')).toBe('typo');
    expect(grade('bread', 'brud')).toBe('wrong');
  });
  it('calls a different word wrong', () => {
    expect(grade('le pain', 'le lait')).toBe('wrong');
  });
  it('calls empty input wrong', () => {
    expect(grade('le pain', '')).toBe('wrong');
    expect(grade('le pain', '   ')).toBe('wrong');
  });
  it('does not call a very short word a typo of another', () => {
    expect(grade('un', 'on')).toBe('wrong');
  });
});
```

Note the deliberate pair: `brad` is one edit from `bread` (a deletion) so it is a
typo; `brud` is two and is wrong. And short words get no typo tolerance at all,
because at three letters or fewer nearly every wrong answer is one edit away.

- [ ] **Step 2: Run the tests to watch them fail**

Run: `npx vitest run test/grade.test.js`
Expected: FAIL — cannot resolve `../app/grade.js`.

- [ ] **Step 3: Implement `app/grade.js`**

```javascript
const ARTICLES = ['le', 'la', 'les', "l'", 'un', 'une', 'des', 'du',
  'el', 'los', 'las', 'lo', 'the', 'a', 'an', 'der', 'die', 'das', 'il', 'lo'];

export function normalise(text) {
  let s = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[.,!?;:¡¿"']/g, ' ').replace(/\s+/g, ' ').trim();
  const [first, ...rest] = s.split(' ');
  if (rest.length > 0 && ARTICLES.includes(first)) s = rest.join(' ');
  return s;
}

function alternatives(expected) {
  return String(expected).split(/[/,;]/).map(normalise).filter((s) => s !== '');
}

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

export function grade(expected, typed) {
  const answer = normalise(typed);
  if (answer === '') return 'wrong';
  const options = alternatives(expected);
  if (options.includes(answer)) return 'correct';
  for (const option of options) {
    if (option.length > 3 && distance(option, answer) === 1) return 'typo';
  }
  return 'wrong';
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/grade.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add app/grade.js test/grade.test.js
git commit -m "feat: forgiving grading of typed answers"
```

---

### Task 6: `srs.js` — Leitner scheduling

**Files:**
- Create: `app/srs.js`, `test/srs.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `INTERVALS` — `[1, 3, 7, 16, 35]`
  - `itemKey(cardId, direction) -> string`
  - `parseKey(key) -> { cardId, direction }`
  - `newItem(today) -> item` — `{ box: 1, due: today, seen: 0, lapses: 0, lastSeen: null }`
  - `nextItem(item, correct, today, nowIso) -> item`
  - `dueKeys(items, today) -> string[]` — keys whose `due <= today`
  - `buildQueue({ list, progress, directions, today, limit, includeNew, shuffle }) -> string[]`
- `today` is a `YYYY-MM-DD` string throughout. `nowIso` is an ISO timestamp. Neither is read from the clock inside this module.

- [ ] **Step 1: Write the failing tests**

`test/srs.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { INTERVALS, itemKey, parseKey, newItem, nextItem, dueKeys, buildQueue } from '../app/srs.js';

const TODAY = '2026-09-01';
const NOW = '2026-09-01T14:03:00Z';

describe('keys', () => {
  it('builds and parses an item key', () => {
    expect(itemKey('k3f9', 'f2b')).toBe('k3f9:f2b');
    expect(parseKey('k3f9:f2b')).toEqual({ cardId: 'k3f9', direction: 'f2b' });
  });
});

describe('newItem', () => {
  it('starts in box 1, due today, never seen', () => {
    expect(newItem(TODAY)).toEqual({ box: 1, due: TODAY, seen: 0, lapses: 0, lastSeen: null });
  });
});

describe('nextItem', () => {
  it('promotes on a correct answer and schedules by the new box', () => {
    const item = nextItem(newItem(TODAY), true, TODAY, NOW);
    expect(item.box).toBe(2);
    expect(item.due).toBe('2026-09-04');   // today + 3
    expect(item.seen).toBe(1);
    expect(item.lastSeen).toBe(NOW);
  });

  it('walks the whole ladder with the spec intervals', () => {
    expect(INTERVALS).toEqual([1, 3, 7, 16, 35]);
    let item = newItem(TODAY);
    const dues = [];
    for (let i = 0; i < 5; i++) {
      item = nextItem(item, true, TODAY, NOW);
      dues.push(item.due);
    }
    expect(dues).toEqual(['2026-09-04', '2026-09-08', '2026-09-17', '2026-10-06', '2026-10-06']);
  });

  it('caps at box 5', () => {
    let item = { box: 5, due: TODAY, seen: 9, lapses: 0, lastSeen: null };
    expect(nextItem(item, true, TODAY, NOW).box).toBe(5);
  });

  it('demotes to box 1 on a wrong answer and counts a lapse', () => {
    const item = nextItem({ box: 4, due: TODAY, seen: 9, lapses: 1, lastSeen: null }, false, TODAY, NOW);
    expect(item.box).toBe(1);
    expect(item.lapses).toBe(2);
    expect(item.due).toBe('2026-09-02');   // tomorrow
  });

  it('crosses a month boundary correctly', () => {
    const item = nextItem(newItem('2026-09-30'), false, '2026-09-30', NOW);
    expect(item.due).toBe('2026-10-01');
  });
});

describe('dueKeys', () => {
  const items = {
    'a:f2b': { box: 1, due: '2026-08-31' },
    'b:f2b': { box: 2, due: '2026-09-01' },
    'c:f2b': { box: 3, due: '2026-09-05' },
  };
  it('returns items due today or earlier', () => {
    expect(dueKeys(items, TODAY).sort()).toEqual(['a:f2b', 'b:f2b']);
  });
  it('returns nothing when everything is in the future', () => {
    expect(dueKeys(items, '2026-08-01')).toEqual([]);
  });
});

describe('buildQueue', () => {
  const list = { id: 'food', cards: [{ id: 'a', front: '1', back: '2' }, { id: 'b', front: '3', back: '4' }] };
  const noShuffle = (xs) => xs;

  it('offers every direction of every card when nothing is known', () => {
    const queue = buildQueue({
      list, progress: { items: {} }, directions: ['f2b', 'b2f'],
      today: TODAY, limit: 10, includeNew: true, shuffle: noShuffle,
    });
    expect(queue.sort()).toEqual(['a:b2f', 'a:f2b', 'b:b2f', 'b:f2b']);
  });

  it('only includes the requested directions', () => {
    const queue = buildQueue({
      list, progress: { items: {} }, directions: ['f2b'],
      today: TODAY, limit: 10, includeNew: true, shuffle: noShuffle,
    });
    expect(queue.sort()).toEqual(['a:f2b', 'b:f2b']);
  });

  it('excludes new cards when includeNew is false', () => {
    const queue = buildQueue({
      list, progress: { items: { 'a:f2b': { box: 1, due: TODAY } } }, directions: ['f2b'],
      today: TODAY, limit: 10, includeNew: false, shuffle: noShuffle,
    });
    expect(queue).toEqual(['a:f2b']);
  });

  it('excludes items not yet due', () => {
    const queue = buildQueue({
      list, progress: { items: { 'a:f2b': { box: 3, due: '2026-12-01' } } }, directions: ['f2b'],
      today: TODAY, limit: 10, includeNew: false, shuffle: noShuffle,
    });
    expect(queue).toEqual([]);
  });

  it('puts due items before new ones and honours the limit', () => {
    const queue = buildQueue({
      list, progress: { items: { 'b:f2b': { box: 1, due: TODAY } } }, directions: ['f2b'],
      today: TODAY, limit: 1, includeNew: true, shuffle: noShuffle,
    });
    expect(queue).toEqual(['b:f2b']);
  });

  it('ignores progress for cards that no longer exist', () => {
    const queue = buildQueue({
      list, progress: { items: { 'gone:f2b': { box: 1, due: TODAY } } }, directions: ['f2b'],
      today: TODAY, limit: 10, includeNew: false, shuffle: noShuffle,
    });
    expect(queue).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `npx vitest run test/srs.test.js`
Expected: FAIL — cannot resolve `../app/srs.js`.

- [ ] **Step 3: Implement `app/srs.js`**

```javascript
export const INTERVALS = [1, 3, 7, 16, 35];

export const itemKey = (cardId, direction) => `${cardId}:${direction}`;

export function parseKey(key) {
  const at = key.lastIndexOf(':');
  return { cardId: key.slice(0, at), direction: key.slice(at + 1) };
}

function addDays(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function newItem(today) {
  return { box: 1, due: today, seen: 0, lapses: 0, lastSeen: null };
}

export function nextItem(item, correct, today, nowIso) {
  const box = correct ? Math.min(item.box + 1, INTERVALS.length) : 1;
  return {
    box,
    due: addDays(today, INTERVALS[box - 1]),
    seen: item.seen + 1,
    lapses: item.lapses + (correct ? 0 : 1),
    lastSeen: nowIso,
  };
}

export function dueKeys(items, today) {
  return Object.keys(items).filter((key) => items[key].due <= today);
}

const defaultShuffle = (xs) => {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function buildQueue({ list, progress, directions, today, limit,
                            includeNew = true, shuffle = defaultShuffle }) {
  const items = progress.items || {};
  const known = new Set(list.cards.map((c) => c.id));
  const due = [];
  const fresh = [];
  for (const card of list.cards) {
    for (const direction of directions) {
      const key = itemKey(card.id, direction);
      const item = items[key];
      if (!item) { if (includeNew) fresh.push(key); }
      else if (item.due <= today) due.push(key);
    }
  }
  void known;
  return shuffle(due).concat(shuffle(fresh)).slice(0, limit);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/srs.test.js`
Expected: PASS, 15 tests. The ladder test is the one that catches an off-by-one in the interval table — read it carefully if it fails.

- [ ] **Step 5: Delete the dead `known` set**

The `const known` / `void known` lines above are scaffolding left from an earlier
shape and are genuinely unused: remove both. Re-run the tests to confirm nothing
depended on them. (Progress for missing cards is already excluded, because the
queue is built by walking `list.cards`, not the progress keys.)

- [ ] **Step 6: Commit**

```bash
git add app/srs.js test/srs.test.js
git commit -m "feat: Leitner scheduling and session queue building"
```

---

### Task 7: Study screens — setup and session

**Files:**
- Modify: `app/main.js`, `app/style.css`

**Interfaces:**
- Consumes: `buildQueue`, `newItem`, `nextItem`, `itemKey`, `parseKey`, `dueKeys` (Task 6); `grade` (Task 5); the store (Task 3).
- Produces: routes `#/study/<listId>` (setup) and `#/session/<listId>` (running session); `dueCount(listId)` used by Home.

Session state lives in a module-level variable, not in the URL — a reload
abandons the session, which is fine because every answer is written to the store
as it happens.

- [ ] **Step 1: Add the imports and helpers to `app/main.js`**

```javascript
import { buildQueue, newItem, nextItem, itemKey, parseKey, dueKeys } from './srs.js';
import { grade } from './grade.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

function dueCount(listId) {
  const list = store.getList(listId);
  const progress = store.getProgress(listId);
  const live = new Set();
  for (const card of list.cards) { live.add(itemKey(card.id, 'f2b')); live.add(itemKey(card.id, 'b2f')); }
  return dueKeys(progress.items, todayStr()).filter((k) => live.has(k)).length;
}
```

- [ ] **Step 2: Show due counts and a Study button on Home**

In `showHome`, inside the loop over list ids, replace the row with:

```javascript
    const due = dueCount(id);
    view.append(el('div', { class: 'row' }, [
      el('a', { href: `#/list/${id}`, text: list.name }),
      el('span', { class: 'muted', text: `${list.cards.length} cards` }),
      el('span', { class: due ? 'badge' : 'muted', text: due ? `${due} due` : '—' }),
      el('a', { class: 'btn', href: `#/study/${id}`, text: 'Study' }),
    ]));
```

- [ ] **Step 3: Write the session-setup screen**

```javascript
const setup = { mode: 'write', directions: ['f2b', 'b2f'], limit: 20, includeNew: true };

function showSetup(listId) {
  const list = store.getList(listId);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: `Study: ${list.name}` }));

  const radio = (name, value, label, checked) => el('label', { class: 'opt' }, [
    el('input', { type: 'radio', name, value, ...(checked ? { checked: 'checked' } : {}) }),
    label,
  ]);

  const modes = el('div', { class: 'opts' }, [
    radio('mode', 'write', 'Write (type the answer)', setup.mode === 'write'),
    radio('mode', 'cards', 'Flashcards', setup.mode === 'cards'),
  ]);
  const dirs = el('div', { class: 'opts' }, [
    radio('dir', 'both', 'Both directions', setup.directions.length === 2),
    radio('dir', 'f2b', `${list.name}: front → back`, setup.directions.join() === 'f2b'),
    radio('dir', 'b2f', 'back → front', setup.directions.join() === 'b2f'),
  ]);
  const limit = el('input', { type: 'number', min: '5', max: '100', step: '5', value: String(setup.limit) });

  view.append(el('h3', { text: 'Mode' }), modes, el('h3', { text: 'Direction' }), dirs,
    el('h3', { text: 'Cards this session' }), limit);

  view.append(el('button', {
    class: 'primary', text: 'Start',
    onclick: () => {
      setup.mode = modes.querySelector('input:checked').value;
      const dir = dirs.querySelector('input:checked').value;
      setup.directions = dir === 'both' ? ['f2b', 'b2f'] : [dir];
      setup.limit = Number(limit.value) || 20;
      startSession(listId);
    },
  }));
}
```

- [ ] **Step 4: Write the session screen**

```javascript
let session = null;

function startSession(listId) {
  const list = store.getList(listId);
  const progress = store.getProgress(listId);
  const queue = buildQueue({
    list, progress, directions: setup.directions,
    today: todayStr(), limit: setup.limit, includeNew: setup.includeNew,
  });
  if (queue.length === 0) {
    alert('Nothing due in this list right now. Add cards, or come back tomorrow.');
    return;
  }
  session = { listId, queue, at: 0, right: 0, wrong: 0 };
  go(`#/session/${listId}`);
}

function answer(correct) {
  const { listId, queue, at } = session;
  const key = queue[at];
  const progress = store.getProgress(listId);
  const previous = progress.items[key] || newItem(todayStr());
  progress.items[key] = nextItem(previous, correct, todayStr(), new Date().toISOString());
  store.saveProgress(progress);
  session[correct ? 'right' : 'wrong'] += 1;
  session.at += 1;
  render();
}

function showSession(listId) {
  if (!session || session.listId !== listId) return go(`#/study/${listId}`);
  const list = store.getList(listId);
  const view = screen();

  if (session.at >= session.queue.length) {
    view.append(el('h2', { text: 'Done' }));
    view.append(el('p', { text: `${session.right} right, ${session.wrong} wrong.` }));
    view.append(el('a', { class: 'btn', href: `#/study/${listId}`, text: 'Study more' }));
    view.append(el('a', { class: 'btn', href: '#/', text: 'Back to lists' }));
    session = null;
    return;
  }

  const key = session.queue[session.at];
  const { cardId, direction } = parseKey(key);
  const card = list.cards.find((c) => c.id === cardId);
  if (!card) { session.at += 1; return render(); }
  const prompt = direction === 'f2b' ? card.front : card.back;
  const expected = direction === 'f2b' ? card.back : card.front;

  view.append(el('p', { class: 'muted', text: `${session.at + 1} / ${session.queue.length}` }));
  view.append(el('p', { class: 'prompt', text: prompt }));

  if (setup.mode === 'cards') {
    const reveal = el('button', {
      class: 'primary', text: 'Show answer',
      onclick: () => {
        reveal.replaceWith(el('div', {}, [
          el('p', { class: 'answer', text: expected }),
          el('div', { class: 'row' }, [
            el('button', { text: 'Didn’t know', onclick: () => answer(false) }),
            el('button', { class: 'primary', text: 'Knew it', onclick: () => answer(true) }),
          ]),
        ]));
      },
    });
    view.append(reveal);
    return;
  }

  const input = el('input', { class: 'answer-input', autocapitalize: 'none',
    autocorrect: 'off', spellcheck: 'false', placeholder: 'your answer' });
  const form = el('form', {
    onsubmit: (e) => {
      e.preventDefault();
      const verdict = grade(expected, input.value);
      if (verdict === 'correct') return answer(true);
      showVerdict(view, verdict, expected, input.value);
    },
  }, [input, el('button', { class: 'primary', type: 'submit', text: 'Check' })]);
  view.append(form);
  input.focus();
}

function showVerdict(view, verdict, expected, typed) {
  const panel = el('div', { class: `verdict ${verdict}` }, [
    el('p', { text: verdict === 'typo' ? `Almost — it is “${expected}”` : `Answer: ${expected}` }),
    el('p', { class: 'muted', text: `you wrote: ${typed}` }),
    el('div', { class: 'row' }, [
      el('button', { text: 'I was right', onclick: () => answer(true) }),
      el('button', { class: 'primary', text: verdict === 'typo' ? 'Got it' : 'Continue',
        onclick: () => answer(verdict === 'typo') }),
    ]),
  ]);
  view.append(panel);
}
```

A typo counts as correct when you press *Got it*: the spec's rule is that being
slightly generous costs one extra review, while being strict costs the habit.

- [ ] **Step 5: Add the free-review option**

The spec requires a review that leaves scheduling untouched, for when nothing is
due but you want to go through the list anyway.

In `showSetup`, after the limit input:

```javascript
  const free = el('input', { type: 'checkbox', ...(setup.free ? { checked: 'checked' } : {}) });
  view.append(el('label', { class: 'opt' }, [free, 'Free review (everything, does not affect scheduling)']));
```

In the Start handler, before `startSession`: `setup.free = free.checked;`

In `startSession`, when building the queue, pass `includeNew: true` and afterwards:

```javascript
  const queue = setup.free
    ? buildQueue({ list, progress: { items: {} }, directions: setup.directions,
                   today: todayStr(), limit: setup.limit, includeNew: true })
    : buildQueue({ list, progress, directions: setup.directions,
                   today: todayStr(), limit: setup.limit, includeNew: setup.includeNew });
  ...
  session = { listId, queue, at: 0, right: 0, wrong: 0, free: setup.free };
```

Passing empty progress is what makes every card eligible regardless of its due
date. And in `answer`, first line:

```javascript
  if (session.free) { session[correct ? 'right' : 'wrong'] += 1; session.at += 1; return render(); }
```

Verify: with everything scheduled far in the future, a normal session says
nothing is due, and a free review still runs and leaves the Home due count
unchanged.

- [ ] **Step 6: Extend the router**

```javascript
function render() {
  const [, route, arg] = location.hash.split('/');
  if (route === 'list' && arg) showList(arg);
  else if (route === 'study' && arg) showSetup(arg);
  else if (route === 'session' && arg) showSession(arg);
  else showHome();
}
```

- [ ] **Step 7: Add the styles**

Append to `app/style.css`: `.prompt { font-size: 2rem; text-align: center; margin: 2rem 0; }`, `.answer { font-size: 1.5rem; text-align: center; }`, `.answer-input { width: 100%; font-size: 1.5rem; padding: .6rem; }`, `.btn, button.primary { display: inline-block; padding: .6rem 1rem; border: 1px solid #333; border-radius: 6px; background: #fff; text-decoration: none; color: inherit; }`, `button.primary { background: #333; color: #fff; }`, `.badge { background: #333; color: #fff; border-radius: 999px; padding: 0 .5rem; }`, `.verdict.wrong { border-left: 4px solid #a00; padding-left: .75rem; }`, `.verdict.typo { border-left: 4px solid #c80; padding-left: .75rem; }`, `.opts { display: flex; flex-direction: column; gap: .25rem; }`, `.opt { display: flex; gap: .5rem; align-items: center; }`.

- [ ] **Step 8: Verify by hand**

1. With a list of 3 cards, Home shows `3 due` (new cards count as due).
2. Study → Write → Both directions → Start. Answer one correctly; the counter advances.
3. Type an answer with the wrong accent — accepted as correct.
4. Type a one-letter typo — "Almost", and *Got it* moves on.
5. Type nonsense — the answer is shown, *I was right* is available.
6. Finish the queue; the summary appears and lists are reachable again.
7. Reload mid-session: you land on the setup screen, and the answers already given are still recorded (Home's due count dropped).
8. Repeat with Flashcards mode.

- [ ] **Step 9: Commit**

```bash
git add app/main.js app/style.css
git commit -m "feat: study sessions with flashcards and typed answers"
```

---

### Task 8: `merge.js` — the two merge rules

**Files:**
- Create: `app/merge.js`, `test/merge.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `mergeProgress(local, remote) -> progress` — per item, the record with the later `lastSeen` wins; an item present on one side only is kept; `null`/missing `lastSeen` loses to any timestamp.
  - `compareLists({ local, remote, remoteSha, base }) -> 'same' | 'take-remote' | 'keep-local' | 'conflict'` — `base` is `{ sha, updatedAt }` recorded at the last successful sync of this file, or `null` if it was never synced.

- [ ] **Step 1: Write the failing tests**

`test/merge.test.js`:

```javascript
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
```

The comparison hinges on two independent facts, each measured against the last
successful sync: did the remote move (`remoteSha !== base.sha`), and did we edit
our copy (`local.updatedAt !== base.updatedAt`). Both true is the only conflict.
Note it cannot be decided by comparing local to remote directly — two copies
differing tells you nothing about *who* changed.

- [ ] **Step 2: Run the tests to watch them fail**

Run: `npx vitest run test/merge.test.js`
Expected: FAIL — cannot resolve `../app/merge.js`.

- [ ] **Step 3: Implement `app/merge.js`**

```javascript
const seenAt = (item) => (item && item.lastSeen ? item.lastSeen : '');

export function mergeProgress(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const items = { ...remote.items };
  for (const [key, mine] of Object.entries(local.items || {})) {
    const theirs = items[key];
    if (!theirs || seenAt(mine) > seenAt(theirs)) items[key] = mine;
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
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/merge.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add app/merge.js test/merge.test.js
git commit -m "feat: progress auto-merge and list conflict detection"
```

---

### Task 9: `github.js` — the contents API client

**Files:**
- Create: `app/github.js`, `test/github.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createGitHub({ repo, branch, token, fetchImpl }) -> client` with:
  - `getFile(path) -> { json, sha } | null` (null on 404)
  - `putFile(path, json, sha, message) -> { sha }` — throws `ConflictError` on 409/422
  - `listDir(path) -> [{ name, path, sha }]` (empty array on 404)
  - exported `class ConflictError extends Error {}`
- `repo` is `'CyrilPitrou/myquizzlet'`, `branch` is `'data'`. `fetchImpl` defaults to `globalThis.fetch` and is injected in tests.
- Content is base64. Use `TextEncoder`/`TextDecoder` around `btoa`/`atob` so accented characters survive the round trip — this is the one place where a naive implementation silently corrupts data.

- [ ] **Step 1: Write the failing tests**

`test/github.test.js`:

```javascript
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
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `npx vitest run test/github.test.js`
Expected: FAIL — cannot resolve `../app/github.js`.

- [ ] **Step 3: Implement `app/github.js`**

```javascript
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
    const response = await fetchImpl(target, { ...options, headers: { ...headers, ...options.headers } });
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
      const { body } = await request(url(path), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          branch,
          content: encode(JSON.stringify(json, null, 2)),
          ...(sha ? { sha } : {}),
        }),
      });
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
```

`btoa`/`atob` exist in Node 16+ and in every browser, so these tests need no DOM
environment. If Vitest complains about `TextEncoder`, the Node version is too old
— use Node 18 or later.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/github.test.js`
Expected: PASS, 11 tests. The accent test is the one that matters most: if it
fails, `encode`/`decode` were shortcut to bare `btoa(text)`.

- [ ] **Step 5: Commit**

```bash
git add app/github.js test/github.test.js
git commit -m "feat: GitHub contents API client with sha-guarded writes"
```

---

### Task 10: `sync.js` and the Settings screen

**Files:**
- Create: `app/sync.js`
- Modify: `app/main.js`, `app/store.js` (base-sha bookkeeping), `app/style.css`

**Interfaces:**
- Consumes: `createGitHub`, `ConflictError` (Task 9); `mergeProgress`, `compareLists` (Task 8); the store (Task 3).
- Produces: `createSync({ store, github, onStatus, onConflict }) -> { pullAll, pushDirty, syncNow }`.
  - `onStatus(state, detail)` where `state` is `'synced' | 'pending' | 'offline' | 'error' | 'off'`.
  - `onConflict({ listId, local, remote, resolve })` — `resolve('local' | 'remote')`. Task 11 supplies the UI; until then pass a handler that keeps local and logs.
- Store additions: `getBase(key) -> { sha, updatedAt } | null` and `setBase(key, base)`, stored under `mq:base` as a map keyed like the dirty keys (`list:food`, `progress:food`).
- Settings, in `localStorage` under `mq:settings`: `{ token, tokenExpiry }` (`tokenExpiry` a `YYYY-MM-DD` string or `null`).

Paths: list `food` lives at `data/lists/food.json`, its progress at
`data/progress/food.json`.

- [ ] **Step 1: Add base-sha bookkeeping to `store.js`**

Inside the returned object:

```javascript
    getBase: (key) => read('base', {})[key] || null,
    setBase(key, base) {
      write('base', { ...read('base', {}), [key]: base });
    },
```

Add to `deleteList`, after the two `markDirty` calls, nothing further — a deleted
list keeps its base entry until the deletion is pushed, which is harmless.

- [ ] **Step 2: Write `app/sync.js`**

```javascript
import { ConflictError } from './github.js';
import { mergeProgress, compareLists } from './merge.js';

const listPath = (id) => `data/lists/${id}.json`;
const progressPath = (id) => `data/progress/${id}.json`;

export function createSync({ store, github, onStatus, onConflict }) {
  let timer = null;

  async function pullList(id, remoteEntry) {
    const key = `list:${id}`;
    const remote = await github.getFile(listPath(id));
    const verdict = compareLists({
      local: store.getList(id),
      remote: remote && remote.json,
      remoteSha: remote && remote.sha,
      base: store.getBase(key),
    });
    if (verdict === 'take-remote') {
      store.saveList(remote.json);
      store.markClean(key);
      store.setBase(key, { sha: remote.sha, updatedAt: remote.json.updatedAt });
    } else if (verdict === 'same') {
      store.markClean(key);
    } else if (verdict === 'conflict') {
      await new Promise((done) => onConflict({
        listId: id,
        local: store.getList(id),
        remote: remote.json,
        resolve: (choice) => {
          if (choice === 'remote') {
            store.saveList(remote.json);
            store.markClean(key);
            store.setBase(key, { sha: remote.sha, updatedAt: remote.json.updatedAt });
          } else {
            store.setBase(key, { sha: remote.sha, updatedAt: null });
            store.markDirty(key);
          }
          done();
        },
      }));
    }
    void remoteEntry;
  }

  async function pullProgress(id) {
    const key = `progress:${id}`;
    const remote = await github.getFile(progressPath(id));
    if (!remote) return;
    const merged = mergeProgress(store.getProgress(id), remote.json);
    store.saveProgress(merged);
    store.setBase(key, { sha: remote.sha, updatedAt: merged.updatedAt });
  }

  async function pullAll() {
    const entries = await github.listDir('data/lists');
    for (const entry of entries) {
      const id = entry.name.replace(/\.json$/, '');
      await pullList(id);
      await pullProgress(id);
    }
    for (const id of store.listIds()) {
      if (!entries.some((e) => e.name === `${id}.json`)) store.markDirty(`list:${id}`);
    }
  }

  async function pushOne(key) {
    const [kind, id] = key.split(':');
    const path = kind === 'list' ? listPath(id) : progressPath(id);
    const payload = kind === 'list' ? store.getList(id) : store.getProgress(id);
    if (!payload) return;
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
          if (kind === 'progress') { await pullProgress(id); await pushOne(key); }
          else { await pullList(id); await pushOne(key); }
        } else {
          throw error;
        }
      }
    }
  }

  async function syncNow() {
    if (!github) return onStatus('off');
    if (!navigator.onLine) return onStatus('offline');
    try {
      onStatus('pending');
      await pullAll();
      await pushDirty();
      onStatus(store.dirtyKeys().length ? 'pending' : 'synced');
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
  };
}
```

The retry on `ConflictError` is what makes progress pushes self-healing: pull,
merge, push again. A list conflict instead reaches `onConflict`, which asks.

- [ ] **Step 3: Remove the unused `remoteEntry` parameter**

`pullList(id, remoteEntry)` and its `void remoteEntry;` line are scaffolding — the
entry is unused because `getFile` fetches the file anyway. Reduce to
`pullList(id)`. Verify no call site passes a second argument.

- [ ] **Step 4: Wire sync into `main.js`**

```javascript
import { createGitHub } from './github.js';
import { createSync } from './sync.js';

const REPO = 'CyrilPitrou/myquizzlet';
const settings = () => JSON.parse(localStorage.getItem('mq:settings') || '{}');
const saveSettings = (next) => localStorage.setItem('mq:settings', JSON.stringify(next));

function setStatus(state, detail = '') {
  const dot = $('#sync-dot');
  const marks = { synced: '●', pending: '◐', offline: '◌', error: '✕', off: '○' };
  const titles = {
    synced: 'everything is on GitHub', pending: 'changes waiting to push',
    offline: 'offline — will catch up', error: `sync failed: ${detail}`,
    off: 'no token — read-only',
  };
  dot.textContent = marks[state];
  dot.className = `dot ${state}`;
  dot.title = titles[state];
}

let sync = null;
function initSync() {
  const { token } = settings();
  const github = createGitHub({ repo: REPO, branch: 'data', token });
  sync = createSync({
    store, github,
    onStatus: setStatus,
    onConflict: showConflict,
  });
  if (token) sync.syncNow();
  else setStatus('off');
}

// Temporary until Task 11 replaces it with a real screen.
function showConflict({ listId, resolve }) {
  console.warn(`conflict on ${listId} — keeping the local copy`);
  resolve('local');
}
```

Then call `sync?.schedule()` after every mutation in `showList`, `showHome` and
`answer` — i.e. immediately after each `store.addCards`, `store.updateCard`,
`store.deleteCard`, `store.createList` and `store.saveProgress` call site.

- [ ] **Step 5: Write the Settings screen**

```javascript
function showSettings() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'Settings' }));

  view.append(el('p', {}, [
    'This device needs a token only to save changes. Studying works without one. ',
    el('a', { target: '_blank', rel: 'noopener',
      href: 'https://github.com/settings/personal-access-tokens/new',
      text: 'Create a fine-grained token' }),
    ` — repository access: only ${REPO}; permissions: Contents → Read and write.`,
  ]));

  const token = el('input', { type: 'password', value: current.token || '', placeholder: 'github_pat_…' });
  const expiry = el('input', { type: 'date', value: current.tokenExpiry || '' });
  view.append(el('label', {}, ['Token', token]));
  view.append(el('label', {}, ['Expires on (from the GitHub page)', expiry]));
  view.append(el('button', {
    class: 'primary', text: 'Save',
    onclick: () => {
      saveSettings({ token: token.value.trim(), tokenExpiry: expiry.value || null });
      initSync();
      render();
    },
  }));

  view.append(el('h3', { text: 'Sync' }));
  view.append(el('div', { class: 'row' }, [
    el('button', { text: 'Pull now', onclick: () => sync.pullAll().then(render) }),
    el('button', { text: 'Push now', onclick: () => sync.pushDirty().then(render) }),
    el('button', { text: 'Retry', onclick: () => sync.syncNow().then(render) }),
  ]));
  view.append(el('p', { class: 'muted', text: `${store.dirtyKeys().length} change(s) waiting.` }));
}
```

- [ ] **Step 6: Warn before the token expires**

In `showHome`, at the top:

```javascript
  const { tokenExpiry } = settings();
  if (tokenExpiry) {
    const days = Math.round((new Date(tokenExpiry) - new Date()) / 86400000);
    if (days <= 14) {
      view.append(el('p', { class: 'warn' }, [
        days < 0 ? 'Your GitHub token has expired — changes are not being saved. '
                 : `Your GitHub token expires in ${days} day(s). `,
        el('a', { href: '#/settings', text: 'Renew it' }),
      ]));
    }
  }
```

- [ ] **Step 7: Route to Settings, add a link and styles**

Add `else if (route === 'settings') showSettings();` to `render()`, a
`<a href="#/settings">` gear link in `#topbar`, and styles: `.dot.synced { color: #0a0; }`,
`.dot.pending { color: #c80; }`, `.dot.error { color: #a00; }`, `.dot.offline, .dot.off { color: #999; }`,
`.warn { background: #fff6e0; border-left: 4px solid #c80; padding: .5rem .75rem; }`,
`label { display: block; margin: .75rem 0; }`, `label input { width: 100%; }`.

- [ ] **Step 8: Create the data branch and verify against real GitHub**

```bash
git switch --orphan data
git commit --allow-empty -m "chore: data branch"
git push -u origin data
git switch main
```

Then, with a token pasted into Settings:

1. Create a list and a card. Within a few seconds the dot goes green and
   `data/lists/<id>.json` appears on the `data` branch on github.com.
2. Study one card. `data/progress/<id>.json` appears.
3. Edit the list JSON on github.com, reload the app: the change arrives.
4. Turn off wifi, add a card — dot grey. Turn wifi back on, press Retry — green.
5. Paste a wrong token — dot red with a message; fix it, press Retry — green.

- [ ] **Step 9: Commit**

```bash
git add app/sync.js app/main.js app/store.js app/style.css
git commit -m "feat: automatic GitHub sync, settings screen and status indicator"
```

---

### Task 11: List conflict resolution

**Files:**
- Modify: `app/main.js`, `app/style.css`

**Interfaces:**
- Consumes: `onConflict({ listId, local, remote, resolve })` from `sync.js` (Task 10).
- Produces: `showConflict(conflict)` replacing the Task 10 stub — renders both versions and calls `resolve('local' | 'remote')`.

Reached only when the same list was edited on two devices since the last sync.
The spec forbids merging card-by-card here: guessing would quietly lose work, so
the app shows both and asks.

- [ ] **Step 1: Replace the stub in `app/main.js`**

```javascript
function showConflict({ listId, local, remote, resolve }) {
  const view = screen();
  view.append(el('h2', { text: 'Two versions of this list' }));
  view.append(el('p', {}, [
    `“${local.name}” was edited on this device and somewhere else since the last sync. `,
    'Pick the one to keep — the other is discarded.',
  ]));

  const side = (label, list, choice) => {
    const only = list.cards.filter(
      (c) => !(choice === 'local' ? remote : local).cards.some((o) => o.id === c.id));
    return el('div', { class: 'side' }, [
      el('h3', { text: label }),
      el('p', { class: 'muted', text: `${list.cards.length} cards, saved ${list.updatedAt}` }),
      el('p', { class: 'muted', text: only.length
        ? `Only here: ${only.slice(0, 5).map((c) => c.front).join(', ')}${only.length > 5 ? '…' : ''}`
        : 'No cards unique to this version.' }),
      el('button', { class: 'primary', text: `Keep ${label.toLowerCase()}`,
        onclick: () => { resolve(choice); render(); } }),
    ]);
  };

  view.append(el('div', { class: 'sides' }, [
    side('This device', local, 'local'),
    side('GitHub', remote, 'remote'),
  ]));
}
```

Showing which cards exist on only one side is what makes the choice answerable —
two dates alone do not tell you what you would be throwing away.

- [ ] **Step 2: Add the styles**

Append: `.sides { display: flex; gap: 1rem; flex-wrap: wrap; }`, `.side { flex: 1 1 14rem; border: 1px solid #ddd; border-radius: 6px; padding: .75rem; }`.

- [ ] **Step 3: Provoke a real conflict and verify**

1. On the laptop, add card `AAA` to a list; wait for the green dot.
2. Open the app in a private window (a separate working copy). Let it sync.
3. Turn off the network in *both*. Add `BBB` in one, `CCC` in the other.
4. Reconnect the first, let it push. Reconnect the second.
5. Expect the conflict screen, naming `BBB` on one side and `CCC` on the other.
6. Choose one; confirm the app and GitHub both end up with that version, and the
   dot returns to green.

- [ ] **Step 4: Commit**

```bash
git add app/main.js app/style.css
git commit -m "feat: ask which version wins when a list conflicts"
```

---

### Task 12: Installable app — manifest, service worker, icons

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`
- Modify: `index.html`, `app/main.js`

**Interfaces:**
- Consumes: nothing.
- Produces: an installable PWA. Chrome offers "Install" (a real WebAPK) only when a manifest *and* a service worker with a `fetch` handler are present over HTTPS — that is the whole point of this task.

- [ ] **Step 1: Write `manifest.webmanifest`**

```json
{
  "name": "MyQuizzlet",
  "short_name": "Quizzlet",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#333333",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [
    { "name": "Study due words", "url": "./index.html#/", "short_name": "Study" },
    { "name": "Add a word", "url": "./index.html#/", "short_name": "Add" }
  ]
}
```

Relative `start_url` and `scope` are required because the site is served from a
subpath (`/myquizzlet/`), not a domain root.

- [ ] **Step 2: Make the icons**

Any 192×192 and 512×512 PNG will do; keep the artwork inside the middle 80% so
Android's maskable crop does not cut it. Generate two flat-coloured placeholders
with a letter Q if nothing better is to hand:

```bash
python3 - <<'PY'
import struct, zlib
def png(path, size, rgb):
    raw = b''.join(b'\x00' + bytes(rgb) * size for _ in range(size))
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c))
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
        + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
png('icons/icon-192.png', 192, (51, 51, 51))
png('icons/icon-512.png', 512, (51, 51, 51))
PY
```

- [ ] **Step 3: Write `sw.js`**

```javascript
const CACHE = 'myquizzlet-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './app/style.css',
  './app/main.js', './app/ui.js', './app/store.js', './app/github.js',
  './app/sync.js', './app/srs.js', './app/grade.js', './app/csv.js', './app/merge.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;   // never cache api.github.com
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  );
});
```

Network-first with a cache fallback: online you always get the code you just
pushed, offline you get the last copy. GitHub API requests are deliberately left
alone — caching them would resurrect stale shas and cause phantom conflicts.

Bump `CACHE` to `-v2`, `-v3`… whenever `SHELL` changes, or old files linger.

- [ ] **Step 4: Register it in `index.html` and link the manifest**

In `<head>`:

```html
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#333333">
```

At the end of `app/main.js`:

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
```

- [ ] **Step 5: Deploy and verify installation**

```bash
git add -A && git commit -m "feat: installable PWA with offline shell"
git push origin main
```

Enable Pages (Settings → Pages → `main` / root) if not already, wait a minute, then:

1. Open `https://cyrilpitrou.github.io/myquizzlet` on the laptop. Chrome shows an
   install icon in the address bar.
2. On Android Chrome, the menu offers **Install** (not merely "Add to Home
   screen"). Install it; it appears in the app drawer and opens with no address bar.
3. Long-press the icon: *Study* and *Add* shortcuts appear.
4. Enable airplane mode and open the app: it loads and a session runs; the dot is grey.
5. Disable airplane mode: the dot returns to green and the changes reach GitHub.
6. Paste a token on the phone (generated on the phone) and confirm a card added
   there reaches the laptop.

- [ ] **Step 6: Update the docs with anything that differed**

Re-read `README.md` against what you actually did and correct any step that did
not match reality. The README is the only artefact a future you will trust.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: correct setup steps against the real deployment"
git push origin main
```

---

## Deliberately not in this plan

Named here so a future session does not treat them as oversights:

- **Images on cards** — the spec rules them out; binary files in git are the one
  thing that would complicate storage badly.
- **Multiple choice and match games** — dropped during design; they add the least
  learning value per unit of code.
- **Spoken pronunciation** — cards are text-only. `frontLang` / `backLang` exist
  for accent handling in grading, not for speech.
- **An Android home-screen widget** — impossible for a web app; would require a
  native app. Manifest shortcuts (Task 12) are the substitute.
- **Automated browser tests** — the spec calls for screens to be verified by use.
  The pure modules carry the test suite.
- **A private repo** — if this is ever wanted, the change is a repo setting plus
  hosting the app on Cloudflare Pages. No code changes.
