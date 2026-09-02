# MyQuizzlet Implementation Plan — second pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the shipped-and-used app into one that is pleasant to live with: lists that can be renamed, deleted and ordered by recency; sessions that default to everything due and end with a real result; a colour system instead of scattered hex; and a second device that can be set up in seconds.

**Architecture:** Unchanged. Plain ES modules, no build step, `main.js` owns the DOM, `store.js` owns storage, `github.js` owns the network, and the pure modules carry the tests. This pass adds exactly one module — `app/qr.js`, pure — and one CSS rule that outranks taste: every colour comes from a custom property.

**Tech Stack:** HTML, CSS, vanilla JavaScript (ES modules). Vitest for tests (dev-only). GitHub Pages, GitHub contents API. No runtime dependencies.

**Spec:** `devnotes/2026-09-01-myquizzlet-design.md`, revised 2026-09-02. Read it before starting. This plan implements that revision and does not repeat its reasoning.

**Predecessor:** `devnotes/2026-09-01-myquizzlet-plan.md` built Tasks 1–10 and 12. Its Tasks 11 (list conflict screen) and 13 (QR onboarding) were never built and are folded in here, as Tasks 10 and 13 below. Do not execute the old plan's Tasks 11 or 13 — the versions here supersede them.

## Global Constraints

Every task's requirements implicitly include these.

- **No build step.** Source files are served as-is. Never add a bundler, transpiler, framework, or `<script src="https://cdn...">`. `git push` is the deploy.
- **No runtime dependencies.** `package.json` may contain `vitest` as a devDependency and nothing else.
- **ES modules only.** Development needs a local server: `python3 -m http.server 8000`.
- **Pure modules take their inputs as arguments**, including today's date. Never call `new Date()` inside `srs.js`, `grade.js`, `csv.js`, `merge.js` or `qr.js`.
- **Every colour comes from a CSS custom property.** No hex literal, no `rgb(`, no `rgba(`, no `hsl(` anywhere in `app/style.css` except inside a `:root` block. Task 1 adds a test that enforces this; it must stay green for the rest of the plan. This rule exists because a specificity accident silently drained the colour out of the sync status dot once already.
- **Card ids and list ids are permanent.** Renaming a list changes `name` and nothing else.
- **Never write a token into a file in this repo.** The token lives only in browser storage. A token may be rendered on screen as a QR code, and may never be sent to any third party, including a QR image service.
- **Writes to GitHub always carry the file's `sha`.** A rejected write is a conflict to resolve, never something to retry with force.
- **When `app/` gains or loses a file, update `SHELL` in `sw.js` and bump `CACHE`.** `cache.addAll` is atomic: one wrong path and the service worker installs nothing, silently.
- **`npm test` passes at the end of every task.**

## Stages, and where to stop

| Stage | Tasks | Ends with |
|---|---|---|
| **E — Visual** | 1–3 | The Paper look, three themes, a reorganised Settings, a real icon. |
| **F — List management** | 4–6 | Rename, delete (propagated to GitHub), most-recently-used ordering. |
| **G — Studying** | 7–9 | Sessions default to everything due, end on a result, and take swipes. |
| **H — Sync and auth** | 10–13 | The conflict screen, `qr.js`, token adoption, and device onboarding. |

Clear context at stage boundaries, not inside one. At each boundary `npm test` passes and the app runs.

## File Structure

```
index.html            + inline pre-paint theme script
app/
  main.js             screens, routing; grows the adopt, results and conflict screens
  ui.js               unchanged
  store.js            + rename, tombstones, pure recency helper
  github.js           + deleteFile
  sync.js             + deletion propagation and tombstone-aware pull
  srs.js              unchanged
  grade.js            + sessionVerdict
  csv.js              unchanged
  merge.js            unchanged
  qr.js               NEW — pure QR encoder, byte mode, EC level L, versions 1–13
  style.css           rewritten onto tokens; three themes
test/
  style.test.js       NEW — enforces the colour rule
  qr.test.js          NEW — fixtures generated with qrencode
  store.test.js  github.test.js  grade.test.js  srs.test.js  csv.test.js  merge.test.js
  fixtures/qr-*.txt   NEW — committed qrencode output
icons/
  icon.svg            NEW — source of truth for the app icon
  icon-192.png  icon-512.png    regenerated from it
  onboard-qr.png  token-qr.png  NEW — static QRs of two public URLs
manifest.webmanifest  colours match the Paper theme
sw.js                 SHELL gains qr.js; CACHE bumped
```

---

# STAGE E — Visual (Tasks 1–3)

### Task 1: The colour system and the Paper theme

**Files:**
- Modify: `app/style.css` (whole file)
- Create: `test/style.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: the token set `--ground --surface --ink --rule --field --muted --accent --ok --bad --warn`, defined on `:root`. Every later task styles with these and adds no colour literal.

The spec names eight tokens; `--field` (input borders) and `--warn` (the token-expiry banner's background) are the two subordinates the real stylesheet needs. Ten in total, and no more without a reason.

- [ ] **Step 1: Write the failing test**

Create `test/style.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');

// Strips every :root block (including :root[data-theme="…"]), then returns the
// value half of every declaration that survives.
function valuesOutsideRoot(source) {
  const withoutRoot = source.replace(/:root[^{]*\{[^}]*\}/g, '');
  return [...withoutRoot.matchAll(/\{([^}]*)\}/g)]
    .flatMap((match) => match[1].split(';'))
    .map((decl) => decl.slice(decl.indexOf(':') + 1).trim())
    .filter(Boolean);
}

const TOKENS = ['--ground', '--surface', '--ink', '--rule', '--field',
                '--muted', '--accent', '--ok', '--bad', '--warn'];

