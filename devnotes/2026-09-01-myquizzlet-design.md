# MyQuizzlet — design

Date: 2026-09-01
Revised: 2026-09-02 — a second design pass, run after Stages A–C and the
installable app had shipped and been used on a phone. Where this pass reverses an
earlier decision, the reversal and its price are stated in place; nothing is left
for a reader to reconcile between two sections.
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
| Stack | Plain JS, ES modules, no build step | A handful of screens does not justify a toolchain that rots |
| Card fields | `front`, `back` only | Smallest model that does the job |
| Study modes | Flashcards, typed answers | The two that teach; match and multiple choice dropped |
| Scheduling | Leitner, 5 boxes | ~100 lines, explainable, effective enough for vocabulary |
| Directions | Tracked separately | Recognising and producing a word are different skills |
| Grading | Forgiving, with manual override | Arguing with a grader is how people quit |
| Sync | Automatic, GitHub API | Should require no thought during normal use |
| Progress | Synced, auto-merged | Study on either device without losing the thread |
| Deleting a list | Really deleted, both files | The files are the data; dead JSON accumulating in a repo you hand-edit is worse than a rare resurrection |
| Renaming a list | Keeps its id | Ids are opaque and permanent, so the filename and the progress pairing never move |
| List order | Most recently used | Derivable from data that already exists and already syncs |
| Themes | Three, chosen per device | With one token set the alternates are nearly free; appearance is a preference, not data |
| Adding a device | Two paths, one opt-in | Generating a token on a phone is the real friction; copying one is faster and is priced below |

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
- `qr.js` — pure. `encode(text) -> boolean[][]`, a QR matrix. Byte mode, error
  correction level L, versions 1–13. It exists only because one payload — a token —
  may never be shown to a third-party generator; see Auth.
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
- **No list carries a "last studied" field.** Recency is derived: the later of the
  list's `updatedAt` and the newest `lastSeen` among its progress items. Both
  already exist and already sync, and `lastSeen` is the field the progress merge
  already resolves on — so ordering agrees across devices for free. Writing a
  `lastStudiedAt` into the list file instead would make *studying* dirty the
  low-churn file, which is precisely what the two-file split exists to prevent.
- **Renaming changes `name` and nothing else.** The id, the filename on the `data`
  branch and every progress key stay as they were. A list called "German" living in
  `es-food.json` is an acceptable oddity; ids are opaque.
- **Deleting a list deletes both of its files.** Until that push succeeds the id
  sits in a local tombstone set, so a pull cannot resurrect it in the meantime.

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

### Deleting a list

Deletion is the only operation that must survive a sync it did not start, so it
gets its own rules.

- The store records the id in a tombstone set and marks both keys dirty.
- The push deletes `data/lists/<id>.json` and `data/progress/<id>.json` through the
  contents API, each carrying the `sha` it last saw. The tombstone is dropped only
  once both deletes have succeeded.
- A pull ignores any remote file whose id is tombstoned, so the list cannot come
  back in the window between the delete and the push.
- One failure is accepted rather than engineered away: a second device that was
  offline with unsynced edits to that list will push it back. For a single-user
  tool that is a rare annoyance with an obvious remedy — delete it again — and it
  costs far less than never removing the files at all.

Deletion asks first, and names what goes with it: the list, its cards, and their
progress.

A status indicator shows synced / pending / failed. A silent failure that quietly
loses a week of edits is the one failure mode this design most wants to avoid, so
failure must be visible and a manual retry always available.

### Auth

A fine-grained personal access token, scoped to `CyrilPitrou/myquizzlet` alone,
with read and write on contents. Pasted once per device, stored in that browser's
storage, never in a file.

Without a token the app runs read-only against the public files, so any device
can study with no setup at all. That is also the fallback if a token is revoked.

**Adding a device — two paths.** *(Revised 2026-09-02. The first pass allowed only
the first path and argued at length that a token must never cross between devices.
Living with it showed the price: creating a fine-grained token means logging into
GitHub on a phone and working a form built for a desktop, every time. Both paths
are now supported, and the second one is opt-in and honestly labelled.)*

**Path 1 — generate a token on the new device.** Settings shows two QR codes: one
for the app's own address, one for GitHub's token page. Both are static images of
public links and neither carries a secret. Scanning the first is the whole of
onboarding for a device that only studies; the second is scanned *on the phone
being added*, so the token is created on the device that will hold it and can be
revoked alone. This remains the path with the smallest blast radius.

