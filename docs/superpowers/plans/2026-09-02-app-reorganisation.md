# App Reorganisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise MyQuizzlet around folders, named columns and per-list
statistics, and split studying into three activities — browsing, training and
testing.

**Architecture:** Three new pure modules (`langs.js`, `stats.js`, `train.js`)
hold everything subtle and are written test-first. `main.js` shrinks to a router
plus a header; every screen moves to its own module under `app/screens/`, all of
them sharing singletons through `app/app.js` so nothing imports `main.js` back.
Data gains three optional fields (`folder`, `frontLabel`/`backLabel` on lists,
`level` on progress items) — no migration, no rewriting of existing files.

**Tech Stack:** Hand-written ES modules loaded directly by the browser. Vitest
for the pure modules. No build step, no framework, no runtime dependency.

**Spec:** `docs/superpowers/specs/2026-09-02-app-reorganisation-design.md`

## Global Constraints

- **No build step.** ES modules loaded by the browser. Never add a bundler, a
  framework, or a CDN `<script>`. npm exists only to run `vitest`.
- **No new runtime dependency.** The deployed app has zero.
- **Colours are custom properties only.** `test/style.test.js` fails the build
  if any rule outside `:root` contains a literal `#hex`, `rgb()` or `hsl()`.
  Use the existing tokens: `--ground --surface --ink --rule --field --muted
  --accent --ok --bad --warn`.
- **Card ids are permanent.** No task may regenerate, renumber or reuse one.
- **Progress keys stay `<cardId>:f2b` / `<cardId>:b2f`.** Column labels are
  display names; they never re-key data.
- **All new list and progress fields are optional.** Every file already on the
  `data` branch must stay valid and must not be rewritten on upgrade.
- **Never write a token into a file in this repo.**
- **Run `npm test` before every commit.** It must pass.
- **Every commit message ends with these two lines:**

  ```
  Cyril Pitrou
  Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
  ```

  Written with a heredoc, e.g.

  ```bash
  git commit -q -F - <<'MSG'
  feat: whatever the change is

  Cyril Pitrou
  Claude-Session: https://claude.ai/code/session_01UhNumQqhxC1uPdJLtRkgWM
  MSG
  ```

  Every later task shows only the subject line; append the trailer every time.

## File Structure

**New, pure, tested:**

| File | Responsibility |
|---|---|
| `app/langs.js` | `langOf(label)` — a column label to a BCP-47 code |
| `app/stats.js` | `listStats({list, progress, today})` — learned %, right %, due |
| `app/train.js` | `pickBatch`, `choices`, `startBatch`, `currentKey`, `currentLevel`, `advance` |

**New, DOM, verified by use:**

| File | Responsibility |
|---|---|
| `app/app.js` | shared singletons: `store`, `settings`, `saveSettings`, `go`, `screen`, `ctx` |
| `app/status.js` | sync status: `status`, `setStatus`, `statusLine` |
| `app/listform.js` | the create/edit list form, shared by two screens |
| `app/screens/lists.js` | `#/` — recent five with statistics, then all lists |
| `app/screens/folders.js` | `#/folders` and `#/folder/<name>` |
| `app/screens/list.js` | `#/list/<id>` — statistics, three buttons, `⋮` menu |
| `app/screens/cards.js` | `#/list/<id>/cards` — the editable table and import/export |
| `app/screens/editlist.js` | `#/new` and `#/list/<id>/edit` |
| `app/screens/view.js` | `#/view/<id>` — the card browser |
| `app/screens/train.js` | `#/train/<id>` and `#/train/<id>/go` |
| `app/screens/test.js` | `#/test/<id>` and `#/test/<id>/go` |
| `app/screens/settings.js` | `#/settings` |
| `app/screens/adopt.js` | `#/adopt` |

**Modified:** `app/main.js` (router and header only), `app/srs.js` (`level`,
exported `shuffle`), `app/store.js` (`updateMeta`, `folders`, richer
`createList`), `app/ui.js` (`menu`, `swipeable`), `app/style.css`,
`index.html`, `sw.js`.

**Order:** pure modules first (Tasks 1–6), then the store (7), then the
router/screen split with no behaviour change (8), then one screen per task
(9–15), then QR onboarding (16).

---

### Task 1: `langs.js` — column label to language code

**Files:**
- Create: `app/langs.js`
- Test: `test/langs.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `langOf(label) -> string | null`, a lowercase BCP-47 code.

- [ ] **Step 1: Write the failing test**

Create `test/langs.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { langOf } from '../app/langs.js';