describe('the colour rule', () => {
  it('states every colour as a custom property, never as a literal', () => {
    const offenders = valuesOutsideRoot(css)
      .filter((value) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(value));
    expect(offenders).toEqual([]);
  });

  it('defines the whole token set', () => {
    for (const token of TOKENS) expect(css).toContain(`${token}:`);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/style.test.js`
Expected: FAIL. The first test lists the current literals (`#333`, `#0a0`, `#c80`, `#a00`, `#999`, `#ddd`, `#eee`, `#777`, `#fff6e0`); the second fails on `--ground:`.

- [ ] **Step 3: Rewrite `app/style.css`**

Replace the file entirely:

```css
:root {
  --ground:  #faf7f2;
  --surface: #ffffff;
  --ink:     #1c1917;
  --rule:    #e8e0d2;
  --field:   #cfc6b6;
  --muted:   #8a8378;
  --accent:  #b45309;
  --ok:      #4d7c3f;
  --bad:     #b91c1c;
  --warn:    #fdf6e7;
}

*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: var(--ground); color: var(--ink); }
button { min-height: 44px; font-size: 1rem; }
main { padding: 1rem; max-width: 40rem; margin: 0 auto; }
a { color: var(--accent); }
h2 { font-size: 1.35rem; margin: .4rem 0 1rem; }
h3 { font-size: .78rem; letter-spacing: .06em; text-transform: uppercase;
     color: var(--muted); margin: 1.4rem 0 .4rem; }

#topbar { display: flex; align-items: center; gap: .5rem; padding: .5rem 1rem;
          background: var(--surface); border-bottom: 1px solid var(--rule); }
#topbar h1 { margin: 0 auto 0 0; font-size: 1.25rem; }
#topbar a, #sync-dot { display: flex; align-items: center; justify-content: center;
                       width: 44px; height: 44px; font-size: 1.5rem; }
#topbar a { text-decoration: none; color: var(--ink); }

.row { display: flex; justify-content: space-between; align-items: center; gap: .5rem;
       padding: .6rem 0; border-bottom: 1px solid var(--rule); }
.row:last-child { border-bottom: none; }
.muted { color: var(--muted); }
.back { display: inline-block; margin-bottom: .5rem; }

table.cards { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.cards td { border-bottom: 1px solid var(--rule); }
table.cards td:last-child { width: 3rem; }
table.cards input { width: 100%; border: 1px solid transparent; padding: .5rem .4rem;
                    font-size: 1rem; background: transparent; color: var(--ink); }
table.cards input:focus { border-color: var(--field); background: var(--surface); }

form.addcard, form.newlist { display: flex; gap: .5rem; margin: 1rem 0; }
form input { flex: 1; min-width: 0; }
input:not([type="radio"]):not([type="checkbox"]), textarea {
  padding: .5rem; font-size: 1rem; font-family: inherit;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--field); border-radius: 6px;
}
input[type="radio"], input[type="checkbox"] { width: 20px; height: 20px; }
textarea { width: 100%; }
label { display: block; margin: .75rem 0; }
.field input { width: 100%; }
.opt input { width: auto; flex: none; }

.opts { display: flex; flex-direction: column; }
.opt { display: flex; gap: .6rem; align-items: center; min-height: 44px;
       border-bottom: 1px solid var(--rule); }
.opt:last-child { border-bottom: none; }

.btn, button.primary, button.ghost { display: inline-block; padding: .6rem 1rem;
       border: 1px solid var(--ink); border-radius: 8px; background: var(--surface);
       text-decoration: none; color: var(--ink); font-size: 1rem; }
button.primary { background: var(--ink); color: var(--ground); }
button.link { background: none; border: none; color: var(--bad); font-size: 1rem; }
.badge { background: var(--accent); color: var(--surface); border-radius: 999px;
         padding: 0 .5rem; font-size: .85rem; font-weight: 600; }

.prompt { font-size: 2rem; text-align: center; margin: 2rem 0; }
.answer { font-size: 1.5rem; text-align: center; }
.answer-input { width: 100%; font-size: 1.5rem; padding: .6rem; }
.verdict.wrong { border-left: 4px solid var(--bad); padding-left: .75rem; }
.verdict.typo { border-left: 4px solid var(--accent); padding-left: .75rem; }

.dot.synced { color: var(--ok); }
.dot.pending { color: var(--accent); }
.dot.error { color: var(--bad); }
.dot.offline, .dot.off { color: var(--muted); }

.warn { background: var(--warn); border-left: 4px solid var(--accent); padding: .5rem .75rem; }
```

Two things in here are load-bearing and must not be "tidied" later. `#topbar a` sets `color`, and `#sync-dot` must not — an earlier version set it on both, and because `#sync-dot` is an ID it beat every `.dot.*` rule and drained the status indicator of its meaning. And `.opt` now carries `min-height: 44px`, which is the deferred tap-target fix.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, including both new assertions.

- [ ] **Step 5: Look at it**

`python3 -m http.server 8000`, then open `http://localhost:8000` and walk Home → a list → study setup → a session → Settings. Nothing should be unstyled or unreadable; the ground is warm off-white, links and badges are amber, the sync dot is coloured (green when synced).

- [ ] **Step 6: Commit**

```bash
git add app/style.css test/style.test.js
git commit -m "feat: colour tokens and the Paper theme, enforced by a test"
```

---

### Task 2: Three themes, the picker, and a reorganised Settings

**Files:**
- Modify: `app/style.css`, `index.html`, `app/main.js`

**Interfaces:**
- Consumes: the token set from Task 1.
- Produces: `applyTheme(id)` and a `theme` key in `mq:settings`; `STATUS` (the glyph and wording table) used by `setStatus`; `section(title, nodes)`, a helper later tasks add Settings sections with.

- [ ] **Step 1: Add the two alternate themes to `app/style.css`**

Immediately after the `:root { … }` block:

```css
:root { color-scheme: light; }

:root[data-theme="study"] {
  --ground:  #f1f3f9;
  --surface: #ffffff;
  --ink:     #0f172a;
  --rule:    #dfe4f2;
  --field:   #cdd5f0;
  --muted:   #64748b;
  --accent:  #4255ff;
  --ok:      #12b76a;
  --bad:     #e04343;
  --warn:    #fff7e6;
}

:root[data-theme="focus"] {
  color-scheme: dark;
  --ground:  #0f1720;
  --surface: #1b2530;
  --ink:     #e7edf3;
  --rule:    #26333f;
  --field:   #3b4a58;
  --muted:   #9fb0bd;
  --accent:  #2dd4bf;
  --ok:      #5fd08a;
  --bad:     #f87171;
  --warn:    #2a2416;
}

:root { --chip-paper: #faf7f2; --chip-study: #f1f3f9; --chip-focus: #0f1720; }
```

The three `--chip-*` tokens exist so the picker can show each theme's ground *while wearing another theme*. They live on `:root`, so the colour rule holds.

Then append the picker's styles:

```css
.themes { display: flex; gap: .6rem; }
.themes button { flex: 1; padding: .5rem; border: 2px solid var(--rule); border-radius: 10px;
                 background: var(--surface); color: var(--ink); font-size: .85rem; font-weight: 600; }
.themes button.on { border-color: var(--accent); }
.chip { display: block; height: 30px; border-radius: 6px; margin-bottom: .35rem;
        border: 1px solid var(--rule); }
.chip.paper { background: var(--chip-paper); }
.chip.study { background: var(--chip-study); }
.chip.focus { background: var(--chip-focus); }
section.sect { padding: .2rem 0 1rem; border-bottom: 1px solid var(--rule); }
section.sect:last-child { border-bottom: none; }
.statusline { display: flex; align-items: center; gap: .5rem; font-weight: 600; }
.steps { margin: .5rem 0; padding-left: 1.2rem; }
.steps li { margin: .35rem 0; }
```

- [ ] **Step 2: Stamp the theme before first paint**

In `index.html`, replace `<meta name="theme-color" content="#333333">` with:

```html
  <meta name="theme-color" content="#faf7f2">
  <script>
    // Runs before first paint. main.js is a module and therefore deferred, so
    // without this the app flashes the default theme on every launch.
    try {
      const theme = JSON.parse(localStorage.getItem('mq:settings') || '{}').theme;
      if (theme && theme !== 'paper') document.documentElement.dataset.theme = theme;
    } catch (error) { /* a corrupt settings blob is not worth a blank screen */ }
  </script>
```

- [ ] **Step 3: Teach `main.js` about themes and the new status glyphs**

Replace the whole `setStatus` function and add the theme helpers just below it:

```javascript
const STATUS = {
  synced:  { mark: '●', word: 'Everything is on GitHub' },
  pending: { mark: '↑', word: 'Changes waiting to push' },
  offline: { mark: '○', word: 'Offline — will catch up' },
  error:   { mark: '✕', word: 'Sync failed' },
  off:     { mark: '⊘', word: 'No token — read-only' },
};

let status = { state: 'off', detail: '' };

function setStatus(state, detail = '') {
  status = { state, detail };
  const dot = $('#sync-dot');
  dot.textContent = STATUS[state].mark;
  dot.className = `dot ${state}`;
  dot.title = detail ? `${STATUS[state].word}: ${detail}` : STATUS[state].word;
  const line = $('#sync-line');
  if (line) line.replaceWith(statusLine());
}

function statusLine() {
  return el('div', { class: 'statusline', id: 'sync-line' }, [
    el('span', { class: `dot ${status.state}`, text: STATUS[status.state].mark }),
    status.detail ? `${STATUS[status.state].word}: ${status.detail}` : STATUS[status.state].word,
  ]);
}

const THEMES = [{ id: 'paper', name: 'Paper' }, { id: 'study', name: 'Study' },
                { id: 'focus', name: 'Focus' }];

function applyTheme(id) {
  if (id && id !== 'paper') document.documentElement.dataset.theme = id;
  else delete document.documentElement.dataset.theme;
}

function themePicker() {
  const current = settings().theme || 'paper';
  return el('div', { class: 'themes' }, THEMES.map((theme) => el('button', {
    class: `theme${theme.id === current ? ' on' : ''}`,
    onclick: () => {
      saveSettings({ ...settings(), theme: theme.id });
      applyTheme(theme.id);
      render();
    },
  }, [el('span', { class: `chip ${theme.id}` }), theme.name])));
}

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}
```

The status glyphs change from `● ◐ ◌ ✕ ○` to `● ↑ ○ ✕ ⊘`: five shapes that differ in *form*, not only in colour, which is what the spec asks for.

- [ ] **Step 4: Rewrite `showSettings` into sections**

Replace the whole function:

```javascript
function showSettings() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'Settings' }));

  if (!current.token) {
    view.append(section('Set up this device', [
      el('p', { class: 'muted', text: 'Right now this device can study, but not save changes.' }),
      el('ol', { class: 'steps' }, [
        el('li', { text: 'On a device that already works, open Settings and tap “Show token QR”.' }),
        el('li', { text: 'Point this device’s camera at it and open the link.' }),
      ]),
      el('p', { class: 'muted' }, [
        'No other device set up yet? ',
        el('a', { target: '_blank', rel: 'noopener',
          href: 'https://github.com/settings/personal-access-tokens/new',
          text: 'Create a token on GitHub' }),
        ` instead — repository access: only ${REPO}; permissions: Contents → Read and write.`,
      ]),
    ]));
  }

  view.append(section('Appearance', [
    themePicker(),
    el('p', { class: 'muted', text: 'Stored on this device only — it is a preference, not data, so it never syncs.' }),
  ]));

  view.append(section('Sync', [
    statusLine(),
    el('p', { class: 'muted', text: `${store.dirtyKeys().length} change(s) waiting.` }),
    el('div', { class: 'row' }, [
      el('button', { text: 'Pull now', onclick: () => sync.pullAll().then(render).catch((e) => setStatus('error', e.message)) }),
      el('button', { text: 'Push now', onclick: () => sync.pushDirty().then(render).catch((e) => setStatus('error', e.message)) }),
      el('button', { text: 'Retry', onclick: () => sync.syncNow().then(render) }),
    ]),
  ]));

  const token = el('input', { type: 'password', value: current.token || '', placeholder: 'github_pat_…' });
  const expiry = el('input', { type: 'date', value: current.tokenExpiry || '' });
  view.append(section('GitHub token', [
    el('p', { class: 'muted', text: 'Needed only to save changes. Studying works without one.' }),
    el('label', { class: 'field' }, ['Token', token]),
    el('label', { class: 'field' }, ['Expires on (from the GitHub page)', expiry]),
    el('button', {
      class: 'primary', text: 'Save token',
      onclick: () => {
        saveSettings({ ...settings(), token: token.value.trim(), tokenExpiry: expiry.value || null });
        initSync();
        render();
      },
    }),
  ]));

  view.append(section('About', [
    el('p', { class: 'muted' }, [
      'MyQuizzlet · ',
      el('a', { href: `https://github.com/${REPO}`, target: '_blank', rel: 'noopener', text: 'source on GitHub' }),
    ]),
  ]));
}
```

Note the `{ ...settings(), … }` spread on both writes. `saveSettings` replaces the whole blob, so without the spread, saving a token would silently erase the chosen theme and vice versa.

- [ ] **Step 5: Apply the stored theme on boot**

At the bottom of `main.js`, immediately before `initSync();`:

```javascript
applyTheme(settings().theme);
```

The inline script has already done this, but a save in another tab, or a settings blob written before this feature existed, should not leave the two out of step.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS (91 + 2 existing assertions; the colour test must still be green — the theme blocks are `:root` blocks and are exempt).

- [ ] **Step 7: Try all three**

With the server running: open Settings, switch Paper → Study → Focus, and confirm each repaints instantly and the *whole* app changes, including the topbar, the session screen and the status dot. Then reload the page on Focus and confirm there is no white flash. Finally set a token and confirm the theme survives saving it (this is the spread bug, and it is easy to reintroduce).

- [ ] **Step 8: Commit**

```bash
git add app/style.css index.html app/main.js
git commit -m "feat: three themes, a theme picker, and Settings in sections"
```

---

### Task 3: A real app icon

**Files:**
- Create: `icons/icon.svg`
- Modify: `icons/icon-192.png`, `icons/icon-512.png`, `manifest.webmanifest`

**Interfaces:**
- Consumes: the Paper token values from Task 1.
- Produces: nothing other modules use.

The icons are flat grey placeholders and the manifest's colours are the old `#333333`. Paper is the default theme, so the icon and the manifest wear Paper.