**Path 2 — copy the token from a device that already has one.** Settings, on a
device with a token, offers *Show token QR* behind an explicit button. It encodes
`…/myquizzlet/#/adopt?t=<token>&e=<expiry>` — a URL, not a bare secret, which is
what lets the receiving phone's own camera app open it in the browser. The app
therefore still contains no QR *decoder* and asks for no camera permission; what it
gains is an **adopt screen**, which the fragment lands on.

The adopt screen names the repository, the masked token and the expiry, states
that both devices will then share one token, and asks. It does not save silently:
a URL can arrive by accident, and a token appearing on a device without a word
said is the sort of surprise this design avoids everywhere else. Either answer
strips the fragment with `history.replaceState`, so the token leaves the address
bar and the history before anything else happens. The giving device hides the code
again after a minute.

A URL fragment never reaches a server, so the token is not sent to GitHub Pages by
this route. The token field in Settings also accepts a pasted setup link as well as
a bare token, which is the fallback when a camera is not to hand.

**The price of path 2, accepted deliberately:** the token appears on a screen, so
a shoulder-surfer or a screenshot leaks it, and revoking it now cuts off *every*
device rather than one. The blast radius is unchanged — one public repository
containing nothing but vocabulary — and path 1 remains available whenever that
trade is not wanted.

**Why the app draws the code itself.** No third-party generator may ever see a
token, and the payload is dynamic, so a committed PNG cannot serve. That is the
whole justification for `qr.js`. It is the largest new module in the app after
`main.js`, and it is pure, which puts it in the tested tier: fixtures generated
with `qrencode` at design time, asserted module-for-module. That test is what makes
250 lines of Galois-field arithmetic safe to own.

Two roads that look tempting here are closed. A short pairing code needs a server
to broker the exchange, and there is no server; committing an encrypted blob to the
`data` branch instead would make a public, offline-brute-forceable file out of a
token. And GitHub's OAuth device flow cannot be completed by a static site: the
code-for-token endpoint sends no CORS headers, and adding a server to proxy it
violates the no-cost, no-maintenance constraint.

**Expiry** is the one recurring annoyance: fine-grained tokens last at most a
year. The app stores the expiry date entered alongside the token and warns two
weeks ahead, so a lapse is a reminder rather than a red dot discovered
mid-session.

The token's blast radius is one repo containing nothing but vocabulary. That is
an acceptable trade for a personal tool, and it is a deliberate one.

## Studying

**Queue.** A session takes the items due today, shuffled. *(Revised 2026-09-02:
the default is now everything due, not a fixed twenty.)* Capping is opt-in — a
checkbox on the setup screen, pre-filled with 50 and accepting 5 to 500. If nothing
is due, offer new cards, or a free review that leaves scheduling untouched.

A card in a both-directions session asks two questions, so a list showing "12 due"
on Home produces a queue of 24. Home counts cards and the session counts questions;
both numbers are right and the setup screen states them together — "24 questions,
12 cards due" — so the queue length is never a surprise.

**Leitner.** Five boxes with intervals 1, 3, 7, 16, 35 days. A correct answer
promotes one box; a wrong answer sends the item to box 1 and increments `lapses`.
`due` is set from the new box's interval.

**Flashcards.** One side shown, tap to reveal, then "knew it" / "didn't". Feeds
the same scheduler. *(Added 2026-09-02.)* After the reveal the card also follows a
horizontal drag and commits past about a quarter of the screen width: right for
"knew it", left for "didn't", springing back under the threshold. Swipe is live
**only after the reveal** — grading a card whose back you have not seen is always a
mistake, so before it a drag and a tap both simply reveal. The buttons stay exactly
where they are: they are the desktop path and the accessible one, and swipe is an
addition to them, never a replacement.

**Typed answers.** Grading is forgiving by design: case, accents and surrounding
whitespace ignored; a leading article optional; a single-character difference
counted correct but shown with the correct spelling. Anything still marked wrong
can be overridden with one tap, which counts as correct.

**Results.** *(Added 2026-09-02.)* A session ends on a percentage, a one-line
verdict, the tally and a right/wrong bar. The verdict has five tiers — 100%,
90–99%, 75–89%, 50–74%, below 50% — worded plainly and without celebration
graphics, because the screen is read several times a day. A free-review session
gets the same screen and says so, since nothing it did was scheduled.

## Screens

Mobile-first, controls within thumb reach, seven screens:

1. **Home** — lists, most recently used first, with due counts and a prominent
   Study button.