describe('langOf', () => {
  it('recognises an English language name', () => {
    expect(langOf('French')).toBe('fr');
    expect(langOf('Spanish')).toBe('es');
  });

  it('recognises the language’s own name, accents and all', () => {
    expect(langOf('Français')).toBe('fr');
    expect(langOf('francais')).toBe('fr');
    expect(langOf('Español')).toBe('es');
  });

  it('accepts a bare code', () => {
    expect(langOf('fr')).toBe('fr');
    expect(langOf('EN')).toBe('en');
  });

  it('ignores case and surrounding space', () => {
    expect(langOf('  GERMAN  ')).toBe('de');
  });

  it('returns null for a label that is not a language', () => {
    expect(langOf('Date')).toBeNull();
    expect(langOf('Event')).toBeNull();
    expect(langOf('')).toBeNull();
    expect(langOf(null)).toBeNull();
    expect(langOf(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/langs.test.js`
Expected: FAIL — cannot find module `../app/langs.js`.

- [ ] **Step 3: Write the implementation**

Create `app/langs.js`:

```js
// A column label like "French" or "Français" is also a language declaration.
// Anything unrecognised ("Date", "Event") is simply a label, and grading falls
// back to its language-neutral behaviour.
const NAMES = {
  en: ['english', 'anglais'],
  fr: ['french', 'français', 'francais'],
  es: ['spanish', 'español', 'espanol', 'espagnol'],
  de: ['german', 'deutsch', 'allemand'],
  it: ['italian', 'italiano', 'italien'],
  pt: ['portuguese', 'português', 'portugues', 'portugais'],
  nl: ['dutch', 'nederlands', 'néerlandais', 'neerlandais'],
  ru: ['russian', 'русский', 'russe'],
  pl: ['polish', 'polski', 'polonais'],
  el: ['greek', 'ελληνικά', 'grec'],
  la: ['latin'],
  he: ['hebrew', 'hébreu', 'hebreu'],
  ar: ['arabic', 'arabe'],
  ja: ['japanese', '日本語', 'japonais'],
  zh: ['chinese', '中文', 'chinois'],
  ko: ['korean', 'coréen', 'coreen'],
  tr: ['turkish', 'türkçe', 'turkce'],
  sv: ['swedish', 'svenska'],
  no: ['norwegian', 'norsk'],
  da: ['danish', 'dansk'],
  fi: ['finnish', 'suomi'],
  cs: ['czech', 'čeština', 'cestina'],
  hu: ['hungarian', 'magyar'],
  ro: ['romanian', 'română', 'romana'],
  ca: ['catalan', 'català'],
};

const fold = (text) => String(text).trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

const CODES = new Map();
for (const [code, names] of Object.entries(NAMES)) {
  CODES.set(code, code);
  for (const name of names) CODES.set(fold(name), code);
}

export function langOf(label) {
  if (!label) return null;
  return CODES.get(fold(label)) ?? null;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/langs.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the whole suite, then commit**

```bash
npm test
git add app/langs.js test/langs.test.js
git commit -q -F -   # subject: feat: map a column label to a language code
```

---

### Task 2: `stats.js` — the three numbers shown per list

**Files:**
- Create: `app/stats.js`
- Test: `test/stats.test.js`

**Interfaces:**
- Consumes: `parseKey` from `app/srs.js`.
- Produces: `listStats({ list, progress, today }) -> { cards, learnedPct, rightPct, due }`
  where `cards` is a count, `learnedPct` and `due` are numbers, and `rightPct`
  is a number or `null` when nothing has been seen.

**Definitions, from the spec:** learned = items in box 4 or 5, over
`cards.length × 2` (every *possible* item, so a barely-started list reads low);
right = `(Σseen − Σlapses) / Σseen`; due = cards with at least one item due
today, counting never-seen items as due, which is what `buildQueue` already
does and what `dueCount()` in `main.js` reports today.

- [ ] **Step 1: Write the failing test**

Create `test/stats.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { listStats } from '../app/stats.js';

const TODAY = '2026-09-02';

const list = {
  id: 'es-food',
  cards: [{ id: 'a', front: 'el pan', back: 'le pain' },
          { id: 'b', front: 'la mesa', back: 'la table' }],
};

const item = (fields) => ({ box: 1, due: TODAY, seen: 0, lapses: 0,
                            lastSeen: null, level: 0, ...fields });

describe('listStats', () => {
  it('reports an untouched list as nothing learned, nothing known, all due', () => {
    const stats = listStats({ list, progress: { items: {} }, today: TODAY });
    expect(stats).toEqual({ cards: 2, learnedPct: 0, rightPct: null, due: 2 });
  });

  it('counts learned over every possible item, not just the started ones', () => {
    // one item of four is in box 5; the other three do not exist yet
    const progress = { items: { 'a:f2b': item({ box: 5, due: '2026-10-06', seen: 6 }) } };
    expect(listStats({ list, progress, today: TODAY }).learnedPct).toBe(25);
  });

  it('treats box 4 and 5 as learned and boxes 1 to 3 as not', () => {
    const progress = { items: {
      'a:f2b': item({ box: 4, due: '2026-10-06' }), 'a:b2f': item({ box: 3, due: '2026-10-06' }),
      'b:f2b': item({ box: 5, due: '2026-10-06' }), 'b:b2f': item({ box: 1, due: '2026-10-06' }),
    } };
    expect(listStats({ list, progress, today: TODAY }).learnedPct).toBe(50);
  });

  it('derives the success rate from seen and lapses', () => {
    const progress = { items: {
      'a:f2b': item({ seen: 8, lapses: 1, due: '2026-10-06' }),
      'b:f2b': item({ seen: 2, lapses: 1, due: '2026-10-06' }),
    } };
    // 10 answers, 2 of them wrong
    expect(listStats({ list, progress, today: TODAY }).rightPct).toBe(80);
  });

  it('counts a card once however many of its items are due', () => {
    const progress = { items: {
      'a:f2b': item({ due: TODAY }), 'a:b2f': item({ due: TODAY }),
      'b:f2b': item({ due: '2026-10-06' }), 'b:b2f': item({ due: '2026-10-06' }),
    } };
    expect(listStats({ list, progress, today: TODAY }).due).toBe(1);
  });

  it('counts a never-seen item as due', () => {
    const progress = { items: { 'a:f2b': item({ due: '2026-10-06' }),
                                'a:b2f': item({ due: '2026-10-06' }) } };
    expect(listStats({ list, progress, today: TODAY }).due).toBe(1);   // card b
  });

  it('ignores orphaned items left by a deleted card', () => {
    const progress = { items: { 'gone:f2b': item({ box: 5, due: '2026-10-06', seen: 9 }) } };
    expect(listStats({ list, progress, today: TODAY }).learnedPct).toBe(0);
    expect(listStats({ list, progress, today: TODAY }).rightPct).toBeNull();
  });

  it('survives an empty list', () => {
    const stats = listStats({ list: { id: 'x', cards: [] }, progress: { items: {} }, today: TODAY });
    expect(stats).toEqual({ cards: 0, learnedPct: 0, rightPct: null, due: 0 });
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/stats.test.js`
Expected: FAIL — cannot find module `../app/stats.js`.

- [ ] **Step 3: Write the implementation**

Create `app/stats.js`:

```js
import { parseKey } from './srs.js';

const DIRECTIONS = ['f2b', 'b2f'];

// Learned and right describe the past; due describes today. All three are
// needed: a list of solid box-5 words reads the same the day before and the
// day after forty of them fall due.
export function listStats({ list, progress, today }) {
  const cards = (list && list.cards) || [];
  const items = (progress && progress.items) || {};
  const live = new Set(cards.map((card) => card.id));
  const dueCards = new Set();
  let learned = 0;
  let seen = 0;
  let lapses = 0;

  for (const [key, item] of Object.entries(items)) {
    const { cardId } = parseKey(key);
    if (!live.has(cardId)) continue;          // orphan of a deleted card
    if (item.box >= 4) learned += 1;
    seen += item.seen || 0;
    lapses += item.lapses || 0;
    if (item.due <= today) dueCards.add(cardId);
  }

  for (const card of cards) {
    for (const direction of DIRECTIONS) {
      if (!items[`${card.id}:${direction}`]) dueCards.add(card.id);   // never seen
    }
  }

  const possible = cards.length * DIRECTIONS.length;
  return {
    cards: cards.length,
    learnedPct: possible ? Math.round((learned / possible) * 100) : 0,
    rightPct: seen ? Math.round(((seen - lapses) / seen) * 100) : null,
    due: dueCards.size,
  };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/stats.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the whole suite, then commit**

```bash
npm test
git add app/stats.js test/stats.test.js
git commit -q -F -   # subject: feat: per-list statistics
```

---

### Task 3: `srs.js` — the `level` field and a shared shuffle

**Files:**
- Modify: `app/srs.js` (`newItem`, `nextItem`, export the shuffle)
- Modify: `test/srs.test.js:16-20` (the `newItem` shape assertion)

**Interfaces:**
- Produces: `newItem(today)` now includes `level: 0`; `nextItem(item, correct,
  today, nowIso)` carries `level` through on a correct answer and resets it to
  `0` on a wrong one; `shuffle(xs) -> xs'` is exported for `train.js`.

**Why:** `level` says which rung of the training ladder an item is on. Resetting
it on any wrong answer — in training *or* in testing — is what makes a word you
have just forgotten come back through multiple choice instead of being thrown
straight at you.

- [ ] **Step 1: Write the failing tests**

In `test/srs.test.js`, replace the existing `newItem` assertion (currently
`expect(newItem(TODAY)).toEqual({ box: 1, due: TODAY, seen: 0, lapses: 0, lastSeen: null })`)
with:

```js
describe('newItem', () => {
  it('starts in box 1, due today, never seen, on the first training rung', () => {
    expect(newItem(TODAY)).toEqual({ box: 1, due: TODAY, seen: 0, lapses: 0,
                                     lastSeen: null, level: 0 });
  });
});
```

and append to the file:

```js
describe('the training level', () => {
  it('is carried through a correct answer', () => {
    const item = { ...newItem(TODAY), level: 1 };
    expect(nextItem(item, true, TODAY, NOW).level).toBe(1);
  });

  it('is reset by a wrong answer, wherever the answer came from', () => {
    const item = { ...newItem(TODAY), level: 1 };
    expect(nextItem(item, false, TODAY, NOW).level).toBe(0);
  });

  it('treats an item written before levels existed as rung 0', () => {
    const legacy = { box: 2, due: TODAY, seen: 3, lapses: 0, lastSeen: NOW };
    expect(nextItem(legacy, true, TODAY, NOW).level).toBe(0);
  });
});

describe('shuffle', () => {
  it('returns a new array holding the same members', () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input);
    expect(output).not.toBe(input);
    expect(output.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);   // the input is not disturbed
  });
});
```

Add `shuffle` to the import at the top of `test/srs.test.js`.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run test/srs.test.js`
Expected: FAIL — `shuffle` is not exported, `level` is missing from `newItem`.

- [ ] **Step 3: Write the implementation**

In `app/srs.js`, change `newItem` and `nextItem`, and rename the private
`defaultShuffle` to an exported `shuffle`:

```js
export function newItem(today) {
  return { box: 1, due: today, seen: 0, lapses: 0, lastSeen: null, level: 0 };
}

export function nextItem(item, correct, today, nowIso) {
  const box = correct ? Math.min(item.box + 1, INTERVALS.length) : 1;
  return {
    box,
    due: addDays(today, INTERVALS[box - 1]),
    seen: item.seen + 1,
    lapses: item.lapses + (correct ? 0 : 1),
    lastSeen: nowIso,
    // A word you have just got wrong is re-introduced with multiple choice,
    // whether the wrong answer came from training or from a test.
    level: correct ? (item.level || 0) : 0,
  };
}

export const shuffle = (xs) => {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
```

Then in `buildQueue`, change the parameter default from `shuffle = defaultShuffle`
to `shuffle: shuffleFn = shuffle` and use `shuffleFn` inside it, so the
parameter no longer shadows the export.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run test/srs.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite, then commit**

```bash
npm test
git add app/srs.js test/srs.test.js
git commit -q -F -   # subject: feat: a training level on every progress item
```

---

### Task 4: `train.js` — choosing the batch

**Files:**
- Create: `app/train.js`
- Test: `test/train.test.js`

**Interfaces:**
- Consumes: `itemKey` and `shuffle` from `app/srs.js` (Task 3).
- Produces: `pickBatch({ list, progress, directions = ['f2b','b2f'], size = 8,
  exclude = [], shuffle }) -> string[]` — item keys, never-seen first, then
  ascending `box`, then descending `lapses`.

`exclude` carries the keys already graduated in this session, so a refill never
serves the same word twice.

- [ ] **Step 1: Write the failing test**

Create `test/train.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { pickBatch } from '../app/train.js';

const identity = (xs) => xs.slice();

const list = {
  id: 'es-food',
  cards: [{ id: 'a', front: 'el pan', back: 'le pain' },
          { id: 'b', front: 'la mesa', back: 'la table' },
          { id: 'c', front: 'el vino', back: 'le vin' }],
};

const item = (box, lapses) => ({ box, due: '2026-09-02', seen: box + lapses,
                                 lapses, lastSeen: '2026-09-01T10:00:00Z', level: 0 });

describe('pickBatch', () => {
  it('takes never-seen items before anything else', () => {
    const progress = { items: { 'a:f2b': item(1, 0), 'a:b2f': item(1, 0) } };
    const batch = pickBatch({ list, progress, directions: ['f2b'], size: 2, shuffle: identity });
    expect(batch).toEqual(['b:f2b', 'c:f2b']);
  });

  it('falls back to the lowest box once nothing is new', () => {
    const progress = { items: { 'a:f2b': item(4, 0), 'b:f2b': item(1, 0), 'c:f2b': item(3, 0) } };
    const batch = pickBatch({ list, progress, directions: ['f2b'], size: 3, shuffle: identity });
    expect(batch).toEqual(['b:f2b', 'c:f2b', 'a:f2b']);
  });

  it('breaks a tie on box by the most lapses', () => {
    const progress = { items: { 'a:f2b': item(2, 0), 'b:f2b': item(2, 5), 'c:f2b': item(2, 2) } };
    const batch = pickBatch({ list, progress, directions: ['f2b'], size: 3, shuffle: identity });
    expect(batch).toEqual(['b:f2b', 'c:f2b', 'a:f2b']);
  });

  it('produces one item per direction per card', () => {
    const batch = pickBatch({ list, progress: { items: {} }, size: 6, shuffle: identity });
    expect(batch).toEqual(['a:f2b', 'a:b2f', 'b:f2b', 'b:b2f', 'c:f2b', 'c:b2f']);
  });

  it('honours the size', () => {
    const batch = pickBatch({ list, progress: { items: {} }, size: 3, shuffle: identity });
    expect(batch).toHaveLength(3);
  });

  it('skips excluded keys, so a refill never repeats a graduated word', () => {
    const batch = pickBatch({ list, progress: { items: {} }, directions: ['f2b'],
                              size: 3, exclude: ['a:f2b'], shuffle: identity });
    expect(batch).toEqual(['b:f2b', 'c:f2b']);
  });

  it('returns an empty batch when the list is exhausted', () => {
    const batch = pickBatch({ list, progress: { items: {} }, directions: ['f2b'], size: 8,
                              exclude: ['a:f2b', 'b:f2b', 'c:f2b'], shuffle: identity });
    expect(batch).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/train.test.js`
Expected: FAIL — cannot find module `../app/train.js`.

- [ ] **Step 3: Write the implementation**

Create `app/train.js`:

```js
import { itemKey, parseKey, shuffle as defaultShuffle } from './srs.js';

const DIRECTIONS = ['f2b', 'b2f'];

// Training introduces new words and rescues shaky ones: never-seen first, then
// the lowest box, then the most lapsed.
export function pickBatch({ list, progress, directions = DIRECTIONS, size = 8,
                            exclude = [], shuffle = defaultShuffle }) {
  const items = (progress && progress.items) || {};
  const skip = new Set(exclude);
  const fresh = [];
  const known = [];
  for (const card of list.cards) {
    for (const direction of directions) {
      const key = itemKey(card.id, direction);
      if (skip.has(key)) continue;
      const item = items[key];
      if (!item) fresh.push(key);
      else known.push([key, item]);
    }
  }
  known.sort((a, b) => (a[1].box - b[1].box) || ((b[1].lapses || 0) - (a[1].lapses || 0)));
  return shuffle(fresh).concat(known.map(([key]) => key)).slice(0, size);
}
```

Note the deliberate ordering: fresh items are shuffled, the rest are not — their
order *is* the priority, and shuffling it would throw the ranking away.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/train.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the whole suite, then commit**

```bash
npm test
git add app/train.js test/train.test.js
git commit -q -F -   # subject: feat: choose a training batch
```

---

### Task 5: `train.js` — the four choices

**Files:**
- Modify: `app/train.js`
- Test: `test/train.test.js`

**Interfaces:**
- Consumes: `parseKey` from `app/srs.js`, already imported in Task 4.
- Produces: `choices({ list, key, count = 4, shuffle }) -> string[] | null` —
  the answer plus up to `count - 1` distractors, shuffled together. `null` when
  the list cannot supply at least two distractors, which means "ask this one by
  typing instead".

Distractors come from the same side of the same list, are deduplicated by text,
and are drawn from the entries closest in length to the answer, so the right
answer is never the obvious odd one out.

- [ ] **Step 1: Write the failing test**

Append to `test/train.test.js`:

```js
import { choices } from '../app/train.js';   // add to the existing import line

const longer = {
  id: 'es-food',
  cards: [
    { id: 'a', front: 'el pan', back: 'le pain' },
    { id: 'b', front: 'la mesa', back: 'la table' },
    { id: 'c', front: 'el vino', back: 'le vin' },
    { id: 'd', front: 'la manzana', back: 'la pomme' },
    { id: 'e', front: 'el queso', back: 'le fromage' },
    { id: 'f', front: 'la mantequilla', back: 'le beurre extraordinaire' },
  ],
};

describe('choices', () => {
  it('offers the answer and three distractors from the same side', () => {
    const options = choices({ list: longer, key: 'a:f2b', shuffle: identity });
    expect(options).toHaveLength(4);
    expect(options).toContain('le pain');
    for (const option of options) {
      expect(longer.cards.map((c) => c.back)).toContain(option);
    }
  });

  it('asks the other side when the direction reverses', () => {
    const options = choices({ list: longer, key: 'a:b2f', shuffle: identity });
    expect(options).toContain('el pan');
    for (const option of options) {
      expect(longer.cards.map((c) => c.front)).toContain(option);
    }
  });

  it('prefers distractors of a similar length', () => {
    const options = choices({ list: longer, key: 'a:f2b', shuffle: identity });
    expect(options).not.toContain('le beurre extraordinaire');
  });

  it('never repeats a text, so a duplicated answer cannot appear twice', () => {
    const duplicated = { id: 'x', cards: [
      { id: 'a', front: 'el pan', back: 'le pain' },
      { id: 'b', front: 'la barra', back: 'le pain' },
      { id: 'c', front: 'la mesa', back: 'la table' },
      { id: 'd', front: 'el vino', back: 'le vin' },
    ] };
    const options = choices({ list: duplicated, key: 'a:f2b', shuffle: identity });
    expect(new Set(options).size).toBe(options.length);
  });

  it('returns null when the list is too short to build a question', () => {
    const tiny = { id: 'x', cards: [{ id: 'a', front: 'el pan', back: 'le pain' },
                                    { id: 'b', front: 'la mesa', back: 'la table' }] };
    expect(choices({ list: tiny, key: 'a:f2b', shuffle: identity })).toBeNull();
  });

  it('returns null for a key whose card has gone', () => {
    expect(choices({ list: longer, key: 'zz:f2b', shuffle: identity })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/train.test.js`
Expected: FAIL — `choices` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `app/train.js`:

```js
// Distractors are drawn from the entries closest in length to the answer: a
// four-word option among three two-word ones answers itself.
export function choices({ list, key, count = 4, shuffle = defaultShuffle }) {
  const { cardId, direction } = parseKey(key);
  const side = direction === 'f2b' ? 'back' : 'front';
  const card = list.cards.find((c) => c.id === cardId);
  if (!card) return null;
  const answer = card[side];

  const pool = [];
  const seenText = new Set([answer]);
  for (const other of list.cards) {
    if (other.id === cardId) continue;
    const text = other[side];
    if (seenText.has(text)) continue;
    seenText.add(text);
    pool.push(text);
  }
  if (pool.length < 2) return null;

  pool.sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length));
  const shortlist = pool.slice(0, (count - 1) * 2);
  const distractors = shuffle(shortlist).slice(0, count - 1);
  return shuffle([answer, ...distractors]);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/train.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 5: Run the whole suite, then commit**

```bash
npm test
git add app/train.js test/train.test.js
git commit -q -F -   # subject: feat: build a four-choice question
```

---

### Task 6: `train.js` — the batch ladder

**Files:**
- Modify: `app/train.js`
- Test: `test/train.test.js`

**Interfaces:**
- Produces:
  - `startBatch(keys, progress) -> state`, where `state` is
    `{ queue: string[], levels: Record<string, 0|1>, graduated: string[] }`.
    An item stored at `level: 1` resumes on rung 1.
  - `currentKey(state) -> string | null`
  - `currentLevel(state) -> 0 | 1 | null`
  - `advance(state, correct) -> state` — a new state, never a mutated one.

**The rules, from the spec:** rung 0 is pick-from-four, rung 1 is typing.
Correct at rung 0 promotes and requeues at the back. Correct at rung 1
graduates. Wrong at either rung drops to rung 0 and requeues at the back.
Requeueing at the back is also what stops the same word being asked twice in a
row while another is available.

- [ ] **Step 1: Write the failing test**

Append to `test/train.test.js`:

```js
import { startBatch, currentKey, currentLevel, advance } from '../app/train.js';  // add to the import

describe('the batch ladder', () => {
  const keys = ['a:f2b', 'b:f2b', 'c:f2b'];

  it('starts every unseen item on rung 0', () => {
    const state = startBatch(keys, { items: {} });
    expect(state.queue).toEqual(keys);
    expect(currentKey(state)).toBe('a:f2b');
    expect(currentLevel(state)).toBe(0);
    expect(state.graduated).toEqual([]);
  });

  it('resumes an item stored on rung 1, so an abandoned batch picks up where it was', () => {
    const progress = { items: { 'b:f2b': { box: 1, due: '2026-09-02', seen: 1,
                                           lapses: 0, lastSeen: null, level: 1 } } };
    const state = startBatch(keys, progress);
    expect(state.levels['b:f2b']).toBe(1);
    expect(state.levels['a:f2b']).toBe(0);
  });

  it('promotes to typing on a correct multiple choice and sends it to the back', () => {
    const state = advance(startBatch(keys, { items: {} }), true);
    expect(state.queue).toEqual(['b:f2b', 'c:f2b', 'a:f2b']);
    expect(state.levels['a:f2b']).toBe(1);
    expect(state.graduated).toEqual([]);
  });

  it('graduates on a correct typed answer', () => {
    let state = startBatch(keys, { items: {} });
    state = advance(state, true);            // a:f2b to rung 1, to the back
    state = advance(state, true);            // b:f2b to rung 1, to the back
    state = advance(state, true);            // c:f2b to rung 1, to the back
    expect(currentKey(state)).toBe('a:f2b');
    expect(currentLevel(state)).toBe(1);
    state = advance(state, true);            // a:f2b typed correctly
    expect(state.graduated).toEqual(['a:f2b']);
    expect(state.queue).toEqual(['b:f2b', 'c:f2b']);
  });

  it('drops a wrong answer back to multiple choice', () => {
    let state = startBatch(keys, { items: {} });
    state = advance(state, true);            // a:f2b now on rung 1
    state = advance(state, true);
    state = advance(state, true);
    state = advance(state, false);           // a:f2b typed wrongly
    expect(state.levels['a:f2b']).toBe(0);
    expect(state.queue).toEqual(['b:f2b', 'c:f2b', 'a:f2b']);
    expect(state.graduated).toEqual([]);
  });

  it('never asks the same item twice running while another is waiting', () => {
    let state = startBatch(keys, { items: {} });
    const asked = [];
    for (let i = 0; i < 8; i++) {
      asked.push(currentKey(state));
      state = advance(state, false);
    }
    for (let i = 1; i < asked.length; i++) expect(asked[i]).not.toBe(asked[i - 1]);
  });

  it('empties when every item has graduated', () => {
    let state = startBatch(['a:f2b'], { items: {} });
    state = advance(state, true);            // to rung 1
    state = advance(state, true);            // graduated
    expect(currentKey(state)).toBeNull();
    expect(currentLevel(state)).toBeNull();
    expect(state.graduated).toEqual(['a:f2b']);
  });

  it('does not mutate the state it is given', () => {
    const before = startBatch(keys, { items: {} });
    const snapshot = JSON.parse(JSON.stringify(before));
    advance(before, true);
    expect(before).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run test/train.test.js`
Expected: FAIL — `startBatch` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `app/train.js`:

```js
// Rung 0 is pick-from-four, rung 1 is typing. Right moves an item up; wrong
// sends it to the bottom rung and to the back of the queue, which is also what
// keeps the same word from being asked twice in a row.
export function startBatch(keys, progress) {
  const items = (progress && progress.items) || {};
  const levels = {};
  for (const key of keys) levels[key] = items[key] && items[key].level === 1 ? 1 : 0;
  return { queue: keys.slice(), levels, graduated: [] };
}

export const currentKey = (state) => (state.queue.length ? state.queue[0] : null);

export const currentLevel = (state) =>
  (state.queue.length ? state.levels[state.queue[0]] : null);

export function advance(state, correct) {
  const [key, ...rest] = state.queue;
  if (key === undefined) return state;
  if (correct && state.levels[key] === 1) {
    return { queue: rest, levels: { ...state.levels },
             graduated: state.graduated.concat(key) };
  }
  return {
    queue: rest.concat(key),
    levels: { ...state.levels, [key]: correct ? 1 : 0 },
    graduated: state.graduated.slice(),
  };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run test/train.test.js`
Expected: PASS, 21 tests.

- [ ] **Step 5: Run the whole suite, then commit**

```bash
npm test
git add app/train.js test/train.test.js
git commit -q -F -   # subject: feat: the two-rung training ladder
```

---

### Task 7: `store.js` — folders and column labels

**Files:**
- Modify: `app/store.js`
- Test: `test/store.test.js`

**Interfaces:**
- Produces:
  - `createList({ name, folder = null, frontLabel = null, backLabel = null,
    frontLang = null, backLang = null })` — unchanged for existing callers.
  - `updateMeta(id, fields)` — sets any of `name`, `folder`, `frontLabel`,
    `backLabel`, `frontLang`, `backLang`; ignores anything else, and never
    touches `cards`.
  - `folders() -> string[]` — the folder names in use, sorted, without
    duplicates and without `null`.
  - `renameList(id, name)` stays, now a thin call to `updateMeta`.

- [ ] **Step 1: Write the failing tests**

Append to `test/store.test.js` (follow the file's existing pattern for building
a store over a fake storage):

```js
describe('list metadata', () => {
  it('creates a list with a folder and column labels', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Spanish – Food', folder: 'Spanish',
                                    frontLabel: 'Spanish', backLabel: 'French',
                                    frontLang: 'es', backLang: 'fr' });
    expect(list.folder).toBe('Spanish');
    expect(list.frontLabel).toBe('Spanish');
    expect(list.backLabel).toBe('French');
    expect(store.getList(list.id).folder).toBe('Spanish');
  });

  it('defaults the new fields to null, so an old list stays valid', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Scratch' });
    expect(list.folder).toBeNull();
    expect(list.frontLabel).toBeNull();
    expect(list.backLabel).toBeNull();
  });

  it('updates metadata without disturbing the cards', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Scratch' });
    store.addCards(list.id, [{ front: 'el pan', back: 'le pain' }]);
    const cardId = store.getList(list.id).cards[0].id;
    store.updateMeta(list.id, { folder: 'Spanish', backLabel: 'French' });
    const after = store.getList(list.id);
    expect(after.folder).toBe('Spanish');
    expect(after.backLabel).toBe('French');
    expect(after.cards).toHaveLength(1);
    expect(after.cards[0].id).toBe(cardId);        // card ids are permanent
  });

  it('ignores fields that are not metadata', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Scratch' });
    store.addCards(list.id, [{ front: 'el pan', back: 'le pain' }]);
    store.updateMeta(list.id, { cards: [], id: 'hijacked' });
    expect(store.getList(list.id).cards).toHaveLength(1);
    expect(store.getList('hijacked')).toBeNull();
  });

  it('lists the folders in use, sorted and deduplicated', () => {
    const store = createStore(fakeStorage());
    store.createList({ name: 'Food', folder: 'Spanish' });
    store.createList({ name: 'Verbs', folder: 'Spanish' });
    store.createList({ name: 'Kanji', folder: 'Japanese' });
    store.createList({ name: 'Scratch' });
    expect(store.folders()).toEqual(['Japanese', 'Spanish']);
  });

  it('renames through the same path', () => {
    const store = createStore(fakeStorage());
    const list = store.createList({ name: 'Old' });
    store.renameList(list.id, 'New');
    expect(store.getList(list.id).name).toBe('New');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run test/store.test.js`
Expected: FAIL — `store.updateMeta is not a function`.

- [ ] **Step 3: Write the implementation**

In `app/store.js`, replace `createList` and `renameList` and add the two new
members:

```js
const META = ['name', 'folder', 'frontLabel', 'backLabel', 'frontLang', 'backLang'];

function createList({ name, folder = null, frontLabel = null, backLabel = null,
                      frontLang = null, backLang = null }) {
  const base = slugify(name);
  let id = base;
  for (let n = 2; index().includes(id); n++) id = `${base}-${n}`;
  return saveList({ id, name, folder, frontLabel, backLabel,
                    frontLang, backLang, cards: [] });
}
```

and, in the returned object:

```js
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
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run test/store.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite, then commit**

```bash
npm test
git add app/store.js test/store.test.js
git commit -q -F -   # subject: feat: folders and column labels on a list
```

---

### Task 8: Split `main.js` into a router and screen modules

**Files:**
- Create: `app/app.js`, `app/status.js`, `app/screens/lists.js`,
  `app/screens/list.js`, `app/screens/test.js`, `app/screens/settings.js`
- Modify: `app/main.js` (becomes router only), `sw.js`

**Interfaces:**
- Produces: `app/app.js` exports `REPO`, `store`, `settings`, `saveSettings`,
  `go`, `todayStr`, `screen`, `ctx`. `app/status.js` exports `status`,
  `setStatus`, `statusLine`. Each screen module exports one `show…(…)`
  function that renders into `#screen`. `app/screens/settings.js` also exports
  `applyTheme(id)` for start-up.

**This task changes no behaviour.** The app must look and work exactly as it
does now when it is finished. Everything that follows depends on this split, so
resist improving anything while moving it.

- [ ] **Step 1: Create the shared singletons**

Create `app/app.js`:

```js
import { $, clear } from './ui.js';
import { createStore } from './store.js';

export const REPO = 'CyrilPitrou/myquizzlet';

export const store = createStore(localStorage);

export const settings = () => JSON.parse(localStorage.getItem('mq:settings') || '{}');
export const saveSettings = (next) => localStorage.setItem('mq:settings', JSON.stringify(next));

export const go = (hash) => { location.hash = hash; };
export const todayStr = () => new Date().toISOString().slice(0, 10);

export function screen() {
  const node = $('#screen');
  clear(node);
  return node;
}

// main.js fills these in at start-up. Screens reach the router and the sync
// engine through here, so no screen ever has to import main.js back.
export const ctx = { sync: null, render: () => {} };
```

Create `app/status.js`, moving `STATUS`, `status`, `setStatus` and
`statusLine` out of `main.js` unchanged:

```js
import { el, $ } from './ui.js';

const STATUS = {
  synced:  { mark: '●', word: 'Everything is on GitHub' },
  pending: { mark: '↑', word: 'Changes waiting to push' },
  offline: { mark: '○', word: 'Offline — will catch up' },
  error:   { mark: '✕', word: 'Sync failed' },
  off:     { mark: '⊘', word: 'No token — read-only' },
};

export let status = { state: 'off', detail: '' };

export function setStatus(state, detail = '') {
  status = { state, detail };
  const dot = $('#sync-dot');
  dot.textContent = STATUS[state].mark;
  dot.className = `dot ${state}`;
  dot.title = detail ? `${STATUS[state].word}: ${detail}` : STATUS[state].word;
  const line = $('#sync-line');
  if (line) line.replaceWith(statusLine());
}

export function statusLine() {
  return el('div', { class: 'statusline', id: 'sync-line' }, [
    el('span', { class: `dot ${status.state}`, text: STATUS[status.state].mark }),
    status.detail ? `${STATUS[status.state].word}: ${status.detail}` : STATUS[status.state].word,
  ]);
}
```

- [ ] **Step 2: Move the screens, verbatim**

Create these four modules by cutting the named functions out of `main.js` and
pasting them in unchanged, adding imports from `./app.js`, `../ui.js`,
`../store.js` and so on as each file needs, and exporting the entry point:

| New module | Functions moved from `main.js` | Exports |
|---|---|---|
| `app/screens/lists.js` | `showHome`, `dueCount` | `showLists` (renamed from `showHome`) |
| `app/screens/list.js` | `showList`, `editableCell`, `importExport`, `renameList`, `deleteList` | `showList` |
| `app/screens/test.js` | `setup`, `showSetup`, `session`, `startSession`, `answer`, `showSession`, `showVerdict` | `showTestSetup` (from `showSetup`), `showTestSession` (from `showSession`) |
| `app/screens/settings.js` | `THEMES`, `applyTheme`, `themePicker`, `section`, `showSettings` | `showSettings`, `applyTheme` |

Rules while moving:

- Replace every bare `render()` call with `ctx.render()`, and every `sync?.…`
  with `ctx.sync?.…`.
- `showLists` and `showList` link to `#/study/${id}`; leave those links alone —
  the router redirects them.
- **Two navigations must change**, because the router below knows only the new
  routes: `startSession` ends with `go(\`#/session/${listId}\`)` — make it
  `go(\`#/test/${listId}/go\`)`; and `showSession`'s guard is
  `return go(\`#/study/${listId}\`)` — make it `return go(\`#/test/${listId}\`)`.
- `showList`'s `prompt()`/`confirm()` calls stay as they are.
- Nothing else changes. No renaming of variables, no reformatting.

- [ ] **Step 3: Reduce `main.js` to the router**

Replace `app/main.js` in full:

```js
import { $ } from './ui.js';
import { ctx, settings, go, store, REPO } from './app.js';
import { setStatus } from './status.js';
import { createGitHub } from './github.js';
import { createSync } from './sync.js';
import { showLists } from './screens/lists.js';
import { showList } from './screens/list.js';
import { showTestSetup, showTestSession } from './screens/test.js';
import { showSettings, applyTheme } from './screens/settings.js';

function initSync() {
  ctx.sync?.stop();
  const { token } = settings();
  const github = createGitHub({ repo: REPO, branch: 'data', token });
  ctx.sync = createSync({
    store, github,
    onStatus: setStatus,
    onConflict: showConflict,
    canPush: Boolean(token),
  });
  ctx.sync.syncNow();
}

// Temporary until a real conflict screen exists.
function showConflict({ listId, resolve }) {
  console.warn(`conflict on ${listId} — keeping the local copy`);
  resolve('local');
}

function render() {
  const [path] = location.hash.split('?');
  const [, route, arg, sub] = path.split('/');
  if (route === 'list' && arg) showList(arg);
  else if (route === 'study' && arg) go(`#/test/${arg}`);
  else if (route === 'test' && arg && sub === 'go') showTestSession(arg);
  else if (route === 'test' && arg) showTestSetup(arg);
  else if (route === 'settings') showSettings();
  else showLists();
}

ctx.render = render;
ctx.initSync = initSync;

window.addEventListener('hashchange', render);
applyTheme(settings().theme);
initSync();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
```

`ctx.initSync` is there because the settings screen re-creates sync after a
token is saved.

- [ ] **Step 4: Teach the service worker about the new files**

In `sw.js`, bump the cache name to `myquizzlet-v3` and replace `SHELL` with:

```js
const SHELL = [
  './', './index.html', './manifest.webmanifest', './app/style.css',
  './app/main.js', './app/app.js', './app/status.js', './app/ui.js',
  './app/store.js', './app/github.js', './app/sync.js', './app/srs.js',
  './app/grade.js', './app/csv.js', './app/merge.js',
  './app/langs.js', './app/stats.js', './app/train.js',
  './app/screens/lists.js', './app/screens/list.js',
  './app/screens/test.js', './app/screens/settings.js',
];
```

Later tasks add each new module to this list and bump the cache again. A module
missing from `SHELL` still works online — the worker is network-first — but the
app stops being fully usable offline, which the standing constraints forbid.

- [ ] **Step 5: Verify by using it**

```bash
npm test
npm run dev
```

Open `http://localhost:8000`. Check, in order: the list of lists appears with
its due badges; a list opens, a card can be added, edited and deleted; import
and export work; Study runs both write and flashcard modes and records answers;
Settings shows the theme picker, the sync section and the token form, and
saving a token re-initialises sync. Nothing should look different from before.

- [ ] **Step 6: Commit**

```bash
git add app sw.js
git commit -q -F -   # subject: refactor: split main.js into a router and screen modules
```

---

### Task 9: The header nav and the Lists screen

**Files:**
- Modify: `index.html:20`, `app/style.css`, `app/main.js`,
  `app/screens/lists.js`, `sw.js`

**Interfaces:**
- Consumes: `listStats` from `app/stats.js` (Task 2), `recency` from
  `app/store.js`.
- Produces: `showLists()` renders the recent five with statistics, then every
  list. `#topbar` gains the class `session` on train and test session routes.

- [ ] **Step 1: Rewrite the header**

In `index.html`, replace the `<header>` element with:

```html
  <header id="topbar">
    <a href="#/new" class="nav" title="Create a list" aria-label="Create a list">＋</a>
    <a href="#/folders" class="nav" title="Folders">Folders</a>
    <a href="#/" class="nav" title="Lists">Lists</a>
    <a href="#/settings" class="nav" title="Settings" aria-label="Settings">⚙</a>
    <span id="sync-dot" title="No token — read-only">⊘</span>
  </header>
```

The wordmark goes: four controls plus the dot is a full phone width. `#/new`
and `#/folders` have no screen until Tasks 10 and 11, and until then the router
falls through to the Lists screen — that is expected between tasks.

- [ ] **Step 2: Style the header and the statistics**

In `app/style.css`, replace the `#topbar h1` rule (there is no `h1` any more)
and add:

```css
#topbar { justify-content: flex-end; }
#topbar .nav:first-child { margin-right: auto; }
#topbar.session .nav { display: none; }

.liststats { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
  color: var(--muted); font-size: .9rem; }
.bar { flex: 0 0 84px; height: 6px; border-radius: 999px; background: var(--rule); }
.bar > span { display: block; height: 100%; border-radius: 999px; background: var(--accent); }
.recent { margin-bottom: 1.5rem; }
.recent h3, .all h3 { color: var(--muted); font-size: .85rem;
  text-transform: uppercase; letter-spacing: .05em; margin: .5rem 0; }
.listrow { display: flex; flex-direction: column; gap: .25rem;
  padding: .6rem 0; border-bottom: 1px solid var(--rule); }
.listrow a { font-size: 1.05rem; text-decoration: none; color: var(--ink); }
```

No literal colours — `test/style.test.js` enforces that.

- [ ] **Step 3: Rewrite the Lists screen**

Replace `app/screens/lists.js` in full:

```js
import { el } from '../ui.js';
import { store, screen, todayStr, settings } from '../app.js';
import { recency } from '../store.js';
import { listStats } from '../stats.js';

function statsLine(stats) {
  const nodes = [
    el('span', { class: 'bar' }, [el('span', { style: `width:${stats.learnedPct}%` })]),
    el('span', { text: `${stats.learnedPct}% learned` }),
  ];
  if (stats.rightPct !== null) nodes.push(el('span', { text: `${stats.rightPct}% right` }));
  nodes.push(stats.due
    ? el('span', { class: 'badge', text: `${stats.due} due` })
    : el('span', { text: '—' }));
  return el('div', { class: 'liststats' }, nodes);
}

function listRow(id) {
  const list = store.getList(id);
  const stats = listStats({ list, progress: store.getProgress(id), today: todayStr() });
  return el('div', { class: 'listrow' }, [
    el('a', { href: `#/list/${id}`, text: list.name }),
    el('div', { class: 'liststats' }, [
      el('span', { text: list.folder || 'Unfiled' }),
      el('span', { text: `${stats.cards} cards` }),
    ]),
    statsLine(stats),
  ]);
}

function tokenWarning() {
  const { tokenExpiry } = settings();
  if (!tokenExpiry) return null;
  const days = Math.round((new Date(tokenExpiry) - new Date()) / 86400000);
  if (days > 14) return null;
  return el('p', { class: 'warn' }, [
    days < 0 ? 'Your GitHub token has expired — changes are not being saved. '
             : `Your GitHub token expires in ${days} day(s). `,
    el('a', { href: '#/settings', text: 'Renew it' }),
  ]);
}

export function showLists() {
  const view = screen();
  const warning = tokenWarning();
  if (warning) view.append(warning);

  const ids = store.listIds().slice().sort((a, b) => {
    const at = recency({ list: store.getList(a), progress: store.getProgress(a) });
    const bt = recency({ list: store.getList(b), progress: store.getProgress(b) });
    return bt.localeCompare(at);   // newest first
  });

  if (ids.length === 0) {
    view.append(el('h2', { text: 'Lists' }));
    view.append(el('p', { class: 'empty' }, [
      'No lists yet. ', el('a', { href: '#/new', text: 'Create one' }), '.',
    ]));
    return;
  }

  if (ids.length > 5) {
    view.append(el('section', { class: 'recent' }, [
      el('h3', { text: 'Recent' }),
      ...ids.slice(0, 5).map(listRow),
    ]));
  }

  view.append(el('section', { class: 'all' }, [
    el('h3', { text: ids.length > 5 ? 'All lists' : 'Lists' }),
    ...ids.map(listRow),
  ]));
}
```

The recent block is skipped when there are five lists or fewer: repeating the
whole collection twice is noise, not navigation.

- [ ] **Step 4: Add the session class to the router**

In `app/main.js`, inside `render()`, immediately after computing `path`:

```js
  $('#topbar').classList.toggle('session', /\/(train|test)\/[^/]+\/go$/.test(path));
```

- [ ] **Step 5: Verify by using it**

```bash
npm test
npm run dev
```

Check: each row shows folder, card count, a learned bar, a right percentage
once anything has been answered, and a due badge; a list with nothing studied
reads 0% learned and shows every card as due; with six or more lists a Recent
block appears above; the header's Lists and ⚙ links work and ＋ and Folders
fall through to the Lists screen for now.

- [ ] **Step 6: Commit**

```bash
git add index.html app/style.css app/main.js app/screens/lists.js
git commit -q -F -   # subject: feat: header nav and per-list statistics
```

---

### Task 10: Folders

**Files:**
- Create: `app/screens/folders.js`
- Modify: `app/main.js`, `sw.js`

**Interfaces:**
- Consumes: `store.folders()` (Task 7), `listStats` (Task 2).
- Produces: `showFolders()` for `#/folders` and `showFolder(name)` for
  `#/folder/<name>`.

Folders are derived, not stored: a folder exists exactly as long as a list is
in it. Lists with no folder appear under **Unfiled**, which always sorts last.

- [ ] **Step 1: Write the screens**

Create `app/screens/folders.js`:

```js
import { el } from '../ui.js';
import { store, screen, todayStr } from '../app.js';
import { listStats } from '../stats.js';

const UNFILED = 'Unfiled';

// Derived, never stored: the folders are whatever the lists say they are.
function grouped() {
  const groups = new Map();
  for (const id of store.listIds()) {
    const list = store.getList(id);
    if (!list) continue;
    const name = list.folder || UNFILED;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(list);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === UNFILED) return 1;          // Unfiled always last
    if (b === UNFILED) return -1;
    return a.localeCompare(b);
  });
}

export function showFolders() {
  const view = screen();
  view.append(el('h2', { text: 'Folders' }));
  const groups = grouped();
  if (groups.length === 0) {
    view.append(el('p', { class: 'empty' }, [
      'No lists yet. ', el('a', { href: '#/new', text: 'Create one' }), '.',
    ]));
    return;
  }
  for (const [name, lists] of groups) {
    const due = lists.reduce((total, list) => total + listStats({
      list, progress: store.getProgress(list.id), today: todayStr(),
    }).due, 0);
    view.append(el('div', { class: 'row' }, [
      el('a', { href: `#/folder/${encodeURIComponent(name)}`, text: name }),
      el('span', { class: 'muted', text: `${lists.length} list(s)` }),
      due ? el('span', { class: 'badge', text: `${due} due` }) : el('span', { class: 'muted', text: '—' }),
    ]));
  }
}

export function showFolder(name) {
  const view = screen();
  view.append(el('a', { href: '#/folders', class: 'back', text: '← Folders' }));
  view.append(el('h2', { text: name }));
  const lists = (grouped().find(([folder]) => folder === name) || [name, []])[1];
  if (lists.length === 0) {
    view.append(el('p', { class: 'empty', text: 'This folder is empty.' }));
    return;
  }
  for (const list of lists) {
    const stats = listStats({ list, progress: store.getProgress(list.id), today: todayStr() });
    view.append(el('div', { class: 'listrow' }, [
      el('a', { href: `#/list/${list.id}`, text: list.name }),
      el('div', { class: 'liststats' }, [
        el('span', { class: 'bar' }, [el('span', { style: `width:${stats.learnedPct}%` })]),
        el('span', { text: `${stats.learnedPct}% learned` }),
        stats.due ? el('span', { class: 'badge', text: `${stats.due} due` })
                  : el('span', { text: '—' }),
      ]),
    ]));
  }
}
```

- [ ] **Step 2: Route to them**

In `app/main.js`, import `{ showFolders, showFolder }` from
`./screens/folders.js` and add to `render()`, before the fall-through:

```js
  else if (route === 'folders') showFolders();
  else if (route === 'folder' && arg) showFolder(decodeURIComponent(arg));
```

- [ ] **Step 3: Cache the module**

In `sw.js`, add `'./app/screens/folders.js'` to `SHELL` and bump the cache name
to `myquizzlet-v4`.

- [ ] **Step 4: Verify by using it**

```bash
npm test
npm run dev
```

There is no way to set a folder until Task 11, so verify with the browser
console: `JSON.parse(localStorage['mq:list:<id>'])`, add `"folder": "Spanish"`,
write it back, reload. Check: Folders lists Spanish and Unfiled, Unfiled last;
opening a folder shows its lists; a folder name with a space or a slash
survives the round trip through the URL.

- [ ] **Step 5: Commit**

```bash
git add app/screens/folders.js app/main.js sw.js
git commit -q -F -   # subject: feat: folders
```

---

### Task 11: Creating and editing a list

**Files:**
- Create: `app/listform.js`, `app/screens/editlist.js`
- Modify: `app/main.js`, `app/style.css`, `sw.js`

**Interfaces:**
- Consumes: `langOf` (Task 1), `store.createList` and `store.updateMeta`
  (Task 7), `parseCards` from `app/csv.js`.
- Produces: `listForm({ list, onSave })` from `app/listform.js`, returning a
  `<form>` element; `showNewList()` and `showEditList(id)` from
  `app/screens/editlist.js`.

**A deviation from the spec, deliberate:** §8 suggests the detected-language
hint reads *"→ Spanish; accents ignored when grading"*. `grade.js` folds
accents for every language already, so that clause would state a difference
that does not exist. The hint reads *"→ Spanish"* alone.

- [ ] **Step 1: Write the shared form**

Create `app/listform.js`:

```js
import { el } from './ui.js';
import { store } from './app.js';
import { langOf } from './langs.js';

const DISPLAY = new Intl.DisplayNames(['en'], { type: 'language' });

function labelField(text, value, placeholder) {
  const input = el('input', { value: value || '', placeholder });
  const hint = el('span', { class: 'muted hint' });
  const update = () => {
    const code = langOf(input.value);
    hint.textContent = code ? `→ ${DISPLAY.of(code)}` : '';
  };
  input.addEventListener('input', update);
  update();
  return { field: el('label', { class: 'field' }, [text, input, hint]), input };
}

// One form for both creating and editing. It never touches cards: renaming a
// column is metadata, and every card id and progress entry must survive it.
export function listForm({ list = null, onSave }) {
  const name = el('input', { value: list ? list.name : '', placeholder: 'Spanish – Food',
                             required: 'required' });

  const folders = el('datalist', { id: 'folder-names' },
    store.folders().map((folder) => el('option', { value: folder })));
  const folder = el('input', { value: (list && list.folder) || '',
                               placeholder: 'Spanish', list: 'folder-names' });

  const front = labelField('First column', list && list.frontLabel, 'Spanish');
  const back = labelField('Second column', list && list.backLabel, 'French');

  return el('form', {
    class: 'listform',
    onsubmit: (event) => {
      event.preventDefault();
      const trimmed = name.value.trim();
      if (!trimmed) return;
      onSave({
        name: trimmed,
        folder: folder.value.trim() || null,
        frontLabel: front.input.value.trim() || null,
        backLabel: back.input.value.trim() || null,
        frontLang: langOf(front.input.value),
        backLang: langOf(back.input.value),
      });
    },
  }, [
    el('label', { class: 'field' }, ['Name', name]),
    el('label', { class: 'field' }, ['Folder', folder]),
    folders,
    front.field,
    back.field,
    el('p', { class: 'muted', text: 'The columns are what the two sides are — '
      + 'Spanish and French, or Date and Event. Leave them blank for Front and Back.' }),
    el('button', { class: 'primary', type: 'submit', text: list ? 'Save' : 'Create list' }),
  ]);
}
```

- [ ] **Step 2: Write the two screens**

Create `app/screens/editlist.js`:

```js
import { el } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { listForm } from '../listform.js';
import { parseCards } from '../csv.js';

export function showNewList() {
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'New list' }));

  const box = el('textarea', {
    placeholder: 'Optional — paste rows: el pan, le pain — one card per line. Tabs work too.',
    rows: '4',
  });
  const file = el('input', {
    type: 'file', accept: '.csv,.txt,text/csv',
    onchange: async (event) => {
      const chosen = event.target.files[0];
      if (chosen) box.value = await chosen.text();
    },
  });

  view.append(listForm({
    onSave: (fields) => {
      const list = store.createList(fields);
      const { cards } = parseCards(box.value);
      if (cards.length) store.addCards(list.id, cards);
      ctx.sync?.schedule();
      go(`#/list/${list.id}`);
    },
  }));
  view.append(el('details', { class: 'io', open: 'open' }, [
    el('summary', { text: 'Start with some cards' }), box, file,
  ]));
}

export function showEditList(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));
  view.append(el('h2', { text: 'Edit list' }));
  view.append(listForm({
    list,
    onSave: (fields) => {
      store.updateMeta(id, fields);
      ctx.sync?.schedule();
      go(`#/list/${id}`);
    },
  }));
}
```

- [ ] **Step 3: Route to them**

In `app/main.js`, import `{ showNewList, showEditList }` from
`./screens/editlist.js` and add to `render()`:

```js
  else if (route === 'new') showNewList();
  else if (route === 'list' && arg && sub === 'edit') showEditList(arg);
```

The `list`/`edit` case must come **before** the plain `list` case.

- [ ] **Step 4: Style the hint**

In `app/style.css`:

```css
.listform .field { margin-bottom: .75rem; }
.hint { font-size: .85rem; min-height: 1.2em; }
```

- [ ] **Step 5: Cache the modules**

In `sw.js`, add `'./app/listform.js'` and `'./app/screens/editlist.js'` to
`SHELL`, bump the cache to `myquizzlet-v5`.

- [ ] **Step 6: Verify by using it**

```bash
npm test
npm run dev
```

Check: ＋ opens the form; typing "French" in a column shows "→ French" and
typing "Event" shows nothing; the folder field suggests folders already in use;
creating with pasted rows lands on the new list with its cards; the CSV picker
fills the box; editing a list changes its labels and folder while the cards and
their ids stay exactly as they were (compare `localStorage['mq:list:<id>']`
before and after).

- [ ] **Step 7: Commit**

```bash
git add app/listform.js app/screens/editlist.js app/main.js app/style.css sw.js
git commit -q -F -   # subject: feat: create and edit a list, with named columns
```

---

### Task 12: The list screen and the card table

**Files:**
- Modify: `app/ui.js` (add `menu`), `app/screens/list.js` (rewritten),
  `app/style.css`, `app/main.js`, `sw.js`
- Create: `app/screens/cards.js`

**Interfaces:**
- Consumes: `listStats` (Task 2), `store.updateMeta` and `store.folders`
  (Task 7).
- Produces: `menu(items) -> HTMLElement` from `app/ui.js`, where `items` is
  `[{ label, onclick }]`; `showList(id)`; `showCards(id)`.

- [ ] **Step 1: Add the menu helper**

Append to `app/ui.js`:

```js
// A ⋮ button with a popover of actions. Closes on the next click anywhere,
// which is the whole of its dismissal logic.
export function menu(items) {
  const close = () => { pop.hidden = true; };
  const pop = el('div', { class: 'menu-pop', hidden: 'hidden' }, items.map((item) =>
    el('button', {
      class: 'menu-item', text: item.label,
      onclick: () => { close(); item.onclick(); },
    })));
  const button = el('button', {
    class: 'menu-button', text: '⋮', title: 'Actions', 'aria-label': 'Actions',
    onclick: (event) => {
      event.stopPropagation();
      if (pop.hidden) {
        pop.hidden = false;
        document.addEventListener('click', close, { once: true });
      } else close();
    },
  });
  return el('div', { class: 'menu' }, [button, pop]);
}
```

- [ ] **Step 2: Move the card table to its own screen**

Create `app/screens/cards.js` by moving `editableCell` and `importExport` out
of `app/screens/list.js` along with the add-card form and the table, and giving
the table a header row from the column labels:

```js
import { el, $ } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { parseCards, toCsv } from '../csv.js';

function editableCell(listId, card, side) {
  return el('input', {
    value: card[side],
    onchange: (event) => {
      store.updateCard(listId, card.id, { [side]: event.target.value.trim() });
      ctx.sync?.schedule();
    },
  });
}

function importExport(listId) {
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
  const file = el('input', {
    type: 'file', accept: '.csv,.txt,text/csv',
    onchange: async (event) => {
      const chosen = event.target.files[0];
      if (!chosen) return;
      box.value = await chosen.text();
      doImport();
    },
  });
  const exportButton = el('button', {
    text: 'Export CSV',
    onclick: () => {
      const list = store.getList(listId);
      const blob = new Blob([toCsv(list.cards)], { type: 'text/csv' });
      const a = el('a', { href: URL.createObjectURL(blob), download: `${listId}.csv` });
      a.click();
      URL.revokeObjectURL(a.href);
    },
  });
  return el('details', { class: 'io' }, [
    el('summary', { text: 'Import / export' }),
    box,
    el('div', { class: 'row' }, [
      el('button', { text: 'Import pasted text', onclick: doImport }), file, exportButton,
    ]),
    status,
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
      el('td', {}, [el('button', {
        class: 'link', text: '✕', title: 'delete',
        onclick: () => { store.deleteCard(id, card.id); ctx.sync?.schedule(); ctx.render(); },
      })]),
    ]));
  }
  view.append(table);
  view.append(importExport(id));
}
```

- [ ] **Step 3: Rewrite the list screen**

Replace `app/screens/list.js` in full:

```js
import { el, menu } from '../ui.js';
import { store, screen, go, todayStr, ctx } from '../app.js';
import { listStats } from '../stats.js';