- [ ] **Step 1: Write `icons/icon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#faf7f2"/>
  <g fill="none" stroke="#b45309" stroke-width="34" stroke-linecap="round">
    <circle cx="256" cy="248" r="118"/>
    <line x1="300" y1="300" x2="372" y2="372"/>
  </g>
</svg>
```

A Q, drawn as a ring and a tail rather than as text, so it does not depend on a font being installed on whatever machine rasterises it. Everything sits inside the middle 62% of the canvas, which keeps it clear of the ~20% that Android's maskable crop can remove.

- [ ] **Step 2: Rasterise**

```bash
rsvg-convert -w 192 -h 192 icons/icon.svg -o icons/icon-192.png
rsvg-convert -w 512 -h 512 icons/icon.svg -o icons/icon-512.png
```

If `rsvg-convert` is not installed (`brew install librsvg`), use Chrome instead:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --screenshot=icons/icon-512.png --window-size=512,512 --hide-scrollbars icons/icon.svg
sips -z 192 192 icons/icon-512.png --out icons/icon-192.png
```

- [ ] **Step 3: Verify the dimensions actually match the manifest**

```bash
sips -g pixelWidth -g pixelHeight icons/icon-192.png icons/icon-512.png
```

Expected: 192×192 and 512×512. A manifest whose declared `sizes` disagree with the file is one of the ways Chrome silently declines to offer "Install".

- [ ] **Step 4: Update `manifest.webmanifest`**

Change two lines:

```json
  "background_color": "#faf7f2",
  "theme_color": "#faf7f2",
```

- [ ] **Step 5: Commit**

```bash
git add icons/icon.svg icons/icon-192.png icons/icon-512.png manifest.webmanifest
git commit -m "feat: a real app icon in the Paper palette"
```

- [ ] **Step 6: STOP — this is a stage boundary**

`npm test` passes and the app runs. The human partner pushes and re-installs on the phone to see the icon and themes on the real device. Clear context before Stage F.

---

# STAGE F — List management (Tasks 4–6)

### Task 4: Rename and delete a list, locally

**Files:**
- Modify: `app/store.js`, `app/main.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: nothing from Stage E.
- Produces: `store.renameList(id, name) -> list`, `store.deletedIds() -> string[]`, `store.clearDeleted(id)`. `store.deleteList(id)` now also records a tombstone. Task 5 consumes all three.

`store.deleteList` already existed and worked, but nothing called it and nothing told GitHub. This task builds the local half; Task 5 builds the half that survives a sync.

- [ ] **Step 1: Write the failing tests**

Append to `test/store.test.js`:

```javascript
describe('renaming', () => {
  it('changes the name and keeps the id and the cards', () => {
    const list = store.createList({ name: 'Spanish' });
    store.addCards(list.id, [{ front: 'el pan', back: 'le pain' }]);
    const renamed = store.renameList(list.id, 'Spanish – Food');
    expect(renamed.id).toBe(list.id);
    expect(renamed.name).toBe('Spanish – Food');
    expect(renamed.cards).toHaveLength(1);
    expect(store.listIds()).toEqual([list.id]);
  });
});

describe('deleting a list', () => {
  it('forgets the list and its progress', () => {
    const list = store.createList({ name: 'Spanish' });
    store.saveProgress({ listId: list.id, items: {} });
    store.deleteList(list.id);
    expect(store.getList(list.id)).toBeNull();
    expect(store.listIds()).toEqual([]);
  });

  it('records a tombstone and marks both files dirty', () => {
    const list = store.createList({ name: 'Spanish' });
    store.deleteList(list.id);
    expect(store.deletedIds()).toEqual([list.id]);
    expect(store.dirtyKeys()).toContain(`list:${list.id}`);
    expect(store.dirtyKeys()).toContain(`progress:${list.id}`);
  });

  it('keeps the base shas, which the delete request needs', () => {
    const list = store.createList({ name: 'Spanish' });
    store.setBase(`list:${list.id}`, { sha: 'abc123', updatedAt: null });
    store.deleteList(list.id);
    expect(store.getBase(`list:${list.id}`)).toEqual({ sha: 'abc123', updatedAt: null });
  });

  it('clears a tombstone only when told to', () => {
    const list = store.createList({ name: 'Spanish' });
    store.deleteList(list.id);
    store.clearDeleted(list.id);
    expect(store.deletedIds()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/store.test.js`
Expected: FAIL — `store.renameList is not a function`, `store.deletedIds is not a function`.

- [ ] **Step 3: Implement in `app/store.js`**

Inside `createStore`, next to `markDirty`:

```javascript
  const deleted = () => read('deleted', []);
```

Then in the returned object, replace `deleteList` and add the two neighbours:

```javascript
    renameList: (id, name) => {
      const list = getList(id);
      if (!list) throw new Error(`no such list: ${id}`);
      return saveList({ ...list, name });
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
    clearDeleted(id) {
      write('deleted', deleted().filter((x) => x !== id));
    },
```

The base shas are deliberately left alone: they are the only proof of which remote version this device is entitled to delete.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add the two controls to the List screen**

In `app/main.js`, inside `showList`, immediately after `view.append(el('h2', { text: list.name }));`:

```javascript
  view.append(el('div', { class: 'row' }, [
    el('button', { text: 'Rename', onclick: () => renameList(list) }),
    el('button', { class: 'link', text: 'Delete list', onclick: () => deleteList(list) }),
  ]));
```

And as new top-level functions:

```javascript
function renameList(list) {
  const name = prompt('New name for this list', list.name);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed || trimmed === list.name) return;
  store.renameList(list.id, trimmed);
  sync?.schedule();
  render();
}

function deleteList(list) {
  const records = Object.keys(store.getProgress(list.id).items).length;
  const ok = confirm(`Delete “${list.name}”?\n\n${list.cards.length} card(s) and `
    + `${records} progress record(s) go, here and on GitHub. This cannot be undone.`);
  if (!ok) return;
  store.deleteList(list.id);
  sync?.schedule();
  go('#/');
}
```

`prompt` and `confirm` are used deliberately. They are two lines instead of two modal screens, they are correctly sized and dismissible on a phone, and destructive-confirmation UI is not where this app should spend code.

- [ ] **Step 6: Try both**

With the server running: rename a list and confirm the URL (`#/list/<id>`) does *not* change — the id is permanent, only the heading moves. Then create a throwaway list, delete it, and confirm you land back on Home without it. The sync dot goes amber; it will not go green until Task 5.

- [ ] **Step 7: Commit**

```bash
git add app/store.js app/main.js test/store.test.js
git commit -m "feat: rename and delete a list"
```

---

### Task 5: Deletion that survives a sync

**Files:**
- Modify: `app/github.js`, `app/sync.js`
- Test: `test/github.test.js`, `test/sync-delete.test.js` (create)

**Interfaces:**
- Consumes: `store.deletedIds()`, `store.clearDeleted(id)` from Task 4.
- Produces: `github.deleteFile(path, sha, message) -> boolean` (false if the file was already gone).

`sync.js` is not a pure module, and the project rule is that screens are verified by use. `sync.js` is neither: it is headless logic with two injected collaborators, and this particular path — a deletion racing a pull — is the one place in the app where a bug silently resurrects data. It gets a real test with a fake `github`.

- [ ] **Step 1: Write the failing test for `github.deleteFile`**

Append to `test/github.test.js`, following the fake-fetch pattern already in that file:

```javascript
describe('deleteFile', () => {
  it('sends DELETE with the sha and the branch, and bypasses the cache', async () => {
    let captured = null;
    const github = createGitHub({
      repo: 'me/repo', branch: 'data', token: 't',
      fetchImpl: async (url, options) => {
        captured = { url, options };
        return { ok: true, status: 200, json: async () => ({ commit: {} }) };
      },
    });
    const gone = await github.deleteFile('data/lists/x.json', 'sha123', 'delete list x');
    expect(gone).toBe(true);
    expect(captured.options.method).toBe('DELETE');
    expect(captured.options.cache).toBe('no-store');
    expect(JSON.parse(captured.options.body)).toEqual({
      message: 'delete list x', branch: 'data', sha: 'sha123',
    });
  });

  it('reports a file that was already gone rather than throwing', async () => {
    const github = createGitHub({
      repo: 'me/repo', branch: 'data', token: 't',
      fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    });
    expect(await github.deleteFile('data/lists/x.json', 'sha123', 'm')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/github.test.js`
Expected: FAIL — `github.deleteFile is not a function`.

- [ ] **Step 3: Implement `deleteFile` in `app/github.js`**

In the returned object, after `putFile`:

```javascript
    async deleteFile(path, sha, message) {
      const { missing } = await request(url(path), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, branch, sha }),
      });
      return !missing;
    },
```

It routes through the same `request` helper, so it inherits `cache: 'no-store'` and the `ConflictError` on 409/422 — a stale sha on a delete is a conflict for exactly the same reason it is on a write.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the sync half**

