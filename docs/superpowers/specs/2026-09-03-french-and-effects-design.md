# French, motion and sound — design

**Date:** 2026-09-03
**Status:** approved, not implemented

Three additions to MyQuizzlet, in this order: a full French translation with a
flag button in the topbar, card motion, and sound. The two effects are governed
by the `visualEffects` and `audioEffects` switches that `screens/settings.js`
already renders and that nothing currently reads.

French goes first and is committed on its own, because it is the mechanical
change that touches every screen. Doing it before the effects work means the
strings the effects introduce are written once, in both languages, rather than
translated as an afterthought.

## Standing constraints this must respect

No build step, no dependencies, no CDN. Every new module goes into `SHELL` in
`sw.js` and the cache name is bumped, or the app breaks offline. Pure modules
are tested; screens are verified by use.

---

## Part 1 — French

### The mechanism

`app/i18n.js` exports:

- `t(key, params)` — looks a flat dot-separated key up in the current
  dictionary and interpolates `{n}`-style placeholders.
- `lang()` — `settings().lang`, defaulting to `'en'`.
- `setLang(code)` — saves it, sets `document.documentElement.lang`, re-renders.
- `plural(langCode, n)` — returns `'one'` or `'other'`.

Dictionaries are `app/lang/en.js` and `app/lang/fr.js`, each a flat object.

**Missing keys fall back to the English string, never to the key itself.** A
personal tool must never show its owner `train.setup.blurb`. A missing key also
logs a `console.warn`, which is how the gap gets noticed.

### Plurals

English and French disagree about zero: "0 cards" but "0 carte". So a key that
varies with a count is stored as a pair, `cards_one` and `cards_other`, and
`plural()` picks:

- `en`: `n === 1` → `one`, else `other`
- `fr`: `n < 2` → `one`, else `other`

`plural` is pure and tested, including `n === 0` in both languages, which is
the whole reason it exists.

### The switch