function renameList(list) {
  const name = prompt('New name for this list', list.name);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed || trimmed === list.name) return;
  store.renameList(list.id, trimmed);
  ctx.sync?.schedule();
  ctx.render();
}

function moveToFolder(list) {
  const known = store.folders();
  const message = known.length
    ? `Folder for this list.\n\nIn use: ${known.join(', ')}\n\nLeave empty for Unfiled.`
    : 'Folder for this list. Leave empty for Unfiled.';
  const folder = prompt(message, list.folder || '');
  if (folder === null) return;
  store.updateMeta(list.id, { folder: folder.trim() || null });
  ctx.sync?.schedule();
  ctx.render();
}

function deleteList(list) {
  const records = Object.keys(store.getProgress(list.id).items).length;
  const ok = confirm(`Delete "${list.name}"?\n\n${list.cards.length} card(s) and `
    + `${records} progress record(s) go, here and on GitHub. This cannot be undone.`);
  if (!ok) return;
  store.deleteList(list.id);
  ctx.sync?.schedule();
  go('#/');
}

export function showList(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const stats = listStats({ list, progress: store.getProgress(id), today: todayStr() });

  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('div', { class: 'listhead' }, [
    el('h2', { text: list.name }),
    menu([
      { label: 'Rename', onclick: () => renameList(list) },
      { label: 'Move to folder', onclick: () => moveToFolder(list) },
      { label: 'Edit columns', onclick: () => go(`#/list/${id}/edit`) },
      { label: 'View all cards', onclick: () => go(`#/list/${id}/cards`) },
      { label: 'Delete list', onclick: () => deleteList(list) },
    ]),
  ]));

  view.append(el('div', { class: 'liststats' }, [
    el('span', { text: list.folder || 'Unfiled' }),
    el('span', { text: `${stats.cards} cards` }),
    el('span', { text: `${list.frontLabel || 'Front'} → ${list.backLabel || 'Back'}` }),
  ]));
  view.append(el('div', { class: 'liststats' }, [
    el('span', { class: 'bar' }, [el('span', { style: `width:${stats.learnedPct}%` })]),
    el('span', { text: `${stats.learnedPct}% learned` }),
    stats.rightPct === null ? el('span', { text: 'not studied yet' })
                            : el('span', { text: `${stats.rightPct}% right` }),
    stats.due ? el('span', { class: 'badge', text: `${stats.due} due` })
              : el('span', { text: '—' }),
  ]));

  view.append(el('div', { class: 'actions' }, [
    el('a', { class: 'btn', href: `#/view/${id}`, text: 'View cards' }),
    el('a', { class: 'btn primary', href: `#/train/${id}`, text: 'Train' }),
    el('a', { class: 'btn', href: `#/test/${id}`, text: 'Test' }),
  ]));
}
```

- [ ] **Step 4: Style the head, the menu and the buttons**

In `app/style.css`:

```css
.listhead { display: flex; align-items: center; gap: .5rem; }
.listhead h2 { margin: 0 auto 0 0; }