Create `test/sync-delete.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '../app/store.js';
import { createSync } from '../app/sync.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// A GitHub that remembers files in memory and records what was asked of it.
function fakeGitHub(files = {}) {
  const calls = [];
  return {
    calls,
    async getFile(path) {
      calls.push(['get', path]);
      return files[path] ? { json: files[path].json, sha: files[path].sha } : null;
    },
    async putFile(path, json, sha, message) {
      calls.push(['put', path, sha]);
      files[path] = { json, sha: `${sha || 'new'}+` };
      return { sha: files[path].sha };
    },
    async listDir() {
      calls.push(['list']);
      return Object.keys(files)
        .filter((p) => p.startsWith('data/lists/'))
        .map((p) => ({ name: p.split('/').pop(), path: p, sha: files[p].sha }));
    },
    async deleteFile(path, sha) {
      calls.push(['delete', path, sha]);
      const existed = Boolean(files[path]);
      delete files[path];
      return existed;
    },
  };
}

let store, files, github, sync;

beforeEach(() => {
  store = createStore(fakeStorage(), () => new Date('2026-09-02T10:00:00Z'));
  files = {
    'data/lists/es-food.json': { sha: 'L1', json: { id: 'es-food', name: 'Food', cards: [], updatedAt: '2026-09-01T00:00:00Z' } },
    'data/progress/es-food.json': { sha: 'P1', json: { listId: 'es-food', updatedAt: '2026-09-01T00:00:00Z', items: {} } },
  };
  github = fakeGitHub(files);
  sync = createSync({ store, github, onStatus: () => {}, onConflict: () => {}, canPush: true });
});

describe('deleting a list through sync', () => {
  it('deletes both files on GitHub and then forgets the tombstone', async () => {
    await sync.pullAll();
    store.deleteList('es-food');
    await sync.pushDirty();

    expect(files['data/lists/es-food.json']).toBeUndefined();
    expect(files['data/progress/es-food.json']).toBeUndefined();
    expect(github.calls).toContainEqual(['delete', 'data/lists/es-food.json', 'L1']);
    expect(store.deletedIds()).toEqual([]);
    expect(store.dirtyKeys()).toEqual([]);
  });

  it('never uploads a deleted list instead of deleting it', async () => {
    await sync.pullAll();
    store.deleteList('es-food');
    await sync.pushDirty();
    expect(github.calls.filter(([verb]) => verb === 'put')).toEqual([]);
  });

  it('does not let a pull resurrect a list whose delete has not been pushed yet', async () => {
    await sync.pullAll();
    store.deleteList('es-food');
    await sync.pullAll();
    expect(store.getList('es-food')).toBeNull();
    expect(store.listIds()).toEqual([]);
    expect(store.deletedIds()).toEqual(['es-food']);
  });

  it('deletes a list that was never pushed without needing a base sha', async () => {
    const list = store.createList({ name: 'Scratch' });
    store.deleteList(list.id);
    await sync.pushDirty();
    expect(store.deletedIds()).toEqual([]);
    expect(store.dirtyKeys()).toEqual([]);
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run test/sync-delete.test.js`
Expected: FAIL. The first test fails because `pushOne` currently sees a missing payload and just marks the key clean; the third fails because `pullAll` re-creates the list from the remote file.

- [ ] **Step 7: Implement the sync half in `app/sync.js`**

Add, above `pushOne`:

```javascript
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
```

Replace the missing-payload branch of `pushOne`:

```javascript
    const [kind, id] = key.split(':');
    if (store.deletedIds().includes(id)) return deleteRemote(key);
    const path = kind === 'list' ? listPath(id) : progressPath(id);
    const payload = kind === 'list' ? store.getList(id) : store.getProgress(id);
    if (!payload) { store.markClean(key); return; }
```

(The `[kind, id]` destructuring already exists at the top of `pushOne`; move it above the new line rather than declaring it twice.)

At the end of `pushDirty`, after the loop, drop tombstones whose two keys are both clean:

```javascript
    for (const id of store.deletedIds()) {
      const outstanding = store.dirtyKeys().some((key) => key.endsWith(`:${id}`));
      if (!outstanding) store.clearDeleted(id);
    }
```

Teach the `ConflictError` handler that a tombstoned key must never be pulled — pulling is precisely what would resurrect it:

```javascript
        if (error instanceof ConflictError) {
          const [kind, id] = key.split(':');
          if (store.deletedIds().includes(id)) {
            store.setBase(key, null);   // forces deleteRemote to re-read the live sha
            await pushOne(key);
          } else if (kind === 'progress') { await pullProgress(id); await pushOne(key); }
          else { await pullList(id); await pushOne(key); }
        } else {
```

And make `pullAll` tombstone-aware:

```javascript
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
```

- [ ] **Step 8: Run the tests**

Run: `npm test`
Expected: PASS, all four new sync tests included.

- [ ] **Step 9: Verify against the real repository**

With a token configured: create a list called `Delete me`, add a card, wait for the green dot, and confirm `data/lists/*.json` for it exists on the `data` branch on GitHub. Delete the list in the app. Within a few seconds the dot returns to green; confirm on GitHub that **both** the list and the progress file are gone, and that the commit message reads `delete list <id>`. Then reload the app and confirm the list does not come back.

- [ ] **Step 10: Commit**

```bash
git add app/github.js app/sync.js test/github.test.js test/sync-delete.test.js
git commit -m "feat: propagate list deletion to GitHub, tombstoned against resurrection"
```

---

### Task 6: Most-recently-used ordering on Home

