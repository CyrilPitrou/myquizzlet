# App reorganisation — design

Status: approved 2026-09-02. Supersedes nothing; extends
`devnotes/2026-09-01-myquizzlet-design.md`, whose auth/QR section is carried
over unchanged.

The app today is one screen of lists, one screen of cards, and one study loop.
This adds the structure a growing collection needs — folders, named columns,
per-list statistics — and splits studying into three distinct activities:
browsing, training, and testing.

Everything here holds to the standing constraints: no build step, no
dependencies, plain hand-editable JSON, and a study session that touches only
browser storage.

## 1. Data model

Three additions. All are optional, so every existing file on the `data` branch
stays valid and nothing is rewritten on upgrade.

### List — `data/lists/<id>.json`

```json
{
  "id": "es-food",
  "name": "Spanish – Food",
  "folder": "Spanish",
  "frontLabel": "Spanish",
  "backLabel": "French",
  "frontLang": "es",
  "backLang": "fr",
  "updatedAt": "2026-09-02T10:00:00Z",
  "cards": [{ "id": "k3f9", "front": "el pan", "back": "le pain" }]
}
```

- `folder` — a plain string, or absent. One folder per list, flat, no nesting.
  There is no folders file: the set of folders is the union of the values in
  use, so a folder exists exactly as long as a list is in it and can never be
  orphaned. Renaming a folder rewrites the field on each of its lists.
  Lists without a folder are shown under **Unfiled**, which sorts last.
- `frontLabel` / `backLabel` — what the two columns *are* ("Spanish" and
  "French", or "Date" and "Event"). Display names only. Absent means "Front"
  and "Back".

Card objects are untouched: `front` and `back` remain the keys, and progress
keys remain `<cardId>:f2b` and `<cardId>:b2f`. Renaming a column must not churn
a single card or invalidate a single progress entry.

### Progress — `data/progress/<id>.json`

One new field per item:

```json
"k3f9:f2b": { "box": 3, "due": "2026-09-08", "seen": 7, "lapses": 1,
              "lastSeen": "2026-09-01T14:02:11Z", "level": 1 }
```

- `level` — `0` or `1`, absent meaning `0`. Which rung of the training ladder
  this item is on (see §6). Written only by training; testing ignores it.

**A wrong answer anywhere resets `level` to 0.** This is a one-line change in
`nextItem`, and it is what makes a forgotten word get re-introduced with
multiple choice rather than thrown straight back at you.

No other counters are added. Everything the statistics need is already stored.

### `app/langs.js` — new, pure

`langOf(label)` maps a column label to a BCP-47 code: `english→en`,
`français→fr`, `spanish→es`, and about twenty more, matched case- and
accent-insensitively, in English and in the language's own name. An
unrecognised label ("Date", "Event") returns `null` and grading falls back to
plain accent-insensitive matching. The create and edit forms call this to fill
`frontLang`/`backLang`, and show what was detected so it can be overridden.

## 2. Statistics

`app/stats.js` — new, pure, tested. `listStats({ list, progress })` returns:

- `learnedPct` — items in box 4 or 5, divided by `cards.length × 2`. The
  denominator is every *possible* item, not every started one, so a list where
  one word has been studied reads 1%, not 100%.
- `rightPct` — `(Σseen − Σlapses) / Σseen`, or `null` when nothing has been
  seen. A lifetime figure, from counters that already exist.
- `due` — cards with at least one item due today. This is what `dueCount()` in
  `main.js` computes now; it moves into `stats.js` and is tested.

Learned and right only move when you answer; due moves when time passes. All
three are needed: without due, a list of solid box-5 words looks identical the
day before and the day after forty of them fall due.

Nothing new is written to the `data` branch to support any of this.

## 3. Navigation

The header carries four controls and the sync dot on every screen:

```
＋   Folders   Lists   ⚙   ●
```

The "MyQuizzlet" wordmark is dropped — four controls plus a dot is already a
full phone width, and the app's identity is its icon, not its header.

During a train or test session the header collapses to `← Quit`, a `3 / 8`
counter, and the dot. The nav is removed for the duration: it otherwise sits
exactly where the swipe gesture starts, and a stray `＋` mid-answer is a lost
session.

### Routes