.menu { position: relative; }
.menu-button { font-size: 1.4rem; line-height: 1; padding: .2rem .6rem;
  background: none; border: none; color: var(--ink); }
.menu-pop { position: absolute; right: 0; top: 100%; z-index: 10; min-width: 12rem;
  background: var(--surface); border: 1px solid var(--rule); border-radius: 10px;
  overflow: hidden; }
.menu-item { display: block; width: 100%; text-align: left; padding: .7rem 1rem;
  background: none; border: none; border-bottom: 1px solid var(--rule);
  color: var(--ink); min-height: 44px; }
.menu-item:last-child { border-bottom: none; }

.actions { display: flex; gap: .5rem; margin: 1.25rem 0; }
.actions .btn { flex: 1; text-align: center; }
.btn.primary { background: var(--accent); color: var(--surface); border-color: var(--accent); }
.cards th { text-align: left; color: var(--muted); font-weight: 600; font-size: .85rem; }
```

- [ ] **Step 5: Route to the card table**

In `app/main.js`, import `{ showCards }` from `./screens/cards.js` and add,
before the plain `list` case:

```js
  else if (route === 'list' && arg && sub === 'cards') showCards(arg);
```

- [ ] **Step 6: Cache the module**

Add `'./app/screens/cards.js'` to `SHELL` in `sw.js`, bump to `myquizzlet-v6`.

- [ ] **Step 7: Verify by using it**

```bash
npm test
npm run dev
```

Check: the list screen shows the name, the `⋮`, the folder, the column pair and
the statistics, then three buttons; the menu opens, closes on the next click
anywhere, and each of its five items works; Rename and Move to folder update
the screen; Delete still asks and still names the counts; View all cards shows
the table with the column labels as headers, and add, edit, delete, import and
export all still work; View cards, Train and Test lead nowhere yet — Tasks 13
and 14 add them.

- [ ] **Step 8: Commit**

```bash
git add app/ui.js app/screens/list.js app/screens/cards.js app/style.css app/main.js sw.js
git commit -q -F -   # subject: feat: the list screen, with an actions menu
```

---

### Task 13: The card browser

**Files:**
- Create: `app/screens/view.js`
- Modify: `app/main.js`, `app/style.css`, `sw.js`

**Interfaces:**
- Consumes: `store`, `settings`, `saveSettings`, `shuffle` from `app/srs.js`.
- Produces: `showView(id)`.

Browsing is not studying: this screen must not write a single progress item.
The shuffle preference is stored in settings, because it is a preference and
not data, and therefore never syncs.

- [ ] **Step 1: Write the screen**

Create `app/screens/view.js`:

```js
import { el } from '../ui.js';
import { store, screen, go, settings, saveSettings, ctx } from '../app.js';
import { shuffle } from '../srs.js';