**Files:**
- Modify: `app/store.js`, `app/main.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `recency({ list, progress }) -> string`, a **module-level pure export** of `store.js` (not a method on the store instance), returning an ISO timestamp or `''`.

No new field is stored. Recency is the later of the list's `updatedAt` and the newest `lastSeen` among its progress items — both already exist and already sync, and ISO-8601 UTC strings sort correctly as plain strings.

- [ ] **Step 1: Write the failing tests**

Append to `test/store.test.js` (and add `recency` to the import at the top of the file):

```javascript
describe('recency', () => {
  const list = { id: 'x', name: 'X', updatedAt: '2026-09-01T09:00:00Z', cards: [] };

  it('is the list timestamp when nothing has been studied', () => {
    expect(recency({ list, progress: { items: {} } })).toBe('2026-09-01T09:00:00Z');
  });

  it('is the newest lastSeen when studying is more recent than editing', () => {
    const progress = { items: {
      'a:f2b': { lastSeen: '2026-09-02T08:00:00Z' },
      'a:b2f': { lastSeen: '2026-09-03T07:00:00Z' },
    } };
    expect(recency({ list, progress })).toBe('2026-09-03T07:00:00Z');
  });

  it('is the list timestamp when editing is more recent than studying', () => {
    const edited = { ...list, updatedAt: '2026-09-05T00:00:00Z' };
    const progress = { items: { 'a:f2b': { lastSeen: '2026-09-02T08:00:00Z' } } };
    expect(recency({ list: edited, progress })).toBe('2026-09-05T00:00:00Z');
  });

  it('tolerates a never-seen item and a missing progress file', () => {
    const progress = { items: { 'a:f2b': { lastSeen: null } } };
    expect(recency({ list, progress })).toBe('2026-09-01T09:00:00Z');
    expect(recency({ list, progress: undefined })).toBe('2026-09-01T09:00:00Z');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/store.test.js`
Expected: FAIL — `recency is not a function`.

- [ ] **Step 3: Implement it in `app/store.js`**

At module level, beside `slugify`, and exported:

```javascript
export function recency({ list, progress }) {
  let latest = (list && list.updatedAt) || '';
  for (const item of Object.values((progress && progress.items) || {})) {
    if (item.lastSeen && item.lastSeen > latest) latest = item.lastSeen;
  }
  return latest;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Sort Home by it**

In `app/main.js`, change the import:

```javascript
import { createStore, recency } from './store.js';
```

and in `showHome`, replace `const ids = store.listIds();` with:

```javascript
  const ids = store.listIds().slice().sort((a, b) => {
    const at = recency({ list: store.getList(a), progress: store.getProgress(a) });
    const bt = recency({ list: store.getList(b), progress: store.getProgress(b) });
    return bt.localeCompare(at);   // newest first
  });
```

- [ ] **Step 6: Watch it reorder**

With two or more lists: study one, go Home, and confirm it has moved to the top. Edit a card in another, go Home, and confirm that one is now top. Reload and confirm the order survives — it is derived, not remembered, so it must.

- [ ] **Step 7: Commit**

```bash
git add app/store.js app/main.js test/store.test.js
git commit -m "feat: order lists by most recently used"
```

- [ ] **Step 8: STOP — this is a stage boundary**

`npm test` passes and the app runs. Clear context before Stage G.

---

# STAGE G — Studying (Tasks 7–9)

### Task 7: Sessions default to everything due

**Files:**
- Modify: `app/main.js`

**Interfaces:**
- Consumes: `buildQueue`, `parseKey` from `srs.js` (unchanged).
- Produces: `queueFor(listId, choice) -> string[]`, used by both the setup screen's live count and `startSession`, so the number shown and the number studied can never disagree.

This retires a ruling from the first plan, deliberately: Task 7 there clamped the session limit to 5–100 and defaulted to 20. The default is now *everything due*, and the clamp applies only when the cap is switched on, where it runs 5–500.

- [ ] **Step 1: Replace the `setup` object and add `queueFor`**

In `app/main.js`, replace the `setup` line:

```javascript
const setup = { mode: 'write', directions: ['f2b', 'b2f'], capped: false, limit: 50, free: false };

function queueFor(listId, choice) {
  return buildQueue({
    list: store.getList(listId),
    progress: choice.free ? { items: {} } : store.getProgress(listId),
    directions: choice.directions,
    today: todayStr(),
    limit: choice.capped ? choice.limit : Infinity,
    includeNew: true,
  });
}
```

- [ ] **Step 2: Rewrite `showSetup`**

```javascript
function showSetup(listId) {
  const list = store.getList(listId);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: `Study: ${list.name}` }));

  const headline = el('p', { class: 'headline' });
  const detail = el('p', { class: 'muted' });
  view.append(headline, detail);

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
    radio('dir', 'f2b', 'Front → back', setup.directions.join() === 'f2b'),
    radio('dir', 'b2f', 'Back → front', setup.directions.join() === 'b2f'),
  ]);

  const cap = el('input', { type: 'checkbox', ...(setup.capped ? { checked: 'checked' } : {}) });
  const limit = el('input', { type: 'number', min: '5', max: '500', step: '5',
                              value: String(setup.limit), class: 'num' });
  const free = el('input', { type: 'checkbox', ...(setup.free ? { checked: 'checked' } : {}) });

  view.append(el('h3', { text: 'Mode' }), modes,
              el('h3', { text: 'Direction' }), dirs,
              el('h3', { text: 'Length' }),
              el('div', { class: 'opts' }, [
                el('label', { class: 'opt' }, [cap, 'Stop after', limit, 'questions']),
                el('label', { class: 'opt' }, [free, 'Free review — everything, scheduling untouched']),
              ]));

  const read = () => {
    const dir = dirs.querySelector('input:checked').value;
    return {
      mode: modes.querySelector('input:checked').value,
      directions: dir === 'both' ? ['f2b', 'b2f'] : [dir],
      capped: cap.checked,
      limit: Math.min(500, Math.max(5, Number(limit.value) || 50)),
      free: free.checked,
    };
  };

  const start = el('button', { class: 'primary' });

  const refresh = () => {
    const choice = read();
    limit.disabled = !choice.capped;
    const queue = queueFor(listId, choice);
    const cards = new Set(queue.map((key) => parseKey(key).cardId)).size;
    if (queue.length === 0) {
      headline.textContent = 'Nothing due right now';
      detail.textContent = 'Come back tomorrow, add cards, or tick free review to go through everything anyway.';
      start.textContent = 'Start';
      start.disabled = true;
      return;
    }
    headline.textContent = `${queue.length} question${queue.length === 1 ? '' : 's'} ready`;
    detail.textContent = `${cards} card${cards === 1 ? '' : 's'}`
      + (choice.directions.length === 2 ? ', both directions.' : '.');
    start.textContent = `Start all ${queue.length}`;
    start.disabled = false;
  };

  start.onclick = () => { Object.assign(setup, read()); startSession(listId); };
  view.append(start);
  view.addEventListener('change', refresh);
  view.addEventListener('input', refresh);
  refresh();
}
```

`headline`/`detail` are what make the cards-versus-questions arithmetic visible: Home counts *cards* and a both-directions session asks *two questions per card*, so "12 due" on Home is "24 questions ready, 12 cards, both directions" here. Both numbers were always right; only one of them was ever shown.

- [ ] **Step 3: Make `startSession` use the same function**

```javascript
function startSession(listId) {
  const queue = queueFor(listId, setup);
  if (queue.length === 0) return;
  session = { listId, queue, at: 0, right: 0, wrong: 0, free: setup.free };
  go(`#/session/${listId}`);
}
```

The `alert()` is gone: the Start button is disabled when there is nothing to do, and the headline already says so in words.

- [ ] **Step 4: Style the two new pieces**

Append to `app/style.css`:

```css
.headline { font-weight: 600; margin: 0; }
.num { width: 5rem; flex: none; }
button:disabled { opacity: .45; }
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS. Nothing here is new logic in a pure module, so no test changes — but `buildQueue` is already covered for `limit: Infinity` by the Home badge's tests, and that is the path this now takes by default.

- [ ] **Step 6: Check the arithmetic by hand**

Take a list with a known number of due cards. On Home note the badge, say 12. Open Study: the headline must read 24 questions / 12 cards with "Both directions" selected, and 12 questions / 12 cards with a single direction. Tick "Stop after", set 10, and confirm the headline and the button both say 10. Untick it and confirm the full number returns. Start a capped session and confirm it really ends after that many.

- [ ] **Step 7: Commit**

```bash
git add app/main.js app/style.css
git commit -m "feat: study everything due by default, with an opt-in cap"
```

---

### Task 8: A session result worth reading

**Files:**
- Modify: `app/grade.js`, `app/main.js`, `app/style.css`
- Test: `test/grade.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `sessionVerdict(right, total) -> { percent, verdict }` exported from `grade.js`.

- [ ] **Step 1: Write the failing tests**

Append to `test/grade.test.js` (add `sessionVerdict` to the import):

```javascript
describe('sessionVerdict', () => {
  it('celebrates only a genuinely perfect session', () => {
    expect(sessionVerdict(24, 24)).toEqual({ percent: 100, verdict: 'Perfect. Every one.' });
  });

  it('never rounds an imperfect session up to 100%', () => {
    expect(sessionVerdict(199, 200).percent).toBe(99);
  });

  it('grades the four imperfect tiers by their boundaries', () => {
    expect(sessionVerdict(9, 10).verdict).toBe('Strong session.');
    expect(sessionVerdict(3, 4).verdict).toBe('Solid — the misses come back soon.');
    expect(sessionVerdict(1, 2).verdict).toBe('Getting there. These need another pass.');
    expect(sessionVerdict(1, 3).verdict).toBe('Tough round. That’s what the boxes are for.');
  });

  it('reports the percentage it is grading', () => {
    expect(sessionVerdict(3, 4).percent).toBe(75);
    expect(sessionVerdict(0, 5).percent).toBe(0);
  });

  it('does not divide by zero', () => {
    expect(sessionVerdict(0, 0)).toEqual({ percent: 0, verdict: 'Nothing to score.' });
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/grade.test.js`
Expected: FAIL — `sessionVerdict is not a function`.

- [ ] **Step 3: Implement it in `app/grade.js`**

```javascript
export function sessionVerdict(right, total) {
  if (total === 0) return { percent: 0, verdict: 'Nothing to score.' };
  if (right === total) return { percent: 100, verdict: 'Perfect. Every one.' };
  const ratio = right / total;
  const verdict = ratio >= 0.9 ? 'Strong session.'
    : ratio >= 0.75 ? 'Solid — the misses come back soon.'
    : ratio >= 0.5 ? 'Getting there. These need another pass.'
    : 'Tough round. That’s what the boxes are for.';
  // 199/200 rounds to 100, which would be a lie next to "Perfect".
  return { percent: Math.min(Math.round(ratio * 100), 99), verdict };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Render the result screen**

In `app/main.js`, extend the import:

```javascript
import { grade, sessionVerdict } from './grade.js';
```

and replace the `session.at >= session.queue.length` branch of `showSession`:

```javascript
  if (session.at >= session.queue.length) {
    const { right, wrong, free } = session;
    const { percent, verdict } = sessionVerdict(right, right + wrong);
    view.append(el('h2', { text: list.name }));
    view.append(el('p', { class: 'score' }, [String(percent), el('span', { text: '%' })]));
    view.append(el('p', { class: 'tierline', text: verdict }));
    view.append(el('p', { class: 'muted tally',
      text: `${right} right · ${wrong} wrong · ${right + wrong} questions` }));
    view.append(el('div', { class: 'bars' }, [
      el('div', { class: 'bar-right', style: `flex:${right}` }),
      el('div', { class: 'bar-wrong', style: `flex:${wrong}` }),
    ]));
    if (free) view.append(el('p', { class: 'muted', text: 'Free review — nothing was rescheduled.' }));
    view.append(el('div', { class: 'row' }, [
      el('a', { class: 'btn', href: `#/study/${listId}`, text: 'Study more' }),
      el('a', { class: 'btn', href: '#/', text: 'Back to lists' }),
    ]));
    session = null;
    return;
  }
```

- [ ] **Step 6: Style it**

Append to `app/style.css`:

```css
.score { text-align: center; font-size: 4rem; font-weight: 700; line-height: 1;
         letter-spacing: -.03em; margin: 1.5rem 0 .2rem; }
.score span { font-size: 2rem; }
.tierline { text-align: center; font-size: 1.15rem; font-weight: 600; margin: 0; }
.tally { text-align: center; }
.bars { display: flex; height: 10px; border-radius: 999px; overflow: hidden; margin-bottom: 1.5rem; }
.bar-right { background: var(--ok); }
.bar-wrong { background: var(--bad); }
```

The two bar halves are classes rather than inline colours on purpose — `style="flex:…"` carries a number, never a colour, which keeps Task 1's test green.

- [ ] **Step 7: Finish a session and look at it**

Run a short capped session (say 5 questions), get some wrong on purpose, and check the percentage, the tier sentence, the tally and the bar all agree. Then run one with everything correct and confirm it says "Perfect. Every one." Then a free review, and confirm the extra line appears.

- [ ] **Step 8: Commit**

```bash
git add app/grade.js app/main.js app/style.css test/grade.test.js
git commit -m "feat: end a session on a score and a verdict"
```

---

### Task 9: Swipe a flashcard

**Files:**
- Modify: `app/main.js`, `app/style.css`

**Interfaces:**
- Consumes: `answer(correct)` (unchanged).
- Produces: `swipeable(node, { onLeft, onRight })`, used only by the flashcard branch.

Swipe is live **only after the reveal**. Grading a card whose back you have not seen is always a mistake, so before the reveal a drag and a tap both simply reveal. The buttons stay: they are the desktop path and the accessible one.

- [ ] **Step 1: Add the gesture helper to `app/main.js`**

```javascript
function swipeable(node, { onLeft, onRight }) {
  let startX = null;
  const threshold = () => Math.max(60, node.getBoundingClientRect().width * 0.25);

  node.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    node.setPointerCapture(event.pointerId);
    node.style.transition = 'none';
  });

  node.addEventListener('pointermove', (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    node.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
    node.classList.toggle('to-right', dx > threshold());
    node.classList.toggle('to-left', dx < -threshold());
  });

  node.addEventListener('pointerup', (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    startX = null;
    node.style.transition = 'transform .18s ease-out';
    if (dx > threshold()) { node.style.transform = 'translateX(120%)'; onRight(); }
    else if (dx < -threshold()) { node.style.transform = 'translateX(-120%)'; onLeft(); }
    else { node.style.transform = ''; node.classList.remove('to-right', 'to-left'); }
  });

  node.addEventListener('pointercancel', () => {
    startX = null;
    node.style.transition = 'transform .18s ease-out';
    node.style.transform = '';
    node.classList.remove('to-right', 'to-left');
  });

  return node;
}
```

- [ ] **Step 2: Rebuild the flashcard branch of `showSession`**

Replace the whole `if (setup.mode === 'cards') { … }` block:

```javascript
  if (setup.mode === 'cards') {
    const box = el('div', { class: 'flip' }, [el('p', { class: 'prompt', text: prompt })]);
    const reveal = el('button', { class: 'primary', text: 'Show answer' });
    reveal.onclick = () => {
      reveal.remove();
      box.append(
        el('p', { class: 'answer', text: expected }),
        el('p', { class: 'muted hint', text: 'Swipe right if you knew it, left if you didn’t.' }),
        el('div', { class: 'row' }, [
          el('button', { text: 'Didn’t know', onclick: () => answer(false) }),
          el('button', { class: 'primary', text: 'Knew it', onclick: () => answer(true) }),
        ]),
      );
      swipeable(box, { onLeft: () => answer(false), onRight: () => answer(true) });
    };
    box.append(reveal);
    view.append(box);
    return;
  }
```

Note the prompt now lives *inside* `box`, so the whole card moves with the finger rather than just the answer. The earlier `view.append(el('p', { class: 'prompt', … }))` above this block must therefore be moved *below* it, or made conditional — in write mode the prompt still stands on its own:

```javascript
  view.append(el('p', { class: 'muted', text: `${session.at + 1} / ${session.queue.length}` }));
  if (setup.mode !== 'cards') view.append(el('p', { class: 'prompt', text: prompt }));
```

- [ ] **Step 3: Style the card**

Append to `app/style.css`:

```css
.flip { touch-action: pan-y; user-select: none; border: 1px solid var(--rule);
        border-radius: 12px; background: var(--surface); padding: .5rem 1rem 1rem;
        will-change: transform; }
.flip.to-right { border-color: var(--ok); }
.flip.to-left { border-color: var(--bad); }
.hint { text-align: center; font-size: .85rem; }
```

`touch-action: pan-y` is load-bearing: without it the browser claims the horizontal gesture for scrolling and the card never moves on a phone.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, unchanged. This is DOM behaviour and the project verifies screens by use.

- [ ] **Step 5: Use it, on both kinds of device**

On the laptop, with a mouse: reveal a card, drag it right past a quarter of its width, release — it should count as correct and advance. Drag a little and release: it springs back. Confirm the two buttons still work and that dragging *before* the reveal does nothing.

Then on the phone (this is the case the feature exists for): confirm the card follows your thumb, that the page does not scroll sideways while it does, and that a vertical scroll still works normally.

- [ ] **Step 6: Commit**

```bash
git add app/main.js app/style.css
git commit -m "feat: swipe a revealed flashcard to grade it"
```

- [ ] **Step 7: STOP — this is a stage boundary**

`npm test` passes and the app runs. Clear context before Stage H.

---

# STAGE H — Sync and auth (Tasks 10–13)

### Task 10: List conflict resolution

**Files:**
- Modify: `app/main.js`, `app/style.css`

**Interfaces:**
- Consumes: `onConflict({ listId, local, remote, resolve })`, already emitted by `sync.js`.
- Produces: `showConflict(conflict)`, replacing the console-logging stub that has stood since Stage C.

This supersedes Task 11 of the first plan. Reached only when the same list was edited on two devices since the last sync. The spec forbids merging card-by-card here: guessing would quietly lose work, so the app shows both and asks.

- [ ] **Step 1: Replace the stub in `app/main.js`**

```javascript
function showConflict({ listId, local, remote, resolve }) {
  const view = screen();
  view.append(el('h2', { text: 'Two versions of this list' }));
  view.append(el('p', {}, [
    `“${local.name}” was edited on this device and somewhere else since the last sync. `,
    'Pick the one to keep — the other is discarded.',
  ]));

  const side = (label, list, other, choice) => {
    const only = list.cards.filter((card) => !other.cards.some((o) => o.id === card.id));
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
    side('This device', local, remote, 'local'),
    side('GitHub', remote, local, 'remote'),
  ]));
}
```

Showing which cards exist on only one side is what makes the choice answerable — two dates alone do not tell you what you would be throwing away.

- [ ] **Step 2: Add the styles**

Append to `app/style.css`:

```css
.sides { display: flex; gap: 1rem; flex-wrap: wrap; }
.side { flex: 1 1 14rem; border: 1px solid var(--rule); border-radius: 10px;
        padding: .75rem; background: var(--surface); }
```

- [ ] **Step 3: Provoke a real conflict**

1. On the laptop, add card `AAA` to a list; wait for the green dot.
2. Open the app in a private window (a separate working copy). Let it sync.
3. Turn the network off in *both*. Add `BBB` in one, `CCC` in the other.
4. Reconnect the first and let it push. Reconnect the second.
5. Expect this screen, naming `BBB` on one side and `CCC` on the other.
6. Choose one; confirm the app and GitHub both end up with that version and the dot returns to green.

- [ ] **Step 4: Commit**

```bash
git add app/main.js app/style.css
git commit -m "feat: ask which version wins when a list conflicts"
```

---

### Task 11: `qr.js` — the QR encoder

**Files:**
- Create: `app/qr.js`, `test/qr.test.js`, `test/fixtures/make-qr-fixtures.sh`, `test/fixtures/qr-*.txt`
- Modify: `sw.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `encode(text) -> boolean[][]`, a square matrix of modules, `true` meaning dark, with **no quiet zone** (the caller adds it). Byte mode, error-correction level L, versions 1–13 chosen automatically. Throws if the payload exceeds version 13.

This module exists for exactly one reason: the payload is a token, no third party may ever see it, and it is dynamic — so neither a committed PNG nor an image service can serve. It is the largest new file in this pass and it is pure, which puts it in the tested tier. The tests are ground truth generated by `qrencode` on the implementer's own machine, not values transcribed from anywhere.

**Level L and versions 1–13 are the whole supported range.** The real payload — `https://cyrilpitrou.github.io/myquizzlet/#/adopt?t=<93-char token>&e=<date>` — is roughly 150 bytes and needs version 8. Thirteen leaves headroom without pulling in the larger alignment-pattern tables.

- [ ] **Step 1: Generate the fixtures**

Create `test/fixtures/make-qr-fixtures.sh`:

```bash
#!/bin/sh
# Regenerates the QR fixtures. Requires qrencode (brew install qrencode).
# Each fixture's first line is the payload; the rest is the module grid,
# '#' for dark, ' ' for light, no quiet zone.
set -e
cd "$(dirname "$0")"

payload() {
  printf 'payload=%s\n' "$2" > "qr-$1.txt"
  qrencode -8 -l L -m 0 -t ASCII -o - "$2" >> "qr-$1.txt"
}

payload 1 "HI"
payload 2 "https://cyrilpitrou.github.io/myquizzlet"
payload 3 "The quick brown fox jumps over the lazy dog, and then does it again."
payload 4 "https://cyrilpitrou.github.io/myquizzlet/#/adopt?t=github_pat_11ABCDEFG0abcdefghijKLMNOPqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWX&e=2027-03-01"
```

Run it:

```bash
chmod +x test/fixtures/make-qr-fixtures.sh
test/fixtures/make-qr-fixtures.sh
head -3 test/fixtures/qr-1.txt
```

Expected: `qr-1.txt` starts with `payload=HI` and then a 21-line grid. Fixture 4 is the real shape of an adopt link and should produce a 49×49 grid (version 8). If `qrencode` is not installed and cannot be, stop and say so rather than inventing fixtures — the whole value of this test is that its truth comes from somewhere else.

- [ ] **Step 2: Write the failing test**

Create `test/qr.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { encode } from '../app/qr.js';

const dir = new URL('./fixtures/', import.meta.url);

function loadFixture(name) {
  const text = readFileSync(new URL(name, dir), 'utf8').replace(/\n$/, '');
  const [head, ...lines] = text.split('\n');
  const payload = head.replace(/^payload=/, '');
  // qrencode's ASCII output prints two characters per module.
  const width = lines[0].length / 2 === lines.length ? 2 : 1;
  const grid = lines.map((line) => {
    const row = [];
    for (let i = 0; i < line.length; i += width) row.push(line[i] !== ' ');
    return row;
  });
  return { payload, grid };
}

const fixtures = readdirSync(dir).filter((name) => /^qr-\d+\.txt$/.test(name)).sort();

describe('encode', () => {
  it('has fixtures to check against', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it('produces a square matrix of the right size for a short payload', () => {
    const matrix = encode('HI');
    expect(matrix).toHaveLength(21);
    for (const row of matrix) expect(row).toHaveLength(21);
  });

  it('draws the three finder patterns', () => {
    const m = encode('HI');
    const corners = [[0, 0], [0, 14], [14, 0]];
    for (const [r, c] of corners) {
      expect(m[r][c]).toBe(true);          // outer ring
      expect(m[r + 1][c + 1]).toBe(false); // the light ring inside it
      expect(m[r + 3][c + 3]).toBe(true);  // the 3x3 core
    }
  });

  it('draws the timing patterns', () => {
    const m = encode('HI');
    for (let i = 8; i < 13; i++) {
      expect(m[6][i]).toBe(i % 2 === 0);
      expect(m[i][6]).toBe(i % 2 === 0);
    }
  });

  it('refuses a payload that will not fit in a version-13 symbol', () => {
    expect(() => encode('x'.repeat(500))).toThrow(/too long/);
  });

  for (const name of fixtures) {
    it(`matches qrencode for ${name}`, () => {
      const { payload, grid } = loadFixture(name);
      expect(encode(payload)).toEqual(grid);
    });
  }
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run test/qr.test.js`
Expected: FAIL — cannot resolve `../app/qr.js`.

- [ ] **Step 4: Write the arithmetic half of `app/qr.js`**

```javascript
// A QR encoder: byte mode, error correction level L, versions 1–13.
// Pure — no DOM, no I/O, no clock. It exists because the one payload that
// needs encoding is a token, which may never be shown to a third-party
// generator, and which is different every time.

// GF(256) with the QR primitive polynomial 0x11d.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// version: [error-correction codewords per block, [[block count, data codewords per block], …]]
const BLOCKS = {
  1: [7, [[1, 19]]],
  2: [10, [[1, 34]]],
  3: [15, [[1, 55]]],
  4: [20, [[1, 80]]],
  5: [26, [[1, 108]]],
  6: [18, [[2, 68]]],
  7: [20, [[2, 78]]],
  8: [24, [[2, 97]]],
  9: [30, [[2, 116]]],
  10: [18, [[2, 68], [2, 69]]],
  11: [20, [[4, 81]]],
  12: [24, [[2, 92], [2, 93]]],
  13: [26, [[4, 107]]],
};

const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38],
  8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50], 11: [6, 30, 54], 12: [6, 32, 58],
  13: [6, 34, 62],
};

const dataCapacity = (version) =>
  BLOCKS[version][1].reduce((sum, [count, size]) => sum + count * size, 0);

function chooseVersion(byteLength) {
  for (let version = 1; version <= 13; version++) {
    const header = 4 + (version < 10 ? 8 : 16);
    if (header + byteLength * 8 <= dataCapacity(version) * 8) return version;
  }
  throw new Error(`payload too long for a version-13 symbol: ${byteLength} bytes`);
}

function toCodewords(bytes, version) {
  const total = dataCapacity(version);
  const bits = [];
  const push = (value, width) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);                              // byte mode
  push(bytes.length, version < 10 ? 8 : 16);    // character count
  for (const byte of bytes) push(byte, 8);
  for (let i = 0; i < 4 && bits.length < total * 8; i++) bits.push(0);  // terminator
  while (bits.length % 8 !== 0) bits.push(0);

  const words = [];
  for (let i = 0; i < bits.length; i += 8) {
    words.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  const PAD = [0xec, 0x11];
  for (let i = 0; words.length < total; i++) words.push(PAD[i % 2]);
  return words;
}

// The generator polynomial of degree n, coefficients highest power first.
function generator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function remainder(data, degree) {
  const gen = generator(degree);
  const buffer = data.concat(new Array(degree).fill(0));
  for (let i = 0; i < data.length; i++) {
    const factor = buffer[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) buffer[i + j] ^= mul(gen[j], factor);
  }
  return buffer.slice(data.length);
}

function interleave(bytes, version) {
  const [ecPerBlock, groups] = BLOCKS[version];
  const words = toCodewords(bytes, version);
  const blocks = [];
  let at = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      blocks.push(words.slice(at, at + size));
      at += size;
    }
  }
  const ec = blocks.map((block) => remainder(block, ecPerBlock));

  const out = [];
  const longest = Math.max(...blocks.map((block) => block.length));
  for (let i = 0; i < longest; i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) for (const block of ec) out.push(block[i]);
  return out;
}
```

- [ ] **Step 5: Write the drawing half of `app/qr.js`**

Append:

```javascript
const bitOf = (value, index) => ((value >>> index) & 1) !== 0;

// BCH(15,5), level L (01), masked with 0x5412.
function formatBits(mask) {
  const data = (0b01 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

// BCH(18,6), versions 7 and up only.
function versionInfo(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

function frame(version) {
  const size = version * 4 + 17;
  const grid = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (row, col, dark) => {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    grid[row][col] = dark;
    fixed[row][col] = true;
  };

  const finder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const ring = (r === 0 || r === 6) && c >= 0 && c <= 6;
        const side = (c === 0 || c === 6) && r >= 0 && r <= 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(row + r, col + c, ring || side || core);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  for (const r of ALIGN[version]) {
    for (const c of ALIGN[version]) {
      const nearFinder = (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // Reserve the two format-information areas; the values arrive with the mask.
  for (let i = 0; i < 9; i++) {
    if (!fixed[8][i]) set(8, i, false);
    if (!fixed[i][8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!fixed[8][size - 1 - i]) set(8, size - 1 - i, false);
    if (!fixed[size - 1 - i][8]) set(size - 1 - i, 8, false);
  }
  set(size - 8, 8, true);   // the module that is always dark

  if (version >= 7) {
    const bits = versionInfo(version);
    for (let i = 0; i < 18; i++) {
      const dark = bitOf(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(b, a, dark);
      set(a, b, dark);
    }
  }

  return { grid, fixed, size };
}

function placeData(state, codewords) {
  const { grid, fixed, size } = state;
  let at = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;                       // the vertical timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (fixed[row][col] || at >= codewords.length * 8) continue;
        grid[row][col] = bitOf(codewords[at >>> 3], 7 - (at & 7));
        at++;
      }
    }
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(state, mask) {
  const { grid, fixed, size } = state;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!fixed[r][c] && MASKS[mask](r, c)) grid[r][c] = !grid[r][c];
    }
  }
}

function drawFormat(state, mask) {
  const { size } = state;
  const bits = formatBits(mask);
  const set = (row, col, dark) => { state.grid[row][col] = dark; state.fixed[row][col] = true; };
  for (let i = 0; i <= 5; i++) set(i, 8, bitOf(bits, i));
  set(7, 8, bitOf(bits, 6));
  set(8, 8, bitOf(bits, 7));
  set(8, 7, bitOf(bits, 8));
  for (let i = 9; i < 15; i++) set(8, 14 - i, bitOf(bits, i));
  for (let i = 0; i < 8; i++) set(8, size - 1 - i, bitOf(bits, i));
  for (let i = 8; i < 15; i++) set(size - 15 + i, 8, bitOf(bits, i));
  set(size - 8, 8, true);
}

const FINDER_LIKE = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
];

function penalty(grid) {
  const size = grid.length;
  let score = 0;

  const line = (get) => {
    let run = 1;
    for (let i = 1; i < size; i++) {
      if (get(i) === get(i - 1)) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
    for (let i = 0; i + 11 <= size; i++) {
      for (const pattern of FINDER_LIKE) {
        if (pattern.every((want, k) => get(i + k) === want)) score += 40;
      }
    }
  };

  for (let r = 0; r < size; r++) line((i) => grid[r][i]);
  for (let c = 0; c < size; c++) line((i) => grid[i][c]);

  for (let r = 0; r + 1 < size; r++) {
    for (let c = 0; c + 1 < size; c++) {
      const first = grid[r][c];
      if (grid[r][c + 1] === first && grid[r + 1][c] === first && grid[r + 1][c + 1] === first) {
        score += 3;
      }
    }
  }

  const dark = grid.flat().filter(Boolean).length;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

export function encode(text) {
  const bytes = [...new TextEncoder().encode(text)];
  const version = chooseVersion(bytes.length);
  const codewords = interleave(bytes, version);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const state = frame(version);
    placeData(state, codewords);
    applyMask(state, mask);
    drawFormat(state, mask);
    const score = penalty(state.grid);
    if (best === null || score < best.score) best = { score, grid: state.grid };
  }
  return best.grid;
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/qr.test.js`
Expected: PASS, all four fixtures included.

If the structural tests pass but a fixture differs, compare sizes first: a different **size** means the version choice or the capacity table is wrong. A same-size grid that differs **everywhere** almost always means a different mask was chosen, which points at `penalty` — the two usual culprits are the 11-module finder-like patterns (both orientations are needed, and they must be checked in rows *and* columns) and run scoring (a run of 5 scores 3, and each module beyond that adds 1). Debug it by scoring all eight masks and printing the table; do **not** "fix" it by forcing a mask number to match, which would leave the scoring wrong for every other payload. If your `qrencode` supports `--mask=N`, generating one fixture per mask is the quickest way to separate mask *application* (which is simple) from mask *selection* (which is where the bug will be).

- [ ] **Step 7: Add `qr.js` to the offline shell**

In `sw.js`, add `'./app/qr.js'` to `SHELL` and bump the cache:

```javascript
const CACHE = 'myquizzlet-v3';
```

`cache.addAll` is atomic. A missing entry means the service worker installs nothing at all, silently, and the failure only shows up as "the app does not work offline" days later.

- [ ] **Step 8: Commit**

```bash
git add app/qr.js test/qr.test.js test/fixtures sw.js
git commit -m "feat: a QR encoder, so a token never has to leave the device to be drawn"
```

---

### Task 12: Adopting a token

**Files:**
- Modify: `app/main.js`, `app/style.css`

**Interfaces:**
- Consumes: `encode(text)` from `app/qr.js` (Task 11); `section(title, nodes)` from Task 2.
- Produces: the `#/adopt` route, `qrCanvas(text)`, and `tokenFrom(value)` — which lets the token field accept a pasted setup link as well as a bare token.

The giving device shows a QR of `…/#/adopt?t=…&e=…`. The receiving device scans it **with its own camera app**, which opens the link; the app has no decoder and asks for no camera permission. What is new here is the screen that link lands on.

- [ ] **Step 1: Route on the query string, not just the path**

In `app/main.js`, add the import and replace `render`:

```javascript
import { encode as qrEncode } from './qr.js';
```

```javascript
function parseHash() {
  const [path, query] = location.hash.replace(/^#/, '').split('?');
  const [, route, arg] = path.split('/');
  return { route, arg, params: new URLSearchParams(query || '') };
}

function render() {
  const { route, arg, params } = parseHash();
  if (route === 'adopt') {
    const offer = { token: (params.get('t') || '').trim(), expiry: params.get('e') || '' };
    // Strip the token out of the address bar and the history before anything
    // else happens. replaceState does not fire hashchange, so this is safe here.
    if (params.get('t')) history.replaceState(null, '', '#/adopt');
    return showAdopt(offer);
  }
  if (route === 'list' && arg) showList(arg);
  else if (route === 'study' && arg) showSetup(arg);
  else if (route === 'session' && arg) showSession(arg);
  else if (route === 'settings') showSettings();
  else showHome();
}
```

`showAdopt` keeps the offer in a module-level variable so that the `replaceState` above does not leave a reload showing a blank screen with no explanation:

```javascript
let offered = null;

function showAdopt(offer) {
  if (offer.token) offered = offer;
  const view = screen();
  view.append(el('h2', { text: 'Use this token on this device?' }));

  if (!offered) {
    view.append(el('p', { text: 'That setup link has already been used or has expired from this page.' }));
    view.append(el('a', { class: 'btn', href: '#/settings', text: 'Settings' }));
    return;
  }

  const masked = `${offered.token.slice(0, 12)}…${offered.token.slice(-4)}`;
  view.append(el('dl', { class: 'kv' }, [
    el('dt', { text: 'Repository' }), el('dd', { text: REPO }),
    el('dt', { text: 'Token' }), el('dd', { text: masked }),
    el('dt', { text: 'Expires' }), el('dd', { text: offered.expiry || 'not stated' }),
  ]));
  view.append(el('p', { class: 'muted', text:
    'Saving it lets this device write changes back to GitHub. It is the same token your '
    + 'other device uses, so revoking it stops both.' }));
  view.append(el('button', {
    class: 'primary', text: 'Save token on this device',
    onclick: () => {
      saveSettings({ ...settings(), token: offered.token, tokenExpiry: offered.expiry || null });
      offered = null;
      initSync();
      go('#/');
    },
  }));
  view.append(el('button', {
    class: 'ghost', text: 'No thanks — study only',
    onclick: () => { offered = null; go('#/'); },
  }));
}
```

- [ ] **Step 2: Draw a QR into the page**

```javascript
function qrCanvas(text, scale = 6, quiet = 4) {
  const modules = qrEncode(text);
  const size = modules.length;
  const canvas = el('canvas');
  canvas.width = (size + quiet * 2) * scale;
  canvas.height = canvas.width;
  const ctx = canvas.getContext('2d');
  // A QR code is never themed: a scanner wants maximum contrast, and these two
  // values are the image, not the interface.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }
  }
  canvas.className = 'qr-canvas';
  return canvas;
}
```

- [ ] **Step 3: Add the "Add a device" section to Settings**

In `showSettings`, between the `GitHub token` section and `About`, but only when this device has a token to give:

```javascript
  if (current.token) {
    const holder = el('div');
    const show = el('button', {
      class: 'ghost', text: 'Show token QR',
      onclick: () => {
        const base = location.href.split('#')[0];
        const link = `${base}#/adopt?t=${encodeURIComponent(current.token)}`
          + `&e=${encodeURIComponent(current.tokenExpiry || '')}`;
        clear(holder);
        holder.append(qrCanvas(link));
        holder.append(el('p', { class: 'muted', text: 'Hiding again in a minute.' }));
        show.disabled = true;
        setTimeout(() => { clear(holder); show.disabled = false; }, 60000);
      },
    });
    view.append(section('Add a device', [
      el('div', { class: 'giveaway' }, [
        el('p', { text: 'Or copy this device’s token' }),
        el('p', { class: 'muted', text:
          'Shows your token on screen as a QR code. Scan it with the new device’s camera. '
          + 'Faster, but every device then shares one token — revoking it cuts them all off.' }),
        show,
        holder,
      ]),
    ]));
  }
