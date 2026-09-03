# List import/export, side-swap, and PDF export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the list screen a shared file-import dialog with a preview/edit
step, move CSV export (and add PDF export) to the "⋮" menu, add whole-list
and single-card side-swapping, and make the "Paste text" / "Import file"
affordances in "Edit cards" and "New list" clearly labeled instead of one
ambiguous `<details>` block.

**Architecture:** Two new pure modules (`csv.js`'s extended delimiter
detection + a new `previewRows` export, and a brand-new `app/sides.js`) carry
the logic that must be exactly right and get unit tests, test-first. A new
`openDialog` helper in `app/ui.js` wraps a native `<dialog>` — no framework,
no library. A new `app/screens/importdialog.js` component is built on top of
it and is storage-agnostic: it takes an `onCommit(cards)` callback, so the
three call sites (menu, Edit cards, New list) each decide what "commit" means
without the dialog knowing which screen opened it. Screens
(`list.js`, `cards.js`, `editlist.js`) are wired up last and verified by
using them, per this project's testing convention — no headless-browser
suite.

**Tech Stack:** Hand-written ES modules, vanilla DOM (`app/ui.js`'s `el()`
helper), native `<dialog>`, `vitest` for pure-module unit tests.

**Spec:** `docs/superpowers/specs/2026-09-03-list-import-export-swap-design.md`

## Global Constraints

- No build step. Hand-written ES modules loaded directly by the browser.
  Never add a bundler, a framework, or a CDN script tag.
- Pure modules (`csv.js`, `sides.js`) get real unit tests, written test-first.
  Screens (`list.js`, `cards.js`, `editlist.js`, `importdialog.js`, the
  `ui.js` dialog helper) are verified by using them locally — do not add a
  headless-browser suite.
- Card ids are permanent. A single-card swap (§3b) corrects `front`/`back`
  text only and never touches progress keys; a whole-list swap (§3a) swaps
  `f2b`/`b2f` progress keys because it changes which skill each key tracks.
- Every new module must be added to `SHELL` in `sw.js`, with `CACHE` bumped
  in the same change — otherwise it is never cached and breaks offline.
- Never write a token into any file in this repo (not touched by this plan,
  but a standing rule for every change in this codebase).
- Personal tool, one user: keep additions minimal and consistent with
  existing patterns (`el()`, `menu()`, native `confirm()`) — no new
  abstractions beyond what the spec asks for.

---

## Task 1: `csv.js` — semicolon delimiter detection + `previewRows`

**Files:**
- Modify: `app/csv.js`
- Test: `test/csv.test.js`

**Interfaces:**
- Produces: `previewRows(text)` — `(string) => Array<{ front: string, back:
  string, error: string|null }>`, one entry per non-blank line, in the
  original line order. Used by Task 4's `importdialog.js` to build an
  editable preview that keeps failed lines in place instead of dropping
  them. `parseCards(text)` keeps its existing signature and return shape
  (`{ cards, errors }`); its behavior for callers is unchanged except that
  a line can now also be split on `;`.

- [ ] **Step 1: Write the failing tests**

Add to `test/csv.test.js`, inside the existing `describe('parseCards', ...)`
block (after the "parses tab-separated pairs" test):

```js
  it('parses semicolon-separated pairs', () => {
    expect(parseCards('el pan;le pain').cards).toEqual([{ front: 'el pan', back: 'le pain' }]);
  });

  it('prefers tab over semicolon when both are present on a line', () => {
    expect(parseCards('a;b\tc').cards).toEqual([{ front: 'a;b', back: 'c' }]);
  });
```

Add a new top-level `describe` block, and extend the import at the top of the
file:

```js
import { parseCards, toCsv, previewRows } from '../app/csv.js';
```

```js
describe('previewRows', () => {
  it('returns one row per non-blank line, in order', () => {
    expect(previewRows('a,b\n\nc,d')).toEqual([
      { front: 'a', back: 'b', error: null },
      { front: 'c', back: 'd', error: null },
    ]);
  });

  it('flags a line with no delimiter, but still returns its text for editing', () => {
    expect(previewRows('oops')).toEqual([{ front: 'oops', back: '', error: 'no separator found' }]);
  });

  it('flags a line with an empty side', () => {
    expect(previewRows('a,')).toEqual([{ front: 'a', back: '', error: 'empty side' }]);
  });

  it('respects semicolon as a delimiter', () => {
    expect(previewRows('el pan;le pain')).toEqual([{ front: 'el pan', back: 'le pain', error: null }]);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- csv`