| Route | Screen |
|---|---|
| `#/` | Lists — recent five with statistics, then all lists |
| `#/folders` | Folders — each folder with its list count, Unfiled last |
| `#/folder/<name>` | The lists in one folder |
| `#/new` | Create a list |
| `#/list/<id>` | The list screen |
| `#/list/<id>/cards` | The editable card table (today's list screen) |
| `#/list/<id>/edit` | Name, folder, column labels |
| `#/view/<id>` | Card browser |
| `#/train/<id>`, `#/train/<id>/go` | Train setup, train session |
| `#/test/<id>`, `#/test/<id>/go` | Test setup, test session |
| `#/settings` | Settings |
| `#/adopt?t=…&e=…` | Adopt a token from a QR link |

`#/study/<id>` redirects to `#/test/<id>` so old bookmarks and the home screen's
former Study links keep working.

## 4. The list screen

```
Spanish – Food                                    ⋮
Spanish · 128 cards
learned ▓▓▓▓▓▓░░░░ 64%   right 87%   12 due

[  View cards  ]   [  Train  ]   [  Test  ]
```

The `⋮` menu, anchored top right: **Rename · Move to folder · Edit columns ·
View all cards · Delete list**. "View all cards" is the editable table at
`#/list/<id>/cards`, which keeps the import/export panel.

The three daily actions are buttons; everything rare or destructive is one tap
further away, behind the menu. Delete keeps its existing confirmation, which
names the card and progress-record counts.

The same three statistics appear on each row of the Lists screen, compactly.

## 5. Card browser — `#/view/<id>`

One card, front showing, tap to flip. `‹` and `›` move to the neighbouring
card, as do the arrow keys; space flips. Position shown as `17 / 128`. A
Shuffle toggle reorders the deck; it is stored in settings, because it is a
preference and not data, and therefore never syncs.

The browser records nothing. Browsing is not studying, and a screen you page
through idly must not move a single due date.

## 6. Training — `#/train/<id>`

Training introduces new words and rescues shaky ones. It is a ladder of two
rungs, drilled in small batches.

| rung | how the item is asked |
|---|---|
| 0 | pick the answer from four |
| 1 | type the answer, unaided |

`app/train.js` — new, pure, tested:

- `pickBatch({ list, progress, directions, size = 8, shuffle })` — returns item
  keys: never-seen items first, then ascending `box`, then descending `lapses`.
- `choices({ list, key, count = 4, shuffle })` — the correct answer plus up to
  three distractors taken from the same side of the same list, deduplicated by
  text, preferring similar length so the right answer is not the odd one out.
  Fewer than two candidates (a very short list) returns `null`, and the item is
  asked by typing instead.
- `advance(state, correct)` — the batch state machine.

**The loop.** Each item is asked at its current rung. Correct at rung 0 promotes
it to rung 1 and returns it to the back of the queue. Correct at rung 1
graduates it out of the batch. Wrong at either rung sends it to rung 0 and to
the back of the queue. The same item is never asked twice in a row while
another is available.

When all eight graduate, the batch refills silently from the list and the
session continues — an inline "8 done" line, no interruption, no dialogue —
until you quit or the list is exhausted, at which point a summary is shown.

**Contact with the scheduler.** Only the graduating *typed* answer calls
`nextItem`, promoting the box and setting a due date; a wrong typed answer
likewise counts as a lapse. Multiple-choice answers change `level` and nothing
else. Recognising a word among four is a far easier task than recalling it, and
letting it stretch a review interval would mean meeting the word again long
after it had gone.

`level` is persisted with every answer, so a batch abandoned halfway through
resumes on the right rung tomorrow.

Both directions are included by default and can be narrowed on the setup
screen. A batch is eight *direction-items*, so one card may appear twice, once
each way, with independent rungs — the same model the rest of the app uses.

## 7. Testing — `#/test/<id>`

Unchanged in substance: write or flashcard, one direction or both, a session
size, and free review that leaves scheduling untouched. The setup screen moves
from `#/study/<id>` to `#/test/<id>`.

One addition. In flashcard mode the card can be swiped: pointer events, the
card following the finger and tilting as it goes, committing past roughly a
quarter of the screen width — right for knew it, left for didn't. The buttons
stay, for the desktop and for the day the gesture is not discovered. The
handler must not fight page scroll: it claims the pointer only once horizontal
movement clearly dominates.

## 8. Creating and editing a list — `#/new`

One form: name; folder, as free text with a datalist of the folders already in
use; and the two column labels, each showing quietly what language was detected
from it — *"→ Spanish; accents ignored when grading"* — with the option to
change it. Below, the paste box and CSV file picker already in
`importExport()`, so a list can be created with its cards in a single pass.

`#/list/<id>/edit` is the same form without the import half, and never touches
card ids: renaming a column is a metadata change and must leave every card and
every progress entry exactly where it was.

## 9. Code structure

`main.js` is 494 lines and this work would roughly triple it. It is split:

```
app/main.js          router and header, ~80 lines
app/screens/         lists.js folders.js list.js cards.js editlist.js
                     view.js train.js test.js settings.js adopt.js
app/train.js         pure — pickBatch, choices, advance
app/stats.js         pure — listStats
app/langs.js         pure — langOf
app/ui.js            gains menu() and swipeable()
```

Each screen module exports one function that renders into `#screen`. The router
stays the only thing that reads `location.hash`. `ui.js` absorbs the two pieces
of fiddly DOM plumbing — the anchored menu and the swipe gesture — so no screen
has to own them.

Still ES modules loaded directly by the browser. No bundler, no framework, no
CDN, no runtime dependency.

## 10. QR onboarding

`qr.js`, the adopt screen, and the "Add a device" settings section, implemented
exactly as specified in `devnotes/2026-09-01-myquizzlet-design.md` — byte mode,
error correction level L, versions 1–13, tested against fixtures generated with
`qrencode`. Nothing about that design changes here; it is simply scheduled last,
after the reorganisation is in place.

## Testing

`train.js`, `stats.js` and `langs.js` are pure and are written test-first, as
are the `level` changes to `srs.js`. The batch state machine in particular gets
real coverage: promotion, demotion, graduation, no-repeat-in-a-row, refill, and
a list too short to build four choices from.

Screens are verified by using them. No headless-browser suite.

## Deliberately not done

- Nested folders, and lists in more than one folder. One flat folder per list
  covers "one folder per language", which is the actual need.
- A folders file with ordering and colours. It would be a third file kind with
  a third merge rule, for no gain over deriving folders from the lists.
- A hinted middle rung between multiple choice and typing. Two rungs, one
  mechanic to understand.
- New accuracy counters. `seen` and `lapses` already answer the question.