```

- [ ] **Step 4: Let the token field take a pasted link**

Add the parser:

```javascript
function tokenFrom(value) {
  const text = value.trim();
  if (!text.includes('#/adopt') || !text.includes('?')) return { token: text, expiry: null };
  const params = new URLSearchParams(text.slice(text.indexOf('?') + 1));
  return { token: (params.get('t') || '').trim(), expiry: params.get('e') || null };
}
```

and use it in the token section's Save handler, replacing the two `token.value` / `expiry.value` reads:

```javascript
      onclick: () => {
        const pasted = tokenFrom(token.value);
        saveSettings({
          ...settings(),
          token: pasted.token,
          tokenExpiry: expiry.value || pasted.expiry || null,
        });
        initSync();
        render();
      },
```

- [ ] **Step 5: Style the new pieces**

Append to `app/style.css`:

```css
.qr-canvas { width: 100%; max-width: 18rem; height: auto; image-rendering: pixelated;
             border: 1px solid var(--rule); border-radius: 8px; }
.giveaway { border: 1px solid var(--rule); border-radius: 8px; padding: .75rem;
            background: var(--surface); }
.giveaway p:first-child { font-weight: 600; color: var(--bad); margin-top: 0; }
dl.kv { margin: 0 0 1rem; }
dl.kv dt { color: var(--muted); font-size: .85rem; }
dl.kv dd { margin: 0 0 .5rem; word-break: break-all; }
```

`image-rendering: pixelated` matters: a QR blurred by the browser's default smoothing is measurably harder for a camera to lock onto.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS, unchanged.

- [ ] **Step 7: Do the round trip for real**

1. On the laptop, in Settings, press **Show token QR**. A code appears and disappears again after a minute.
2. Point the phone's camera at it. The camera offers the link; open it. The app loads on the adopt screen showing the repository, a masked token and the expiry.
3. Check the address bar: it must read `#/adopt` with **no** `?t=` — and pressing reload must give the "already been used" message, not the token again.
4. Press *Save token on this device*. Add a card on the phone and confirm it reaches GitHub and then the laptop.
5. Repeat on a device with no token and confirm Settings led with **Set up this device** before the token existed, and shows **Add a device** after.
6. Finally, paste the whole setup link into the token field on a third browser profile and confirm it is accepted and the expiry comes across with it.