// Kept across renders so paging does not lose your place. Reset whenever the
// list, its length or the shuffle preference changes.
let browse = null;

function order(list) {
  const ids = list.cards.map((card) => card.id);
  return settings().browseShuffle ? shuffle(ids) : ids;
}

function ensure(list) {
  const wanted = Boolean(settings().browseShuffle);
  if (!browse || browse.listId !== list.id
      || browse.order.length !== list.cards.length || browse.shuffled !== wanted) {
    browse = { listId: list.id, order: order(list), at: 0, flipped: false, shuffled: wanted };
  }
  browse.at = Math.min(browse.at, Math.max(list.cards.length - 1, 0));
}

function step(delta, count) {
  browse.at = (browse.at + delta + count) % count;
  browse.flipped = false;
  ctx.render();
}

export function showView(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));

  if (list.cards.length === 0) {
    view.append(el('p', { class: 'empty', text: 'This list has no cards yet.' }));
    return;
  }

  ensure(list);
  const card = list.cards.find((c) => c.id === browse.order[browse.at]);
  const frontLabel = list.frontLabel || 'Front';
  const backLabel = list.backLabel || 'Back';

  view.append(el('p', { class: 'muted', text: `${browse.at + 1} / ${list.cards.length}` }));
  view.append(el('div', {
    class: `card${browse.flipped ? ' flipped' : ''}`,
    onclick: () => { browse.flipped = !browse.flipped; ctx.render(); },
  }, [
    el('p', { class: 'muted', text: browse.flipped ? backLabel : frontLabel }),
    el('p', { class: 'prompt', text: browse.flipped ? card.back : card.front }),
    el('p', { class: 'muted', text: 'tap to flip' }),
  ]));

  view.append(el('div', { class: 'actions' }, [
    el('button', { text: '‹ Prev', onclick: () => step(-1, list.cards.length) }),
    el('button', { text: 'Next ›', onclick: () => step(1, list.cards.length) }),
  ]));

  const shuffled = el('input', { type: 'checkbox',
    ...(settings().browseShuffle ? { checked: 'checked' } : {}),
    onchange: (event) => {
      saveSettings({ ...settings(), browseShuffle: event.target.checked });
      browse = null;
      ctx.render();
    } });
  view.append(el('label', { class: 'opt' }, [shuffled, 'Random order']));
}

