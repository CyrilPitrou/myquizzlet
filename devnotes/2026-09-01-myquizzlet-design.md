# MyQuizzlet — design

Date: 2026-09-01
Status: approved, ready for implementation planning

## Purpose

A personal vocabulary trainer in the spirit of Quizlet: create lists of word
pairs, study them with flashcards and typed answers, and let a spaced-repetition
scheduler decide what comes back when. Usable on a Mac and on an Android phone,
with the same lists and the same learning progress on both. Free to run, with
nothing to maintain beyond the code itself.

Success means: adding words takes seconds, a study session starts in one tap, the
phone and the laptop never disagree, and the whole thing still works in two years
without anyone having updated a dependency.

## Constraints

- No cost, ever. No paid tiers, no service that pauses when idle.
- One user (GitHub account `CyrilPitrou`). No accounts or multi-user concerns.
- Word lists may be public. Nothing personal goes in them.
- Simplicity over generality: a personal tool, not a product.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Hosting | GitHub Pages, public repo | Free, HTTPS, zero maintenance, installable as a PWA |
| Storage | JSON files in the same repo, `data` branch | No database to run; data stays readable and hand-editable |
| Stack | Plain JS, ES modules, no build step | Five screens do not justify a toolchain that rots |
| Card fields | `front`, `back` only | Smallest model that does the job |
| Study modes | Flashcards, typed answers | The two that teach; match and multiple choice dropped |
| Scheduling | Leitner, 5 boxes | ~100 lines, explainable, effective enough for vocabulary |
| Directions | Tracked separately | Recognising and producing a word are different skills |
| Grading | Forgiving, with manual override | Arguing with a grader is how people quit |
| Sync | Automatic, GitHub API | Should require no thought during normal use |
| Progress | Synced, auto-merged | Study on either device without losing the thread |

Explicitly out of scope: images on cards, multiple choice, match games, sharing
lists with other people, a native app.

## Architecture

Three copies of the data, with clearly different jobs:

1. **The app** — static files on GitHub Pages. Installed on Android and macOS via
   the browser's "install app", which gives it an icon and its own window.
2. **The working copy** — `localStorage`, one key per list plus one per progress
   file. The only thing a study session touches, which is what makes the app
   instant and usable offline. `localStorage` holds about 5 MB per origin; a
   3000-card vocabulary is well under 500 KB, so it is ample here and far simpler
   than IndexedDB. If lists ever approach that ceiling, moving to IndexedDB
   changes `store.js` alone.
3. **The durable copy** — JSON files in the repo, on the `data` branch. The app
   pulls from it on open and pushes back after changes settle.

A local clone of the repo is needed only for development or bulk hand-editing;
never for everyday use.

### Modules

Each is a single file with one job and a small surface.

- `store.js` — owns the working copy. CRUD on lists and cards, reads and writes
  progress, records what still needs pushing. The only module that touches
  browser storage. Everything else asks it.
- `github.js` — owns the network. Pull a file, push a file with its `sha`, report
  status. Knows nothing about cards or scheduling.
- `srs.js` — pure. `next(item, correct, today) -> item` and
  `due(items, today) -> ids`. No I/O, no dates from the clock (today is passed in,
  so tests can time-travel).
- `grade.js` — pure. `grade(expected, typed) -> "correct" | "typo" | "wrong"`.
- `csv.js` — pure. Parse pasted or uploaded CSV/TSV into cards; serialise back.
- `main.js` — screens, routing, event wiring. The only module that touches the
  DOM.

The pure modules hold everything subtle, which is what makes the test suite worth
having and small.

## Data model

`data/lists/<id>.json`:

```json
{
  "id": "es-food",
  "name": "Spanish – Food",
  "frontLang": "es",
  "backLang": "fr",
  "updatedAt": "2026-09-01T14:03:00Z",
  "cards": [
    { "id": "k3f9", "front": "el pan", "back": "le pain" }
  ]
}
```

`data/progress/<id>.json`:

```json
{
  "listId": "es-food",
  "updatedAt": "2026-09-01T14:03:00Z",
  "items": {
    "k3f9:f2b": { "box": 3, "due": "2026-09-08", "seen": 7, "lapses": 1,
                  "lastSeen": "2026-09-01T14:02:11Z" },
    "k3f9:b2f": { "box": 1, "due": "2026-09-02", "seen": 4, "lapses": 3,
                  "lastSeen": "2026-09-01T14:02:40Z" }
  }
}
```

Notes:

- Card ids are short random strings, permanent for the life of the card. Editing
  text keeps the id and therefore the progress.
- `f2b` means front shown, back expected; `b2f` the reverse.
- Progress for deleted cards is pruned lazily on next save.
- The two file kinds are separate because their rhythms differ by orders of
  magnitude: lists change a few times a week, progress several times a second.
  That separation is what makes both sync and merging tractable.

## Sync