Expected: the four new `parseCards`/`previewRows` tests fail — `previewRows`
is not exported yet, and the semicolon lines currently fail to split (no
comma/tab present, so today's code treats `;` as part of the field).

- [ ] **Step 3: Implement**

Replace the full contents of `app/csv.js` with:

```js
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

// One line, still carrying its own delimiter choice — tab first (it can't
// appear naturally in prose text), then semicolon, else comma. Returns null
// for a blank line (nothing to show, nothing to report), otherwise always a
// { front, back, error } row: even a line that fails to parse gets *some*
// front/back text, because the import dialog needs a row to make it editable.
function parseLine(line) {
  const trimmed = line.trim();
  if (trimmed === '') return null;
  const delimiter = trimmed.includes('\t') ? '\t' : trimmed.includes(';') ? ';' : ',';
  const fields = splitLine(trimmed, delimiter);
  if (fields.length < 2) return { front: trimmed, back: '', error: 'no separator found' };
  const front = fields[0];
  const back = fields.slice(1).join(delimiter);
  if (front === '' || back === '') return { front, back, error: 'empty side' };
  return { front, back, error: null };
}

export function parseCards(text) {
  const cards = [];
  const errors = [];
  String(text).split(/\r?\n/).forEach((raw, index) => {
    const parsed = parseLine(raw);
    if (!parsed) return;
    if (parsed.error) errors.push({ line: index + 1, reason: parsed.error });
    else cards.push({ front: parsed.front, back: parsed.back });
  });
  return { cards, errors };
}

// Same per-line parse as parseCards, but keeps every non-blank line — including
// the failed ones — in original order, for an editable preview.
export function previewRows(text) {
  return String(text).split(/\r?\n/).map(parseLine).filter((row) => row !== null);
}

function quote(value) {
  return /[",\n\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(cards) {
  return cards.map((c) => `${quote(c.front)},${quote(c.back)}`).join('\n');
}
```

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npm test -- csv`
Expected: PASS, all `parseCards`, `previewRows`, and `toCsv` tests green
(including the pre-existing ones — `parseLine`'s behavior for every existing
case is unchanged, just factored out).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS (no other module imports `csv.js`'s internals; `parseCards`'s
signature is unchanged).

- [ ] **Step 6: Commit**

```bash
git add app/csv.js test/csv.test.js
git commit -m "$(cat <<'EOF'
feat: semicolon as a card delimiter, and previewRows for the import dialog

csv.js now picks tab / semicolon / comma per line, in that preference
order, and exports previewRows(text) — one row per non-blank line, in
order, with failed lines flagged but still editable. parseCards's own
signature and behavior for existing callers are unchanged.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01LmuZbS1aarkzMjmQUxxkda
EOF
)"
```

---

## Task 2: `app/sides.js` — pure swap-sides function

**Files:**
- Create: `app/sides.js`
- Test: `test/sides.test.js`
- Modify: `sw.js` (add the new module to `SHELL`, bump `CACHE`)

**Interfaces:**
- Consumes: nothing beyond the list/progress shapes described in
  `docs/data-model.md` (list: `{ frontLabel, backLabel, frontLang, backLang,
  cards: [{ id, front, back }] }`; progress: `{ listId, updatedAt, items: {
  '<cardId>:f2b': {...}, '<cardId>:b2f': {...} } }`).
- Produces: `swapSides({ list, progress })` — pure, returns a **new**
  `{ list, progress }` pair (does not mutate its inputs). Task 3's
  `store.swapSides(id)` calls this and persists the result.

- [ ] **Step 1: Write the failing tests**

Create `test/sides.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { swapSides } from '../app/sides.js';