// One listener for the life of the page; it only acts on the browser screen.
document.addEventListener('keydown', (event) => {
  if (!location.hash.startsWith('#/view/') || !browse) return;
  const list = store.getList(browse.listId);
  if (!list || list.cards.length === 0) return;
  if (event.key === 'ArrowLeft') step(-1, list.cards.length);
  else if (event.key === 'ArrowRight') step(1, list.cards.length);
  else if (event.key === ' ') { event.preventDefault(); browse.flipped = !browse.flipped; ctx.render(); }
});
```

- [ ] **Step 2: Style the card**

In `app/style.css`:

```css
.card { border: 1px solid var(--rule); border-radius: 14px; background: var(--surface);
  padding: 1.5rem 1rem; text-align: center; min-height: 40vh;
  display: flex; flex-direction: column; justify-content: center; gap: .5rem;
  cursor: pointer; user-select: none; }
.card .prompt { margin: 0; }
```

- [ ] **Step 3: Route to it**

In `app/main.js`, import `{ showView }` from `./screens/view.js` and add:

```js
  else if (route === 'view' && arg) showView(arg);
```

- [ ] **Step 4: Cache the module**

Add `'./app/screens/view.js'` to `SHELL`, bump to `myquizzlet-v7`.

- [ ] **Step 5: Verify by using it**

```bash
npm test
npm run dev
```

Check: the card shows the front and the column's label; a tap flips it and the
label changes; Prev and Next move and always land unflipped; the arrow keys and
space do the same; the counter wraps at both ends; Random order reshuffles and
survives a reload; leaving and returning keeps your place. Then confirm nothing
was written: `localStorage['mq:progress:<id>']` must be unchanged after a long
browse.

- [ ] **Step 6: Commit**

```bash
git add app/screens/view.js app/main.js app/style.css sw.js
git commit -q -F -   # subject: feat: browse a list one card at a time
```

---

### Task 14: Training

**Files:**
- Create: `app/screens/train.js`
- Modify: `app/main.js`, `app/style.css`, `sw.js`

**Interfaces:**
- Consumes: `pickBatch`, `choices`, `startBatch`, `currentKey`, `currentLevel`,
  `advance` (Tasks 4–6); `newItem`, `nextItem`, `parseKey` from `app/srs.js`;
  `grade` from `app/grade.js`.
- Produces: `showTrainSetup(id)` and `showTrainSession(id)`.

**The rule that matters:** only a *typed* answer calls `nextItem`. A
multiple-choice answer writes `level` and nothing else. Recognising a word
among four is a far easier task than recalling it, and letting it stretch a
review interval means meeting the word again long after it has gone.

- [ ] **Step 1: Write the screens**

Create `app/screens/train.js`:

```js
import { el } from '../ui.js';
import { store, screen, go, todayStr, ctx } from '../app.js';
import { pickBatch, choices, startBatch, currentKey, currentLevel, advance } from '../train.js';
import { newItem, nextItem, parseKey } from '../srs.js';
import { grade } from '../grade.js';