Reads and writes go through the GitHub contents API against the `data` branch.
Every write sends the `sha` of the version it replaces, so a stale write is
rejected rather than silently overwriting the other device.

- **On open**: pull all list and progress files, merge into the working copy.
- **After a change**: debounce a few seconds, then push what changed.
- **Offline**: queue the pushes, flush when the network returns.

Merge rules:

- **Lists** — conflict is rare and meaningful. Show both versions, ask which
  wins. Never merge card-by-card behind the user's back.
- **Progress** — merge per item, keeping the record with the later `lastSeen`.
  Deterministic, silent, and the worst case is one word reviewed twice.

A status indicator shows synced / pending / failed. A silent failure that quietly
loses a week of edits is the one failure mode this design most wants to avoid, so
failure must be visible and a manual retry always available.

### Auth

A fine-grained personal access token, scoped to `CyrilPitrou/myquizzlet` alone,
with read and write on contents. Pasted once per device, stored in that browser's
storage, never in a file.

Without a token the app runs read-only against the public files, so any device
can study with no setup at all. That is also the fallback if a token is revoked.

**Adding a device** means generating a token *on that device*, in mobile Chrome
or the laptop browser, and pasting it into Settings. The token is on that
device's clipboard already, so nothing is copied between devices and each device
can be revoked alone. The Settings screen spells out the steps and links straight
to GitHub's token page.

To keep that from meaning "type two long URLs on a phone keyboard", Settings also
shows two QR codes: one for the app's own address, and one for GitHub's token
page. Both are static images of public links and neither carries a token — the
phone's camera app reads them, so the app itself neither reads nor draws a QR
code: no camera permission, no encoder, no decoder. Scanning the first is the
whole of onboarding for a device that only studies; the second is scanned on the
new phone, which is what preserves the rule that a token is generated on the
device that will hold it.

**Expiry** is the one recurring annoyance: fine-grained tokens last at most a
year. The app stores the expiry date entered alongside the token and warns two
weeks ahead, so a lapse is a reminder rather than a red dot discovered
mid-session.

The token's blast radius is one repo containing nothing but vocabulary. That is
an acceptable trade for a personal tool, and it is a deliberate one.

## Studying

**Queue.** A session takes the items due today, shuffled, capped at a chosen
session size. If nothing is due, offer new cards, or a free review that leaves
scheduling untouched.

**Leitner.** Five boxes with intervals 1, 3, 7, 16, 35 days. A correct answer
promotes one box; a wrong answer sends the item to box 1 and increments `lapses`.
`due` is set from the new box's interval.

**Flashcards.** One side shown, tap to reveal, then "knew it" / "didn't". Feeds
the same scheduler.

**Typed answers.** Grading is forgiving by design: case, accents and surrounding
whitespace ignored; a leading article optional; a single-character difference
counted correct but shown with the correct spelling. Anything still marked wrong
can be overridden with one tap, which counts as correct.

## Screens

Mobile-first, controls within thumb reach, five screens:

1. **Home** — lists with due counts; a prominent Study button.
2. **List** — cards in a table; add, edit, delete; CSV import and export.
3. **Session setup** — mode, direction, number of cards.
4. **Session** — one card, full screen, minimal chrome.
5. **Settings** — token, sync status, force pull/push.

## Testing

Vitest, unit tests on the pure modules, written test-first: scheduling
transitions, grading edge cases (accents, articles, typos, empty input), CSV
parsing (quotes, tabs, ragged rows), progress merge (both sides changed, one side
missing, clock skew). Screens are verified by use. No headless-browser suite: it
would cost more than it returns at this size.

npm is a development dependency only. The deployed app has none.

## Build order

Each stage leaves the app usable.

1. **Local core** — data model, store, list and card CRUD, CSV import,
   flashcards. Usable the first day, on one device.
2. **Typed answers** — grading module and the write mode.
3. **Scheduling** — Leitner, due queues, session setup.
4. **Sync** — token, pull, push, conflict handling, status indicator.
5. **Offline and install** — service worker, manifest, icons, Android polish.
   The manifest and a fetch-handling service worker are what turn Chrome's "Add
   to Home screen" shortcut into a real installed app (a WebAPK): own icon in the
   app drawer and switcher, no browser chrome, launches offline. The manifest
   also declares long-press shortcuts — *Study due words*, *Add a word* — which
   are as close to an Android widget as a web app can get. A true home-screen
   widget would require a native app and is out of scope.

## Risks

- **CDN staleness.** Pages caches aggressively. Reading through the API when a
  token is present avoids it; the no-token path may lag a few minutes, which is
  acceptable for a read-only device.
- **Token in browser storage.** Accepted, scoped, and revocable. Documented in
  the README so it is a known trade rather than a surprise.
- **Two devices offline at once.** Produces a genuine list conflict. Handled by
  asking, not guessing.
- **Storage limits.** Browser storage is ample for thousands of cards; if lists
  ever grow past that, the working copy becomes per-list lazy loading. Not now.