2. **List** — cards in a table; add, edit, delete; CSV import and export. Renaming
   and deleting the list itself live here too, beside the cards they affect,
   rather than crowding Home's rows on a phone.
3. **Session setup** — mode, direction, an opt-in length cap, free review. States
   the real queue length before you start.
4. **Session** — one card, full screen, minimal chrome.
5. **Results** — percentage, verdict, tally.
6. **Settings** — five labelled sections, ordered by what the device needs next.
7. **Adopt** — reached only by opening a token QR's link; asks before saving.

*(Revised 2026-09-02.)* Settings was one undivided run of controls and had become
hard to read. Its sections, in order: **Appearance** (theme), **Sync** (status in
words as well as a dot, force pull/push, pending count), **GitHub token**, **Add a
device** (the two public QR codes, with the opt-in *Show token QR* boxed off below
them), **About**.

The order follows state. On a device with no token, a **Set up this device**
section comes first and gives two numbered steps — show the QR on a device that
works, point this phone's camera at it — with the GitHub route offered underneath
for when there is no other device yet. Once a token is saved that section is
replaced by **Add a device**, further down, because the question has changed from
"how do I get in" to "how do I bring another phone in".

## Visual system

*(Added 2026-09-02. The first pass specified no palette, and the result was
ad-hoc hex values scattered through `style.css` — which is also how the sync dot
silently lost its colours to a specificity accident.)*

**Every colour in the app comes from a custom property. No rule anywhere sets a
colour any other way.** That is the rule the accident argues for, and it is what
makes the rest of this section nearly free.

The token set is small: `--ground`, `--surface`, `--ink`, `--rule`, `--muted`,
`--accent`, `--ok`, `--bad`, plus two subordinates the real stylesheet needs —
`--field` for input borders and `--warn` for the token-expiry banner. Three themes
define them:

- **Paper** (default) — warm off-white ground, ink text, one muted amber accent,
  thin rules instead of boxes. A vocabulary notebook rather than an app.
- **Study** — indigo on white, cards as raised surfaces.
- **Focus** — dark slate ground, one teal accent, the card the only bright surface.

Each alternate is roughly ten declarations under `:root[data-theme="…"]`. The
choice is stored on the device and never syncs: it is a preference, not data.
It must be stamped on `<html>` before first paint, and `main.js` is a deferred
module, so a three-line inline script in `index.html` reads it — our own file, no
dependency, and the no-build-step rule is untouched.

Two details that ride along:

- **The status dot stops carrying meaning by colour alone.** Filled ● synced,
  arrow ↑ pending, slash ⊘ no token, cross ✕ failed, hollow ○ offline —
  distinguishable at 16px — and on Settings it is accompanied by a word.
- **The icon** is a single glyph in the accent on the Paper ground, drawn once as
  SVG and committed as rasterised 192/512 PNGs. `theme_color` and
  `background_color` match Paper, the default.

Tap targets are 44px throughout, radio and checkbox rows included.

## Testing

Vitest, unit tests on the pure modules, written test-first: scheduling
transitions, grading edge cases (accents, articles, typos, empty input), CSV
parsing (quotes, tabs, ragged rows), progress merge (both sides changed, one side
missing, clock skew), and QR encoding against fixtures generated with `qrencode`
(short and long payloads, each version boundary the app can reach). Screens are
verified by use. No headless-browser suite: it
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
6. **Second pass** *(added 2026-09-02, after stages 1–5 shipped and were used on a
   phone)* — list management (delete, rename, recency order), the study-session
   changes (length default, results, swipe), the visual system and its three
   themes, and token adoption by QR. Each is described in place above; none of it
   changes the architecture.

## Risks

- **CDN staleness.** Pages caches aggressively. Reading through the API when a
  token is present avoids it; the no-token path may lag a few minutes, which is
  acceptable for a read-only device.
- **Token in browser storage.** Accepted, scoped, and revocable. Documented in
  the README so it is a known trade rather than a surprise.
- **Two devices offline at once.** Produces a genuine list conflict. Handled by
  asking, not guessing. If one of them deleted the list, the other resurrects it;
  see Deleting a list.
- **A shared token.** *(Added 2026-09-02.)* Copying a token to a second device
  means revoking it cuts off both, and means the token is briefly on screen.
  Accepted knowingly, mitigated by making the path opt-in and explicit, and
  avoidable entirely by using path 1 in Auth.
- **Storage limits.** Browser storage is ample for thousands of cards; if lists
  ever grow past that, the working copy becomes per-list lazy loading. Not now.