const BATCH = 8;

const setup = { directions: ['f2b', 'b2f'] };
let session = null;

// A multiple-choice answer moves the rung and nothing else: it must never
// stretch a review interval.
function saveLevel(listId, key, level) {
  const progress = store.getProgress(listId);
  const previous = progress.items[key] || newItem(todayStr());
  progress.items[key] = { ...previous, level };
  store.saveProgress(progress);
  ctx.sync?.schedule();
}

// A typed answer is a real recall attempt, and is scheduled like any other.
function saveAnswer(listId, key, correct) {
  const progress = store.getProgress(listId);
  const previous = progress.items[key] || newItem(todayStr());
  progress.items[key] = nextItem(previous, correct, todayStr(), new Date().toISOString());
  store.saveProgress(progress);
  ctx.sync?.schedule();
}

function refill() {
  const list = store.getList(session.listId);
  const keys = pickBatch({
    list, progress: store.getProgress(session.listId),
    directions: session.directions, size: BATCH, exclude: session.done,
  });
  if (keys.length === 0) { session.batch = null; return; }
  session.batch = startBatch(keys, store.getProgress(session.listId));
  session.justRefilled = session.done.length > 0;
}

export function showTrainSetup(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));
  view.append(el('h2', { text: 'Train' }));
  view.append(el('p', { class: 'muted', text: 'Eight words at a time. Pick the answer from '
    + 'four until it sticks, then type it. New words first, then whatever is shakiest.' }));

  const front = list.frontLabel || 'Front';
  const back = list.backLabel || 'Back';
  const radio = (value, label, checked) => el('label', { class: 'opt' }, [
    el('input', { type: 'radio', name: 'dir', value, ...(checked ? { checked: 'checked' } : {}) }),
    label,
  ]);
  const dirs = el('div', { class: 'opts' }, [
    radio('both', 'Both directions', setup.directions.length === 2),
    radio('f2b', `${front} → ${back}`, setup.directions.join() === 'f2b'),
    radio('b2f', `${back} → ${front}`, setup.directions.join() === 'b2f'),
  ]);
  view.append(dirs);

  view.append(el('button', {
    class: 'primary', text: 'Start',
    onclick: () => {
      const dir = dirs.querySelector('input:checked').value;
      setup.directions = dir === 'both' ? ['f2b', 'b2f'] : [dir];
      session = { listId: id, directions: setup.directions, done: [], batch: null,
                  right: 0, wrong: 0, justRefilled: false };
      refill();
      if (!session.batch) { alert('Nothing left to train in this list.'); return; }
      go(`#/train/${id}/go`);
    },
  }));
}

function answered(correct) {
  const key = currentKey(session.batch);
  const level = currentLevel(session.batch);
  if (level === 1) saveAnswer(session.listId, key, correct);
  else saveLevel(session.listId, key, correct ? 1 : 0);
  session[correct ? 'right' : 'wrong'] += 1;
  session.batch = advance(session.batch, correct);
  if (currentKey(session.batch) === null) {
    session.done = session.done.concat(session.batch.graduated);
    refill();
  }
  ctx.render();
}