- [ ] **Step 8: Commit**

```bash
git add app/main.js app/style.css
git commit -m "feat: adopt a token by QR, with the fragment stripped on arrival"
```

---

### Task 13: Onboarding a device that has no app yet

**Files:**
- Create: `icons/onboard-qr.png`, `icons/token-qr.png`
- Modify: `app/main.js`, `app/style.css`, `README.md`

**Interfaces:**
- Consumes: the `Add a device` section from Task 12.
- Produces: nothing other modules use.

This supersedes Task 13 of the first plan. Both codes are static images of **public** URLs and neither carries a secret, so they are generated once, at development time, and committed.

- [ ] **Step 1: Generate the two PNGs**

```bash
qrencode -o icons/onboard-qr.png -s 8 -m 2 "https://cyrilpitrou.github.io/myquizzlet"
qrencode -o icons/token-qr.png   -s 8 -m 2 "https://github.com/settings/personal-access-tokens/new"
```

Never generate a QR containing a token this way — that is what `qr.js` is for. If GitHub still accepts prefill query parameters on the fine-grained token page, put the prefilled URL in `token-qr.png` instead; if it does not, the bare URL is correct and the Settings text carries the settings to choose by hand.

- [ ] **Step 2: Put them at the top of "Add a device"**

In `showSettings`, inside the `Add a device` section, **before** the `.giveaway` block:

```javascript
      el('div', { class: 'qr' }, [
        el('figure', {}, [
          el('img', { src: 'icons/onboard-qr.png', alt: 'QR code for the app address' }),
          el('figcaption', { class: 'muted', text: '1. Scan to open the app on the new device, then install it.' }),
        ]),
        el('figure', {}, [
          el('img', { src: 'icons/token-qr.png', alt: 'QR code for the GitHub token page' }),
          el('figcaption', { class: 'muted', text:
            `2. To create a token on that device instead of copying this one: scan, then choose ${REPO}, Contents → Read and write.` }),
        ]),
      ]),
```

- [ ] **Step 3: Style them**

Append to `app/style.css`:

```css
.qr { display: flex; gap: 1rem; flex-wrap: wrap; }
.qr figure { margin: 0 0 1rem; flex: 1 1 12rem; }
.qr img { width: 100%; height: auto; image-rendering: pixelated; }
```

- [ ] **Step 4: Rewrite the "adding a device" section of `README.md`**

It must now describe both paths and say plainly which one costs what:

1. Open Settings on a device that already works.
2. Point the new device's camera at the first QR code, open the link, and install the app from the browser menu.
3. If that device only needs to study, stop here — no token, no setup.
4. To let it save changes, either scan the second code and create its own token on GitHub (each device revocable alone), or press *Show token QR* and scan that with the new device (seconds, but all devices then share one token and revoking it stops all of them).

- [ ] **Step 5: Verify with a real device**

Open Settings on the laptop: both codes render sharply at phone-reading size. Point the phone's camera at the first: it offers the app URL and the browser opens it. Install from the browser menu; a study session works with no token. Scan the second: GitHub's token page opens on the phone.

- [ ] **Step 6: Commit**

```bash
git add icons/onboard-qr.png icons/token-qr.png app/main.js app/style.css README.md
git commit -m "feat: QR onboarding for a device that has no app yet"
```

- [ ] **Step 7: Whole-branch review**

This is the end of the plan, and of Stage D/H work that began in the first plan. Run `superpowers:requesting-code-review` over the entire range, then `npm test` one final time, then push.

---

## Deliberately not in this plan

Named here so a future session does not treat them as oversights.

- **Undo for a deleted list.** The confirmation dialog is the safeguard. An undo buffer means keeping the data that deletion exists to remove, and the files remain in the `data` branch's git history regardless.
- **A QR scanner inside the app.** The camera app already decodes and hands over the URL. Asking for camera permission to reimplement that would be worse in every direction.
- **Per-device tokens with per-device revocation, enforced.** Path 1 in Auth still offers it; nothing makes it mandatory, because the point of path 2 is that it is faster.
- **Themes that follow the system's dark mode automatically.** Three named themes chosen by hand is the whole feature. `prefers-color-scheme` would be a fourth state to reason about for no gain on a device where the choice is made once.
- **Animated transitions between screens.** The router replaces the screen's contents; anything more is a framework's job.
- **Automated browser tests.** Unchanged from the first plan: the pure modules carry the suite, and screens are verified by use.