describe('swapSides', () => {
  const list = {
    id: 'es-food', name: 'Spanish – Food', folder: 'Languages',
    frontLabel: 'Español', backLabel: 'Français', frontLang: 'es', backLang: 'fr',
    cards: [
      { id: 'a1', front: 'el pan', back: 'le pain' },
      { id: 'b2', front: 'la leche', back: 'le lait' },
      { id: 'c3', front: 'el agua', back: "l'eau" },
    ],
  };
  const progress = {
    listId: 'es-food',
    items: {
      'a1:f2b': { box: 3, due: '2026-09-08', seen: 7, lapses: 1, lastSeen: '2026-09-01T10:00:00Z' },
      'a1:b2f': { box: 1, due: '2026-09-02', seen: 4, lapses: 3, lastSeen: '2026-09-01T10:05:00Z' },
      'b2:f2b': { box: 2, due: '2026-09-03', seen: 2, lapses: 0, lastSeen: '2026-09-01T09:00:00Z' },
      // c3 has no progress at all.
    },
  };

  it('swaps the list labels and languages', () => {
    const { list: swapped } = swapSides({ list, progress });
    expect(swapped.frontLabel).toBe('Français');
    expect(swapped.backLabel).toBe('Español');
    expect(swapped.frontLang).toBe('fr');
    expect(swapped.backLang).toBe('es');
  });

  it('leaves other list fields untouched', () => {
    const { list: swapped } = swapSides({ list, progress });
    expect(swapped.id).toBe('es-food');
    expect(swapped.name).toBe('Spanish – Food');
    expect(swapped.folder).toBe('Languages');
  });

  it('swaps front and back text on every card, keeping ids', () => {
    const { list: swapped } = swapSides({ list, progress });
    expect(swapped.cards).toEqual([
      { id: 'a1', front: 'le pain', back: 'el pan' },
      { id: 'b2', front: 'le lait', back: 'la leche' },
      { id: 'c3', front: "l'eau", back: 'el agua' },
    ]);
  });

  it('swaps f2b and b2f progress for a card with both directions studied', () => {
    const { progress: swapped } = swapSides({ list, progress });
    expect(swapped.items['a1:b2f']).toEqual(progress.items['a1:f2b']);
    expect(swapped.items['a1:f2b']).toEqual(progress.items['a1:b2f']);
  });

  it('swaps the key of a card with only one direction studied', () => {
    const { progress: swapped } = swapSides({ list, progress });
    expect(swapped.items['b2:b2f']).toEqual(progress.items['b2:f2b']);
    expect(swapped.items['b2:f2b']).toBeUndefined();
  });

  it('has no entries for a card with no progress at all', () => {
    const { progress: swapped } = swapSides({ list, progress });
    expect(swapped.items['c3:f2b']).toBeUndefined();
    expect(swapped.items['c3:b2f']).toBeUndefined();
  });

  it('keeps listId on the progress record', () => {
    const { progress: swapped } = swapSides({ list, progress });
    expect(swapped.listId).toBe('es-food');
  });

  it('is pure: does not mutate its inputs', () => {
    const beforeList = JSON.parse(JSON.stringify(list));
    const beforeProgress = JSON.parse(JSON.stringify(progress));
    swapSides({ list, progress });
    expect(list).toEqual(beforeList);
    expect(progress).toEqual(beforeProgress);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- sides`
Expected: FAIL — `app/sides.js` does not exist yet (`Cannot find module`).

- [ ] **Step 3: Implement**

Create `app/sides.js`:

```js
// Swaps which side is "front" and which is "back" for a whole list: labels,
// languages, every card's text, and — the part that's easy to get wrong —
// each card's progress. Progress keys are `<cardId>:f2b` / `<cardId>:b2f`,
// naming a *skill* (recognising vs. producing), not a column. Swapping the
// columns without swapping the keys would silently swap what a card's SRS
// state means, so the keys move to keep tracking the same skill.
export function swapSides({ list, progress }) {
  const cards = list.cards.map((card) => ({ ...card, front: card.back, back: card.front }));

  const items = {};
  for (const [key, value] of Object.entries(progress.items || {})) {
    const cardId = key.slice(0, key.lastIndexOf(':'));
    const direction = key.slice(key.lastIndexOf(':') + 1);
    const swappedDirection = direction === 'f2b' ? 'b2f' : 'f2b';
    items[`${cardId}:${swappedDirection}`] = value;
  }

  return {
    list: {
      ...list,
      frontLabel: list.backLabel,
      backLabel: list.frontLabel,
      frontLang: list.backLang,
      backLang: list.frontLang,
      cards,
    },
    progress: { ...progress, items },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- sides`
Expected: PASS, all `swapSides` tests green.

- [ ] **Step 5: Add the new module to the offline shell**

`sw.js`'s own test (`test/sw.test.js`) checks that every `.js` file in
`app/` is listed in `SHELL` — it will now fail until this step is done. In
`sw.js`, bump `CACHE` and add the new module, alphabetically alongside its
neighbors:

```js
const CACHE = 'myquizzlet-v17';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './app/style.css',
  './icons/icon-192.png', './icons/icon-512.png',
  './app/main.js', './app/app.js', './app/status.js', './app/ui.js',
  './app/store.js', './app/github.js', './app/sync.js', './app/srs.js',
  './app/grade.js', './app/csv.js', './app/merge.js', './app/sides.js',
  './app/langs.js', './app/stats.js', './app/train.js', './app/listform.js',
  './app/qr.js', './app/qrcard.js', './app/tokenshare.js', './app/setup.js', './app/zip.js', './app/install.js',
  './app/screens/lists.js', './app/screens/list.js', './app/screens/cards.js',
  './app/screens/test.js', './app/screens/settings.js',
  './app/screens/folders.js', './app/screens/editlist.js', './app/screens/view.js',
  './app/screens/train.js', './app/screens/help.js', './app/screens/adopt.js',
  './app/screens/token.js',
];
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS, including `test/sw.test.js`'s "lists every module in app/"
check.

- [ ] **Step 7: Commit**

```bash
git add app/sides.js test/sides.test.js sw.js
git commit -m "$(cat <<'EOF'
feat: swapSides — pure whole-list side-swap, labels/cards/progress together

New app/sides.js: swaps frontLabel/backLabel, frontLang/backLang, every
card's front/back text, and each card's f2b/b2f progress keys (a key
names a skill — recognising vs. producing — not a column, so it has to
move with the swap or a card's SRS state would silently mean the wrong
thing). Pure and unit-tested; store.swapSides (next) wires it to storage.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01LmuZbS1aarkzMjmQUxxkda
EOF
)"
```

---

## Task 3: `store.js` — `swapSides` method

**Files:**
- Modify: `app/store.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: `swapSides({ list, progress })` from Task 2's `app/sides.js`.
- Produces: `store.swapSides(id)` — `(string) => { list, progress }`, both
  already saved (list via the existing `saveList`, progress via the
  existing `saveProgress`, so both get `markDirty`'d for sync the same way
  every other mutation does). Throws `no such list: <id>` for an unknown
  id, matching `mutateCards`'s existing behavior. Used by Task 7's "Swap
  sides" button in `editlist.js`.

- [ ] **Step 1: Write the failing tests**

Add to `test/store.test.js`, as a new top-level `describe` block (after
`describe('list metadata', ...)`):

```js
describe('swap sides', () => {
  it('swaps list labels, card text, and progress keys together', () => {
    const store = createStore(fakeStorage(), () => FIXED);
    const list = store.createList({ name: 'Spanish – Food', frontLabel: 'Español', backLabel: 'Français',
                                    frontLang: 'es', backLang: 'fr' });
    const id = store.addCards(list.id, [{ front: 'el pan', back: 'le pain' }]).cards[0].id;
    store.saveProgress({ listId: list.id, items: { [`${id}:f2b`]: { box: 3, lastSeen: '2026-09-01T10:00:00Z' } } });

    const result = store.swapSides(list.id);

    expect(result.list.frontLabel).toBe('Français');
    expect(result.list.backLabel).toBe('Español');
    expect(result.list.cards[0]).toEqual({ id, front: 'le pain', back: 'el pan' });
    expect(result.progress.items[`${id}:b2f`].box).toBe(3);
    expect(result.progress.items[`${id}:f2b`]).toBeUndefined();
  });

  it('persists the swap to storage', () => {
    const store = createStore(fakeStorage(), () => FIXED);
    const list = store.createList({ name: 'Food', frontLabel: 'A', backLabel: 'B' });
    store.swapSides(list.id);
    expect(store.getList(list.id).frontLabel).toBe('B');
  });

  it('marks both list and progress dirty', () => {
    const store = createStore(fakeStorage(), () => FIXED);
    const list = store.createList({ name: 'Food' });
    store.swapSides(list.id);
    expect(store.dirtyKeys().sort()).toEqual([`list:${list.id}`, `progress:${list.id}`]);
  });

  it('throws for an unknown list', () => {
    const store = createStore(fakeStorage(), () => FIXED);
    expect(() => store.swapSides('nope')).toThrow('no such list: nope');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- store`
Expected: FAIL — `store.swapSides is not a function`.

- [ ] **Step 3: Implement**

In `app/store.js`, add the import at the top of the file:

```js
import { swapSides as swapListSides } from './sides.js';
```

Add the method to the object returned by `createStore` — place it right
after `deleteCard`:

```js
    deleteCard: (listId, cardId) => mutateCards(listId, (cards) =>
      cards.filter((c) => c.id !== cardId)),
    swapSides(id) {
      const list = getList(id);
      if (!list) throw new Error(`no such list: ${id}`);
      const swapped = swapListSides({ list, progress: this.getProgress(id) });
      const savedList = saveList(swapped.list);
      const savedProgress = this.saveProgress(swapped.progress);
      return { list: savedList, progress: savedProgress };
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- store`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/store.js test/store.test.js
git commit -m "$(cat <<'EOF'
feat: store.swapSides — persist a whole-list side-swap

Wires the pure swapSides from sides.js to storage: reads the list and
its progress, swaps them together, and saves both through the existing
saveList/saveProgress paths so the change is marked dirty and synced
like any other edit.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01LmuZbS1aarkzMjmQUxxkda
EOF
)"
```

---

## Task 4: `ui.js` modal helper + shared `importdialog.js` component

**Files:**
- Modify: `app/ui.js` (add `openDialog`)
- Modify: `app/style.css` (dialog + import-row styles)
- Create: `app/screens/importdialog.js`
- Modify: `sw.js` (add the new module to `SHELL`, bump `CACHE`)

**Interfaces:**
- Consumes: `previewRows(text)` from Task 1's `app/csv.js`.
- Produces:
  - `openDialog(children)` in `ui.js` — `(Node[]) => HTMLDialogElement`.
    Appends a native `<dialog class="dialog">` to `document.body`, opens it
    with `showModal()`, and removes it from the DOM on its `close` event
    (fired by `.close()` or by the browser's own Escape handling — nothing
    extra needed for either).
  - `openImportDialog({ onCommit })` in `importdialog.js` —
    `({ onCommit: (cards: {front,back}[]) => void }) => HTMLDialogElement`.
    Builds the file-picker + editable preview described in the spec's §1 on
    top of `openDialog`, and calls `onCommit` with the current non-error
    rows (trimmed) when "Import N cards" is clicked, then closes itself.
    Storage-agnostic — used unchanged by Task 5 (menu), Task 6 (Edit
    cards), and Task 7 (New list), which each supply a different
    `onCommit`.

No screen calls `openImportDialog` yet after this task — it is exercised
directly from the browser console (see Step 4) rather than through a UI
entry point, which arrives in Task 5.

- [ ] **Step 1: Add the dialog helper to `ui.js`**

In `app/ui.js`, add after `menu(items)`:

```js
// A native <dialog>-backed modal. The caller supplies its full content,
// including whatever closes it (a button calling the returned node's
// .close()) — Escape and .close() both fire the dialog's own 'close' event,
// which is the only cleanup needed: no framework, no extra dismissal logic.
export function openDialog(children) {
  const node = el('dialog', { class: 'dialog' }, children);
  document.body.append(node);
  node.addEventListener('close', () => node.remove());
  node.showModal();
  return node;
}
```

- [ ] **Step 2: Add dialog and import-row styles**

Append to the end of `app/style.css` (after the `.optin .qr-card { max-width:
14rem; }` rule):

```css

dialog.dialog { border: 1px solid var(--rule); border-radius: 14px; background: var(--surface);
  color: var(--ink); padding: 1.25rem; max-width: 30rem; width: 90vw; }
dialog.dialog::backdrop { background: rgba(0, 0, 0, .45); }
dialog.dialog h2 { margin-top: 0; }
.import-rows { max-height: 45vh; overflow-y: auto; margin: .75rem 0; }
.import-row { display: flex; gap: .4rem; align-items: center; padding: .4rem 0;
  border-bottom: 1px solid var(--rule); }
.import-row input { flex: 1; min-width: 0; }
.import-row.error input { border-color: var(--bad); }
.import-row .reason { font-size: .8rem; color: var(--bad); white-space: nowrap; }
.dialog-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .75rem; }
```

- [ ] **Step 3: Implement `app/screens/importdialog.js`**

Create `app/screens/importdialog.js`:

```js
import { el, clear, openDialog } from '../ui.js';
import { previewRows } from '../csv.js';

const ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain';

function rowNode(row, onEdit, onRemove) {
  const frontInput = el('input', {
    value: row.front,
    oninput: (event) => { row.front = event.target.value; onEdit(row); },
  });
  const backInput = el('input', {
    value: row.back,
    oninput: (event) => { row.back = event.target.value; onEdit(row); },
  });
  const children = [frontInput, backInput];
  if (row.error) children.push(el('span', { class: 'reason', text: row.error }));
  children.push(el('button', {
    class: 'link', text: '✕', title: 'remove', type: 'button', onclick: onRemove,
  }));
  return el('div', { class: row.error ? 'import-row error' : 'import-row' }, children);
}

// Opens the shared file-import dialog: a styled file picker, then an
// editable preview (one row per line, failed lines flagged but still
// editable), then a commit button. Storage-agnostic — onCommit(cards) is
// called with the current non-error rows and the caller decides what
// "commit" means (write straight to a list, or stage into a draft).
export function openImportDialog({ onCommit }) {
  let rows = [];
  const rowsWrap = el('div', { class: 'import-rows' });
  const commitBtn = el('button', {
    class: 'primary', type: 'button', text: 'Import 0 cards', disabled: 'disabled',
  });

  function updateCommit() {
    const n = rows.filter((r) => !r.error).length;
    commitBtn.textContent = `Import ${n} cards`;
    commitBtn.disabled = n === 0;
  }

  function renderRows() {
    clear(rowsWrap);
    rows.forEach((row, index) => rowsWrap.append(rowNode(
      row,
      () => {
        if (row.error && row.front.trim() && row.back.trim()) { row.error = null; renderRows(); return; }
        updateCommit();
      },
      () => { rows.splice(index, 1); renderRows(); },
    )));
    updateCommit();
  }

  const file = el('input', {
    type: 'file', accept: ACCEPT, hidden: 'hidden',
    onchange: async (event) => {
      const chosen = event.target.files[0];
      if (!chosen) return;
      const text = await chosen.text();
      rows = previewRows(text);
      renderRows();
    },
  });
  const pickButton = el('button', {
    class: 'btn', type: 'button', text: 'Choose file…', onclick: () => file.click(),
  });

  const cancelBtn = el('button', { class: 'btn', type: 'button', text: 'Cancel',
    onclick: () => node.close() });
  commitBtn.addEventListener('click', () => {
    onCommit(rows.filter((r) => !r.error).map((r) => ({ front: r.front.trim(), back: r.back.trim() })));
    node.close();
  });

  const node = openDialog([
    el('h2', { text: 'Import file' }),
    el('p', { class: 'muted', text: 'Cards come from a file with two values per line, '
      + 'separated by comma, semicolon, or tab. A value that contains the delimiter '
      + 'should be wrapped in quotes.' }),
    el('div', { class: 'row' }, [pickButton, file]),
    rowsWrap,
    el('div', { class: 'dialog-actions' }, [cancelBtn, commitBtn]),
  ]);

  return node;
}
```

- [ ] **Step 4: Manually verify the dialog in the browser**

Run: `npm run dev` (or `python3 -m http.server 8000`), open
`http://localhost:8000`.

There is no UI entry point yet, so exercise the module directly from the
browser's devtools console:

```js
const { openImportDialog } = await import('./app/screens/importdialog.js');
openImportDialog({ onCommit: (cards) => console.log('committed', cards) });
```

Create a small test file (e.g. in the scratchpad directory) with:

```
el pan,le pain
la leche;le lait
oops
a,
```

In the dialog: click "Choose file…" and pick it. Confirm:
- 4 rows appear, in that order.
- Row 1 and 2 show `el pan`/`le pain` and `la leche`/`le lait`, no error.
- Row 3 ("oops") is flagged "no separator found"; its front field shows
  `oops`, back is empty.
- Row 4 ("a,") is flagged "empty side"; front shows `a`, back is empty.
- "Import N cards" reads "Import 2 cards" (the two clean rows) and is
  enabled; row 3 and 4 don't count.
- Editing row 3's back field to any non-empty text clears its error
  styling and the count updates to 3.
- Clicking a row's ✕ removes it and updates the count.
- Clicking "Import N cards" logs the expected `{front, back}[]` to the
  console and closes the dialog.
- Reopening and pressing Escape also closes it (and removes the `<dialog>`
  from the DOM — check via devtools Elements panel).

- [ ] **Step 5: Add the new module to the offline shell**

In `sw.js`, bump `CACHE` again and add the new screen module:

```js
const CACHE = 'myquizzlet-v18';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './app/style.css',
  './icons/icon-192.png', './icons/icon-512.png',
  './app/main.js', './app/app.js', './app/status.js', './app/ui.js',
  './app/store.js', './app/github.js', './app/sync.js', './app/srs.js',
  './app/grade.js', './app/csv.js', './app/merge.js', './app/sides.js',
  './app/langs.js', './app/stats.js', './app/train.js', './app/listform.js',
  './app/qr.js', './app/qrcard.js', './app/tokenshare.js', './app/setup.js', './app/zip.js', './app/install.js',
  './app/screens/lists.js', './app/screens/list.js', './app/screens/cards.js',
  './app/screens/test.js', './app/screens/settings.js',
  './app/screens/folders.js', './app/screens/editlist.js', './app/screens/view.js',
  './app/screens/train.js', './app/screens/help.js', './app/screens/adopt.js',
  './app/screens/token.js', './app/screens/importdialog.js',
];
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS, including `test/sw.test.js`.

- [ ] **Step 7: Commit**

```bash
git add app/ui.js app/style.css app/screens/importdialog.js sw.js
git commit -m "$(cat <<'EOF'
feat: shared import-preview dialog, on a new native-<dialog> modal helper

ui.js gains openDialog(children), a thin wrapper around a native
<dialog> — no framework needed for a modal. app/screens/importdialog.js
builds the file-import flow from the design spec on top of it: a styled
file picker, an editable per-line preview (failed lines flagged but
still editable), and a commit button. Storage-agnostic — takes an
onCommit(cards) callback, not yet wired into any screen.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01LmuZbS1aarkzMjmQUxxkda
EOF
)"
```

---

## Task 5: "⋮" menu — Import from file, Export as CSV, Generate PDF

**Files:**
- Modify: `app/screens/list.js`

**Interfaces:**
- Consumes: `openImportDialog` (Task 4), `toCsv` (existing, `app/csv.js`),
  `store.addCards` (existing).
- Produces: nothing consumed by later tasks — this is the first screen
  wired to the new dialog, so it's also the first full manual test of the
  whole import flow end to end.

- [ ] **Step 1: Add CSV export, PDF export, and file import to `list.js`**

Replace the top of `app/screens/list.js` (imports) with:

```js
import { el, menu } from '../ui.js';
import { store, screen, go, todayStr, ctx } from '../app.js';
import { listStats } from '../stats.js';
import { toCsv } from '../csv.js';
import { openImportDialog } from './importdialog.js';
```

Add these functions after `deleteList` and before `showList`:

```js
function importFromFile(list) {
  openImportDialog({
    onCommit: (cards) => {
      if (!cards.length) return;
      store.addCards(list.id, cards);
      ctx.sync?.schedule();
      ctx.render();
    },
  });
}

function exportCsv(list) {
  const blob = new Blob([toCsv(list.cards)], { type: 'text/csv' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `${list.id}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function generatePdf(list) {
  const frontLabel = list.frontLabel || 'Front';
  const backLabel = list.backLabel || 'Back';
  const rows = list.cards.map((c) =>
    `<tr><td>${escapeHtml(c.front)}</td><td>${escapeHtml(c.back)}</td></tr>`).join('');
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(list.name)}</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; padding: 1.5rem; color: #1c1917; }
  h1 { font-size: 1.3rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { border: 1px solid #ccc; padding: .4rem .6rem; text-align: left; }
  th { background: #f3f3f3; }
</style>
</head>
<body>
<h1>${escapeHtml(list.name)}</h1>
<table>
  <tr><th>${escapeHtml(frontLabel)}</th><th>${escapeHtml(backLabel)}</th></tr>
  ${rows}
</table>
<script>window.onload = () => window.print();</script>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
```

In `showList`, update the `menu([...])` call to insert the three new items
between `'Edit cards'` and `'Delete list'`:

```js
    menu([
      { label: 'Rename', onclick: () => renameList(list) },
      { label: 'Move to folder', onclick: () => moveToFolder(list) },
      { label: 'Sides', onclick: () => go(`#/list/${id}/edit`) },
      { label: 'Edit cards', onclick: () => go(`#/list/${id}/cards`) },
      { label: 'Import from file', onclick: () => importFromFile(list) },
      { label: 'Export as CSV', onclick: () => exportCsv(list) },
      { label: 'Generate PDF', onclick: () => generatePdf(list) },
      { label: 'Delete list', onclick: () => deleteList(list) },
    ]),
```

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev`, open `http://localhost:8000`, create or open a list with
a few cards.

- Open the "⋮" menu on the list screen. Confirm the three new items appear
  in order, between "Edit cards" and "Delete list".
- Click "Export as CSV": a `<listId>.csv` file downloads; open it and
  confirm it's the list's cards, comma-delimited, matching `toCsv`'s
  existing output.
- Click "Generate PDF": a new tab opens with a heading (the list's title), a
  two-column table (headed by the list's front/back labels, or "Front"/
  "Back" for a list without labels), one row per card, and the browser's
  print dialog appears automatically.
- Click "Import from file": the Task 4 dialog opens. Pick a small CSV/TSV
  file, confirm the preview, click "Import N cards". Confirm the dialog
  closes and the list screen (still on `#/list/<id>`) now shows the
  increased card count.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (no pure-module changes in this task).

- [ ] **Step 4: Commit**

```bash
git add app/screens/list.js
git commit -m "$(cat <<'EOF'
feat: move CSV export to the ⋮ menu, add PDF export and file import there

CSV export moves from "Edit cards" (where it sat next to card rows it
had nothing to do with) to the list's own "⋮" menu, alongside a new
"Generate PDF" (a printable page via window.print() — no PDF library
fits the no-build-step, no-CDN-script constraint) and "Import from
file" (the shared dialog from importdialog.js).

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01LmuZbS1aarkzMjmQUxxkda
EOF
)"
```

---

## Task 6: "Edit cards" — drop CSV export, headed import blocks, per-card swap

**Files:**
- Modify: `app/screens/cards.js`
- Modify: `app/style.css` (swap-button color, wider actions column)

**Interfaces:**
- Consumes: `openImportDialog` (Task 4), `parseCards` (existing,
  `app/csv.js`), `store.addCards` / `store.updateCard` (existing).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Rewrite `app/screens/cards.js`**

Replace the full contents of `app/screens/cards.js` with:

```js
import { el, $ } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { parseCards } from '../csv.js';
import { openImportDialog } from './importdialog.js';

function editableCell(listId, card, side) {
  return el('input', {
    value: card[side],
    onchange: (event) => {
      store.updateCard(listId, card.id, { [side]: event.target.value.trim() });
      ctx.sync?.schedule();
    },
  });
}

function pasteBlock(listId) {
  const box = el('textarea', {
    placeholder: 'Paste rows: el pan, le pain — one card per line. Tabs work too.',
    rows: '4',
  });
  const status = el('p', { class: 'muted', id: 'import-status' });
  const doImport = () => {
    const { cards, errors } = parseCards(box.value);
    if (cards.length) { store.addCards(listId, cards); ctx.sync?.schedule(); }
    box.value = '';
    status.textContent = errors.length
      ? `Imported ${cards.length}. Skipped lines: ${errors.map((e) => e.line).join(', ')}.`
      : `Imported ${cards.length}.`;
    ctx.render();
    $('#import-status')?.replaceWith(status);
  };
  return el('div', { class: 'io' }, [
    el('h3', { text: 'Paste text' }),
    el('p', { class: 'muted', text: 'One card per line, front and back separated by a '
      + 'comma, semicolon, or tab.' }),
    box,
    el('button', { text: 'Import pasted text', type: 'button', onclick: doImport }),
    status,
  ]);
}

function fileBlock(listId) {
  return el('div', { class: 'io' }, [
    el('h3', { text: 'Import file' }),
    el('p', { class: 'muted', text: 'CSV, TSV, or text file.' }),
    el('button', {
      class: 'btn', type: 'button', text: 'Import file…',
      onclick: () => openImportDialog({
        onCommit: (cards) => {
          if (!cards.length) return;
          store.addCards(listId, cards);
          ctx.sync?.schedule();
          ctx.render();
        },
      }),
    }),
  ]);
}

export function showCards(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const frontLabel = list.frontLabel || 'Front';
  const backLabel = list.backLabel || 'Back';

  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));
  view.append(el('h2', { text: `${list.cards.length} cards` }));

  const front = el('input', { placeholder: frontLabel.toLowerCase() });
  const back = el('input', { placeholder: backLabel.toLowerCase() });
  view.append(el('form', {
    class: 'addcard',
    onsubmit: (event) => {
      event.preventDefault();
      if (!front.value.trim() || !back.value.trim()) return;
      store.addCards(id, [{ front: front.value.trim(), back: back.value.trim() }]);
      ctx.sync?.schedule();
      front.value = '';
      back.value = '';
      ctx.render();
      $('.addcard input')?.focus();
    },
  }, [front, back, el('button', { type: 'submit', text: 'Add' })]));

  const table = el('table', { class: 'cards' }, [
    el('tr', {}, [el('th', { text: frontLabel }), el('th', { text: backLabel }), el('th', {})]),
  ]);
  for (const card of list.cards) {
    table.append(el('tr', {}, [
      el('td', {}, [editableCell(id, card, 'front')]),
      el('td', {}, [editableCell(id, card, 'back')]),
      el('td', {}, [el('div', { class: 'rowactions' }, [
        el('button', {
          class: 'link swap', text: '⇄', title: 'swap sides', type: 'button',
          onclick: () => {
            store.updateCard(id, card.id, { front: card.back, back: card.front });
            ctx.sync?.schedule();
            ctx.render();
          },
        }),
        el('button', {
          class: 'link', text: '✕', title: 'delete', type: 'button',
          onclick: () => { store.deleteCard(id, card.id); ctx.sync?.schedule(); ctx.render(); },
        }),
      ])]),
    ]));
  }
  view.append(table);
  view.append(pasteBlock(id));
  view.append(fileBlock(id));
}
```

This removes the old `importExport()` function (and with it, the "Export
CSV" button — it now lives only in the "⋮" menu, added in Task 5) and
replaces the single `<details class="io">` block with two always-visible,
separately headed blocks. Each card row gains a swap button (⇄) next to the
existing delete button (✕), both now inside a `.rowactions` wrapper in the
row's last cell.

- [ ] **Step 2: Update `app/style.css`**

The last cell now holds two buttons instead of one, and the swap button
should read as neutral, not destructive (that's `.link`'s default red,
correct for delete, wrong for swap). Change:

```css
table.cards td:last-child { width: 3rem; }
```

to:

```css
table.cards td:last-child { width: 4.75rem; }
```

and add, near the other `table.cards` rules:

```css
.rowactions { display: flex; gap: .25rem; justify-content: flex-end; }
button.link.swap { color: var(--ink); }
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, open `http://localhost:8000`, open "Edit cards" for a
list with at least two cards.

- Confirm the table's last column shows two small buttons per row: ⇄ then
  ✕, and both are comfortably tappable (not cramped).
- Click a row's ⇄: that row's front/back swap immediately, no
  confirmation. Reload the page and confirm the swap persisted.
- Click a row's ✕: that card is deleted, as before.
- Confirm the page now shows two headed blocks below the table: "Paste
  text" (with its one-line instruction, textarea, and "Import pasted text"
  button) and "Import file" (with its one-line instruction and "Import
  file…" button) — no `<details>`/collapsed toggle, both always visible.
- Paste a couple of rows into "Paste text" and click "Import pasted text":
  cards are added immediately, a status line reports the count (and any
  skipped line numbers), matching the pre-existing behavior.
- Click "Import file…": the Task 4 dialog opens; commit adds cards
  directly to this list (no staging) and the table updates.
- Confirm there is no "Export CSV" button anywhere on this screen anymore.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/screens/cards.js app/style.css
git commit -m "$(cat <<'EOF'
feat: per-card swap button, headed import blocks, CSV export removed

"Edit cards" drops the "Export CSV" button (moved to the ⋮ menu) and
replaces the single ambiguous import <details> with two always-visible,
separately headed blocks: "Paste text" (unchanged immediate-import
behavior) and "Import file" (the shared dialog). Each card row gains a
⇄ swap button next to ✕ — a trivially reversible data-entry fix that,
unlike the whole-list swap, only touches that card's text.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01LmuZbS1aarkzMjmQUxxkda
EOF
)"
```

---

## Task 7: "New list" staged import blocks + "Sides" screen Swap sides button

**Files:**
- Modify: `app/screens/editlist.js`

**Interfaces:**
- Consumes: `openImportDialog` (Task 4), `parseCards` (existing,
  `app/csv.js`), `store.swapSides` (Task 3), `store.addCards` (existing).
- Produces: nothing consumed by later tasks — this is the last task in the
  plan.

- [ ] **Step 1: Rewrite `app/screens/editlist.js`**

Replace the full contents of `app/screens/editlist.js` with:

```js
import { el } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { listForm } from '../listform.js';
import { parseCards } from '../csv.js';
import { openImportDialog } from './importdialog.js';

// New list has no storage yet, so both import blocks stage into this
// in-memory array instead of writing straight to a list; showNewList's
// onSave hands it to store.addCards once the list itself is created.
function draftPasteBlock(draftCards, status) {
  const box = el('textarea', {
    placeholder: 'Optional — paste rows: el pan, le pain — one card per line. Tabs work too.',
    rows: '4',
  });
  const stage = () => {
    const { cards, errors } = parseCards(box.value);
    if (cards.length) draftCards.push(...cards);
    box.value = '';
    status.textContent = errors.length
      ? `Staged ${cards.length}. Skipped lines: ${errors.map((e) => e.line).join(', ')}.`
      : cards.length ? `Staged ${cards.length}.` : '';
  };
  return el('div', { class: 'io' }, [
    el('h3', { text: 'Paste text' }),
    el('p', { class: 'muted', text: 'One card per line, front and back separated by a '
      + 'comma, semicolon, or tab.' }),
    box,
    el('button', { text: 'Stage pasted text', type: 'button', onclick: stage }),
  ]);
}

function draftFileBlock(draftCards, status) {
  return el('div', { class: 'io' }, [
    el('h3', { text: 'Import file' }),
    el('p', { class: 'muted', text: 'CSV, TSV, or text file.' }),
    el('button', {
      class: 'btn', type: 'button', text: 'Import file…',
      onclick: () => openImportDialog({
        onCommit: (cards) => {
          if (!cards.length) return;
          draftCards.push(...cards);
          status.textContent = `Staged ${cards.length}.`;
        },
      }),
    }),
  ]);
}

export function showNewList() {
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'New list' }));

  const draftCards = [];
  const status = el('p', { class: 'muted' });

  view.append(listForm({
    onSave: (fields) => {
      const list = store.createList(fields);
      if (draftCards.length) store.addCards(list.id, draftCards);
      ctx.sync?.schedule();
      go(`#/list/${list.id}`);
    },
  }));
  view.append(draftPasteBlock(draftCards, status));
  view.append(draftFileBlock(draftCards, status));
  view.append(status);
}

function confirmSwapSides(list) {
  const ok = confirm(`Swap sides of "${list.name}"?\n\n`
    + `${list.frontLabel || 'Front'} and ${list.backLabel || 'Back'} trade places on `
    + "every card, and each card's learning history moves with the skill it tracks.");
  if (!ok) return;
  store.swapSides(list.id);
  ctx.sync?.schedule();
  ctx.render();
}

export function showEditList(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));
  view.append(el('h2', { text: 'Sides' }));
  view.append(listForm({
    list,
    sidesOnly: true,
    onSave: (fields) => {
      store.updateMeta(id, fields);
      ctx.sync?.schedule();
      go(`#/list/${id}`);
    },
  }));
  view.append(el('div', { class: 'actions' }, [
    el('button', { class: 'btn', type: 'button', text: 'Swap sides',
      onclick: () => confirmSwapSides(list) }),
  ]));
}
```

`draftCards` staged via the paste block or the file dialog behave the same
way from the form's point of view: both just push `{front, back}` objects
into the same array, read once at `onSave`. The status line is shared by
both blocks so the user sees a running "Staged N" total regardless of which
one they used.

- [ ] **Step 2: Manually verify "New list" in the browser**

Run: `npm run dev`, open `http://localhost:8000`, go to "New list".

- Confirm the screen shows the existing Title/Folder/side-label form, then
  two headed blocks below it: "Paste text" and "Import file" (no
  `<details>` toggle).
- Paste two rows into "Paste text" and click "Stage pasted text": the
  status line shows "Staged 2." (the textarea clears; no list exists yet,
  nothing is written to storage — confirm via devtools
  `localStorage` that no `mq:list:*` key was created).
- Click "Import file…", pick a file with two more valid rows, commit: the
  status line updates to "Staged 2." again (this block reuses the same
  `status` node).
- Fill in Title and click "Create list": you land on the new list's screen
  showing 4 cards total (2 from paste + 2 from the file).

- [ ] **Step 3: Manually verify "Swap sides" in the browser**

On an existing list with a few cards: study at least one card in both
directions (via Train) so it has both an `f2b` and a `b2f` progress record,
and note its box/level values in devtools
(`JSON.parse(localStorage.getItem('mq:progress:<id>')).items`).

- Open the list's "⋮" menu → "Sides". Confirm a "Swap sides" button appears
  below the existing label form.
- Click it: a `confirm()` dialog appears naming the current labels. Cancel
  it — confirm nothing changes.
- Click it again and accept. Confirm:
  - The Sides screen's label fields now show the labels swapped.
  - Back on the list screen (`#/list/<id>`), the "Front → Back" summary
    line shows the labels swapped, and each card's front/back text is
    swapped (check "Edit cards" or "View cards").
  - In devtools, `mq:progress:<id>`'s items now have the box/level values
    that were under `<cardId>:f2b` sitting under `<cardId>:b2f` (and vice
    versa) — the studied card's learning history followed the skill, not
    the key.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/screens/editlist.js
git commit -m "$(cat <<'EOF'
feat: New list stages both import paths into its draft; Sides gets Swap sides

showNewList restructures its single import <details> into the same
"Paste text" / "Import file" pair cards.js now uses, except both stage
into an in-memory draft (there's no list yet to write to) that's handed
to store.addCards once the list is created. showEditList's Sides screen
gains a confirmed "Swap sides" button, wired to store.swapSides.

Cyril Pitrou
Claude-Session: https://claude.ai/code/session_01LmuZbS1aarkzMjmQUxxkda
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (shared dialog) → Task 4; §2 (menu CSV/PDF/import)
  → Task 5; §3a (whole-list swap) → Tasks 2, 3, 7; §3b (per-card swap) →
  Task 6; §4 (headed import blocks in Edit cards / New list) → Tasks 6, 7;
  `csv.js`'s semicolon delimiter change → Task 1; every "Files touched"
  entry from the spec is covered, plus `app/style.css`, which the spec's
  list omitted but which the dialog and swap-button styling need.
- **Testing section of the spec:** semicolon delimiter and `previewRows` are
  unit-tested test-first (Task 1); `swapSides` is unit-tested test-first,
  including the one-direction-studied and no-progress-at-all cases the spec
  calls out explicitly (Task 2); the dialog, menu items, per-card swap
  button, and PDF page are all verified manually in-browser (Tasks 4-7),
  matching the project's "screens are verified by using them" convention.
- **`sw.js`:** every new module (`sides.js`, `importdialog.js`) is added to
  `SHELL` with `CACHE` bumped in the same task that creates it, so
  `test/sw.test.js`'s "lists every module in app/" check stays green
  throughout rather than needing a separate catch-all task at the end.