A button in `#topbar`, next to the sync dot, **showing the flag of the language
currently in use** — 🇬🇧 when the app is in English, 🇫🇷 when it is in French.
It is a status that happens to be tappable; tapping toggles to the other
language. Its `title` names the action ("Switch to French" / "Passer en
anglais") so the affordance is not left to the flag alone.

The language lives in the same local settings blob as the theme: per-device,
not synced. Nothing new to merge, and a phone and a laptop may legitimately
differ.

The pre-paint script already in `index.html` (which applies the theme before
first paint) also sets `document.documentElement.lang` from the same blob, so
the first paint is not in the wrong language.

### Help

`screens/help.js` is ~150 lines, mostly prose. It keeps its layout and structure
and imports its text from `screens/help.en.js` and `screens/help.fr.js`.
Long-form prose is edited as prose; chopping it into sixty paragraph-sized
dictionary keys would make both versions worse and neither easier to change.
Each language phrases things naturally rather than tracking the other
sentence-for-sentence.

### Scope

Every user-visible string in `app/` goes through `t()`: all thirteen screens,
the topbar, the sync status line, `alert`/`confirm` text, and the verdict
panels. User data — card fronts and backs, list names, column labels — is never
touched.

### Testing

- `plural()` in both languages, `n` of 0, 1, 2.
- Interpolation, including a missing parameter and a missing key.
- **Key-set equality between `en.js` and `fr.js`.** This is the test that will
  still be earning its keep in a year.

### New files

`app/i18n.js`, `app/lang/en.js`, `app/lang/fr.js`, `app/screens/help.en.js`,
`app/screens/help.fr.js`.

---

## Part 2 — Motion

### The contract

Screens never ask whether effects are on. They call the helper, and the helper
decides:

```js
await fx.flyOut(cardNode, 'right');   // resolves immediately when effects are off
```

`fx.js` consults `settings().visualEffects` **and**
`matchMedia('(prefers-reduced-motion: reduce)')` on each call. When either says
no, travel animations resolve on the spot; the cheap ones — colour flash,
opacity — still run, since reduced-motion is about travel, not about feedback.
The OS setting wins over the app switch.

The result is one code path through every screen in all four on/off
combinations. This is what keeps the feature from rotting.

### Default

`visualEffects` defaults to **on** for a fresh install, `audioEffects` to
**off**. Motion is part of how the app feels and costs nothing; sound that
starts unannounced on a train does not.

### The card, restructured

Today `view.js` flips by re-rendering the whole screen, which cannot animate.
A card needs both faces present at once:

```
.card.deck            ::before / ::after draw a 1–2px paper stack behind
  .face.front
  .face.back          rotateY(180deg), backface-visibility: hidden
```

Flipping becomes `node.classList.toggle('flipped')` driving a 350ms `rotateY`
on the container — **with no re-render**. `view.js` keeps `browse.flipped` in
step without calling `ctx.render()`.

### Helpers in `app/fx.js`

All promise-returning, all no-ops when disabled:

- `flip(node)` — 350ms rotateY.
- `flyOut(node, dir)` — translate ±120%, rotate, fade, ~220ms. The caller then
  re-renders and the incoming card is given a one-shot `slide-in-left/right`
  class from the opposite side.
- `flash(node, 'ok' | 'bad')` — colour wash over the face; `bad` also shakes.
- `countUp(node, from, to, ms)`.
- `confetti(node)` — about 40 absolutely-positioned spans with randomised
  transform and delay, removing themselves on `animationend`. No canvas, no
  library.

Character: physical but restrained. No bounce, no overshoot. Fast enough never
to stand between you and the next answer.

### `swipeable()` changes

Two, both in `app/ui.js`:

- an `onDrag(dx)` callback, so the card's shadow can lift as it is dragged;
- a successful swipe must no longer spring back. Today `release()` runs before
  the callback fires. Instead the card is handed to `flyOut()`, and only the
  abandoned swipe springs back.

### Coverage

| Screen | Treatment |
|---|---|
| Browse (`view.js`) | flip on tap, fly-off + slide-in on swipe and on Prev/Next, deck stack |
| Test — flashcards | flip on tap-to-reveal, fly-off left/right on swipe or button, correct/wrong flash |
| Test — write | flash on the prompt block, verdict panel slides in rather than replacing abruptly |
| Train | as Test-write, plus a small motion when a word graduates a rung |

---

## Part 3 — Sound

`app/audio.js` holds one lazily-created `AudioContext`, built on the first user
gesture because browsers block it otherwise. **While `audioEffects` is off, no
context is ever constructed** — no autoplay warnings, no cost.

Every sound is a short list of notes, `{ freq, at, dur, wave }`, run through a
gain envelope so nothing clicks:

| name | fires on | shape |
|---|---|---|
| `right` | correct answer | E5→A5 rise, triangle, 90ms each |
| `wrong` | wrong answer | 160Hz square blip, fast decay |
| `typo` | near-miss | single mid note |
| `graduate` | a word climbs a rung in Train | three-note arpeggio |
| `perfect` / `great` / `ok` / `rough` | Done screen | 4–6 note fanfare each |

One switch governs all of it — answer blips and result fanfares alike. Two
switches for a one-user app would be a setting that exists "in case".

The note tables are plain data, so a test asserts every entry is well-formed.
The player itself is about twenty-five lines.

---

## Part 4 — The Done screen

`app/messages.js` — pure, tested:

- `bucketFor(right, total)` → `'perfect'` (100%) / `'great'` (≥85%) /
  `'ok'` (≥60%) / `'rough'`. `total === 0` is handled explicitly.
- `pick(bucket, langCode, rand)` — randomness is an argument, so the choice is
  testable.

Lines live in `app/messages.en.js` and `app/messages.fr.js`, about six per
bucket per language, **written natively in each language rather than
translated**. The tone is enthusiastic and silly, emoji included — a tone that
does not survive translation, which is exactly why the two files are
independent rather than parallel.

The Done screen, in order: the score counts up, a ring fills, the message
appears, the fanfare plays, and confetti fires only for `perfect` and `great`.

---

## Sequencing

Four phases, each shippable and separately committed.

1. **French.** `i18n.js`, both dictionaries, the flag button, the split Help,
   every screen converted, the key-set test. Committed before any effects work
   begins.
2. **Foundations and the card.** Settings switches wired to real behaviour,
   `fx.js` and `audio.js` with their no-op contract, reduced-motion, the
   two-face card restructure, and a real flip on Browse.
3. **Motion and sound in Train and Test.** Flash, fly-off, slide-in, the answer
   sounds.
4. **Done screens.** Score reveal, `messages.js`, confetti, fanfares.

## Housekeeping

Ten new modules — `i18n.js`, `lang/en.js`, `lang/fr.js`, `fx.js`, `audio.js`,
`messages.js`, `messages.en.js`, `messages.fr.js`, `screens/help.en.js`,
`screens/help.fr.js` — each added to `SHELL` in `sw.js`, with the cache name
bumped from `v16`. Missing one means that module is never cached and the app
breaks offline the moment the network goes.

## Deliberately not doing

- No animation library, no confetti package, no i18n framework.
- No language detection from the browser locale. English is the default; the
  flag is one tap away.
- No syncing of language, theme or effect switches. They are per-device.
- No separate switches for answer sounds and result sounds, and no volume
  control.
- No translation of card content or list names. That is user data.