export function showTrainSession(id) {
  if (!session || session.listId !== id) return go(`#/train/${id}`);
  const list = store.getList(id);
  const view = screen();
  view.append(el('div', { class: 'sessionbar' }, [
    el('a', { class: 'back', href: `#/list/${id}`, text: '← Quit' }),
    el('span', { class: 'muted', text: `${session.done.length} learned · ${session.right} right · ${session.wrong} wrong` }),
  ]));

  if (!session.batch) {
    view.append(el('h2', { text: 'Done' }));
    view.append(el('p', { text: `${session.done.length} word(s) trained. `
      + `${session.right} right, ${session.wrong} wrong.` }));
    view.append(el('a', { class: 'btn', href: `#/list/${id}`, text: 'Back to the list' }));
    session = null;
    return;
  }

  if (session.justRefilled) {
    view.append(el('p', { class: 'muted', text: `${session.done.length} done — carrying on` }));
    session.justRefilled = false;
  }

  const key = currentKey(session.batch);
  const { cardId, direction } = parseKey(key);
  const card = list.cards.find((c) => c.id === cardId);
  if (!card) {   // the card was deleted mid-session: drop the key, do not promote it
    session.batch = { ...session.batch, queue: session.batch.queue.slice(1) };
    return ctx.render();
  }
  const prompt = direction === 'f2b' ? card.front : card.back;
  const expected = direction === 'f2b' ? card.back : card.front;

  view.append(el('p', { class: 'prompt', text: prompt }));

  const options = currentLevel(session.batch) === 0 ? choices({ list, key }) : null;
  if (options) {
    view.append(el('div', { class: 'opts choices' }, options.map((option) => el('button', {
      class: 'choice', text: option, onclick: () => answered(option === expected),
    }))));
    return;
  }

  const input = el('input', { class: 'answer-input', autocapitalize: 'none',
    autocorrect: 'off', spellcheck: 'false', placeholder: 'your answer' });
  const form = el('form', {
    onsubmit: (event) => {
      event.preventDefault();
      const verdict = grade(expected, input.value);
      if (verdict === 'correct') return answered(true);
      form.replaceWith(el('div', { class: `verdict ${verdict}` }, [
        el('p', { text: verdict === 'typo' ? `Almost — it is “${expected}”` : `Answer: ${expected}` }),
        el('p', { class: 'muted', text: `you wrote: ${input.value}` }),
        el('div', { class: 'row' }, [
          el('button', { text: 'I was right', onclick: () => answered(true) }),
          el('button', { class: 'primary', text: verdict === 'typo' ? 'Got it' : 'Continue',
            onclick: () => answered(verdict === 'typo') }),
        ]),
      ]));
    },
  }, [input, el('button', { class: 'primary', type: 'submit', text: 'Check' })]);
  view.append(form);
  input.focus();
}
```

`choices` returning `null` — a list too short to build a question from — falls
through to the typing branch, which is exactly the intended behaviour.

- [ ] **Step 2: Style the choices and the session bar**

In `app/style.css`:

```css
.sessionbar { display: flex; align-items: center; justify-content: space-between;
  gap: .5rem; margin-bottom: .5rem; }
.choices { gap: .5rem; }
.choice { display: block; width: 100%; min-height: 52px; margin-bottom: .5rem;
  padding: .7rem 1rem; font-size: 1.1rem; text-align: left;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--rule); border-radius: 12px; }
```

- [ ] **Step 3: Route to them**

In `app/main.js`, import `{ showTrainSetup, showTrainSession }` from
`./screens/train.js` and add, with the `/go` case first:

```js
  else if (route === 'train' && arg && sub === 'go') showTrainSession(arg);
  else if (route === 'train' && arg) showTrainSetup(arg);
```

- [ ] **Step 4: Cache the module**

Add `'./app/screens/train.js'` to `SHELL`, bump to `myquizzlet-v8`.

- [ ] **Step 5: Verify by using it**

```bash
npm test
npm run dev
```

On a list of at least a dozen never-studied cards, check:

- the first questions are all multiple choice, with four plausible options and
  no option wildly longer than the rest;
- getting one right makes that word come back as a typing question, not
  immediately but after the others;
- getting a typing question wrong sends that word back to multiple choice;
- the same word is never asked twice in a row;
- after eight words graduate the session carries on without a dialogue;
- Quit at any point leaves the list screen consistent, and returning to Train
  resumes with the right rungs (check `level` in `localStorage['mq:progress:<id>']`);
- **the scheduler test:** answer only multiple-choice questions, then inspect
  the progress file — `box`, `due`, `seen` and `lapses` must be untouched and
  only `level` may have changed. Answer a typing question and `seen` must go up.

- [ ] **Step 6: Commit**

```bash
git add app/screens/train.js app/main.js app/style.css sw.js
git commit -q -F -   # subject: feat: training, from four choices to typing
```

---

### Task 15: Testing — the new route and swiping

**Files:**
- Modify: `app/ui.js` (add `swipeable`), `app/screens/test.js`,
  `app/style.css`, `sw.js`

**Interfaces:**
- Produces: `swipeable(node, { onLeft, onRight, threshold = 0.25 })` in
  `app/ui.js`, returning nothing and wiring pointer events on `node`.

Testing keeps everything it does today — write or flashcard, one direction or
both, a session size, and free review that leaves scheduling untouched. The
only additions are the direction labels (which now use the column names) and
the swipe.

- [ ] **Step 1: Add the swipe helper**

Append to `app/ui.js`:

```js
// Claims the pointer only once horizontal movement clearly dominates, so a
// vertical drag still scrolls the page.
export function swipeable(node, { onLeft, onRight, threshold = 0.25 }) {
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let claimed = false;

  const move = (dx) => { node.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`; };
  const release = () => {
    node.style.transition = 'transform .18s ease-out';
    node.style.transform = '';
    setTimeout(() => { node.style.transition = ''; }, 200);
  };

  node.addEventListener('pointerdown', (event) => {
    dragging = true;
    claimed = false;
    startX = event.clientX;
    startY = event.clientY;
  });

  node.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!claimed) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy)) return;
      claimed = true;
      node.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    move(dx);
  });

  const end = (event) => {
    if (!dragging) return;
    dragging = false;
    if (!claimed) return;
    const dx = event.clientX - startX;
    const far = Math.abs(dx) > node.offsetWidth * threshold;
    release();
    if (!far) return;
    if (dx > 0) onRight(); else onLeft();
  };

  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', () => { dragging = false; release(); });
}
```

- [ ] **Step 2: Point the test screens at the new routes**

In `app/screens/test.js`:

- `startSession` must end with `go(`#/test/${listId}/go`)`, not `#/session/…`.
- `showTestSession`'s guard must be `return go(`#/test/${listId}`)`.
- The "Study more" link on the done screen becomes `#/test/${listId}`, and
  "Back to lists" stays `#/`.
- The direction radios use the column labels: replace the label text
  `` `${list.name}: front → back` `` with `` `${front} → ${back}` `` and
  `'back → front'` with `` `${back} → ${front}` ``, where
  `const front = list.frontLabel || 'Front'` and
  `const back = list.backLabel || 'Back'`.
- The heading becomes `` `Test: ${list.name}` ``.
- Add the session bar at the top of `showTestSession`, matching training:

```js
  view.append(el('div', { class: 'sessionbar' }, [
    el('a', { class: 'back', href: `#/list/${listId}`, text: '← Quit' }),
    el('span', { class: 'muted', text: `${session.at + 1} / ${session.queue.length}` }),
  ]));
```

and delete the old `${session.at + 1} / ${session.queue.length}` paragraph.

- [ ] **Step 3: Make the flashcard swipeable**

In `showTestSession`, replace the `setup.mode === 'cards'` branch with:

```js
  if (setup.mode === 'cards') {
    const face = el('div', { class: 'card' }, [
      el('p', { class: 'prompt', text: prompt }),
      el('p', { class: 'muted', text: 'tap to reveal · swipe right if you knew it' }),
    ]);
    const reveal = () => {
      clear(face);
      face.append(el('p', { class: 'prompt', text: expected }));
      face.append(el('p', { class: 'muted', text: 'swipe right if you knew it' }));
    };
    face.addEventListener('click', reveal);
    swipeable(face, { onLeft: () => answer(false), onRight: () => answer(true) });
    view.append(face);
    view.append(el('div', { class: 'actions' }, [
      el('button', { text: 'Didn’t know', onclick: () => answer(false) }),
      el('button', { class: 'primary', text: 'Knew it', onclick: () => answer(true) }),
    ]));
    return;
  }
```

Import `clear` and `swipeable` from `../ui.js` at the top of the file. The
buttons stay: the desktop has no swipe, and a gesture with no visible
alternative is a gesture nobody finds.

- [ ] **Step 4: Style the swipe**

In `app/style.css`:

```css
.card { touch-action: pan-y; }
```

- [ ] **Step 5: Cache nothing new, but verify the routes**

`sw.js` needs no change here. Confirm `#/study/<id>` still redirects: the
router case added in Task 8 stays.

- [ ] **Step 6: Verify by using it**

```bash
npm test
npm run dev
```

Check on a touch device or with the browser's device emulation: a short drag
springs back; a long drag right counts as known and a long drag left as
unknown; a vertical drag scrolls the page instead of moving the card; the
buttons still work; write mode is unchanged, including "I was right"; free
review still leaves `box` and `due` alone; and an old `#/study/<id>` URL lands
on the test setup.

- [ ] **Step 7: Commit**

```bash
git add app/ui.js app/screens/test.js app/style.css
git commit -q -F -   # subject: feat: swipe a flashcard, and name the directions
```

---

### Task 16: Documentation

**Files:**
- Modify: `docs/data-model.md`, `docs/study-algorithm.md`,
  `docs/architecture.md`, `CLAUDE.md`

The docs are the design's memory; leaving them describing the old shape is how
the next change gets made against a model that no longer exists.

- [ ] **Step 1: Update `docs/data-model.md`**

In the list example add `folder`, `frontLabel` and `backLabel`, and document
them: the folder is a plain optional string, one per list, flat, with no
folders file — the set of folders is the union of the values in use, so a
folder exists exactly as long as a list is in it. Labels are display names for
the two columns; they never re-key data, and `front`/`back` stay the card's
keys. In the progress example add `level`, `0` or `1`, absent meaning `0`, the
training rung, reset to `0` by any wrong answer.

- [ ] **Step 2: Update `docs/study-algorithm.md`**

Add a section on training: two rungs, batches of eight, never-seen first then
lowest box then most lapses, right promotes and wrong drops to rung 0, and —
stated plainly, because it is the subtle part — only typed answers touch the
Leitner boxes, because recognising among four is not recalling.

- [ ] **Step 3: Update `docs/architecture.md` and `CLAUDE.md`**

Replace the layout block in both with the new one: `main.js` as router and
header, `app.js`, `status.js`, `listform.js`, `screens/`, and the three new
pure modules `langs.js`, `stats.js`, `train.js`. Add to `CLAUDE.md`'s "Rules
that are easy to get wrong": *every new module must be added to `SHELL` in
`sw.js` and the cache name bumped, or the app stops working offline*.

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -q -F -   # subject: docs: folders, named columns and training
```

---

## Not in this plan

**QR onboarding.** `qr.js` (byte mode, error correction level L, versions 1–13,
tested against `qrencode` fixtures), the adopt screen, and the "Add a device"
settings section, all specified in `devnotes/2026-09-01-myquizzlet-design.md`
and carried into §10 of the spec.

This is an independent subsystem — 250 lines of Galois-field arithmetic and its
fixture suite have nothing to do with folders, statistics or training, and
gluing them into this plan would make both harder to review. It gets its own
plan, written when this one is done. Nothing here depends on it, and nothing in
it depends on anything here beyond a route in the router.
