# List import/export, side-swap, and PDF export — design

Status: implemented, 2026-09-03. §4 was amended after the fact to describe
what shipped — see the note on staging at the end of that section.

## Problem

The list screen's "⋮" menu and the "Edit cards" section have grown ad hoc:
CSV export lives inline in "Edit cards" next to card rows it has nothing to do
with; file import is a bare, unlabeled `<input type="file">` next to a paste
textarea, and testing showed the user did not realize the file picker was how
you import a file ("Parcourir" reads as cryptic, not as an import affordance).
There is no way to fix a list whose two sides were entered backwards — neither
for the whole list nor for one mistyped card — and no PDF export.

This spec covers, all touching the list-editing flow:

1. A reusable file-import dialog with a preview/edit step before commit.
2. Relocating CSV export to the "⋮" menu, and adding PDF export there.
3. Swapping sides, at the whole-list level and at the single-card level.
4. Clearer, consistently-labeled import affordances in "Edit cards" and "New list".

## Current state (for reference)

- Card shape: `{ id, front, back }`. List shape includes `frontLabel`,
  `backLabel`, `frontLang`, `backLang`, `cards[]`. See `docs/data-model.md`.
- `app/csv.js`: `parseCards(text)` splits lines, auto-picks delimiter per line
  (tab if present, else comma), handles `"`-quoted fields, returns
  `{ cards, errors }`. `toCsv(cards)` always emits comma-delimited output.
- `app/screens/list.js` builds the "⋮" menu: Rename, Move to folder, Sides,
  Edit cards, Delete list — via `menu()` in `app/ui.js`, a plain popover, not
  a modal.
- `app/screens/editlist.js`'s `showEditList` is the "Sides" screen: edits
  `frontLabel`/`backLabel` (and derived langs) only, via `listForm()`. Never
  touches cards.
- `app/screens/cards.js`'s `showCards` is "Edit cards": add-card form, a table
  of cards each with a delete (✕) button, and an `importExport()` block with
  a paste textarea + import button, a bare file input that auto-imports on
  selection, and an "Export CSV" button.
- No modal/dialog primitive exists anywhere in the app. Confirmations use
  native `confirm()`/`prompt()`; richer inline sections use `<details>`.

## 1. Shared import-preview dialog

A new component, `app/screens/importdialog.js`, backed by a small modal
helper added to `app/ui.js` (a native `<dialog>`, since none exists yet and
`<dialog>` needs no framework — fits the no-build-step constraint).

Opened from three call sites: the "⋮" menu's "Import from file", the "Import
file" block at the bottom of "Edit cards", and the "Import file" block on
"New list". All three open the identical dialog; only what happens on commit
differs (see below).

**Flow:**

1. Instruction text: cards come from a file with two values per line,
   separated by comma, semicolon, or tab; a value that itself contains the
   delimiter should be wrapped in quotes.
2. A styled file-picker button (not a bare native input — the "Parcourir"
   problem) accepting `.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain`.
3. On file selection, the text is parsed (extended `csv.js`, see below) into
   an editable preview: one row per line, with `front`/`back` text inputs
   pre-filled, a per-row remove (✕). Lines that failed to parse (e.g. "no
   separator found", "empty side") still get a row, flagged as an error, and
   are editable to fix — fixing a flagged row's text clears its error state.
4. A commit button reading "Import N cards", where N is the current count of
   non-error rows; disabled when N is 0.

**Commit semantics:** always append as new cards — matches the existing
paste-text import behavior (`store.addCards`). No de-duplication against
existing cards. For the two "existing list" call sites (menu, Edit cards),
commit calls `store.addCards(listId, cards)` and closes the dialog. For "New
list", there is no list yet: commit stages the reviewed `{front, back}[]`
array into the new-list draft in memory; the cards are only written to
storage when the new list itself is saved. The dialog component itself is
storage-agnostic — it takes an `onCommit(cards)` callback and doesn't know
which of the two cases it's in.

**`csv.js` change:** `splitLine`'s per-line delimiter detection currently
picks tab if present, else comma. Add semicolon: pick, per line, whichever of
tab / semicolon / comma appears in the line, in that preference order (tab
first since it can't appear naturally in prose text; then semicolon; else
comma). `toCsv` is unaffected — export still always emits comma-delimited,
correctly quoted, output.

## 2. "⋮" menu and CSV/PDF export

`app/screens/list.js`'s menu gains, after "Edit cards" and before "Delete
list":

- **Import from file** — opens the dialog above targeting this list.
- **Export as CSV** — the `toCsv(list.cards)` + Blob-download logic, moved
  here verbatim from `cards.js`. Filename unchanged: `${listId}.csv`.
- **Generate PDF** — opens a new browser tab containing a plain, printable
  HTML page: the list's title as a heading, then a table with two columns
  headed by `frontLabel`/`backLabel` (falling back to "Front"/"Back" as
  elsewhere), one row per card in list order. The page calls `window.print()`
  once rendered, so the user saves it as a PDF via the browser's own print
  dialog. No new dependency, no vendored library — this is the only shape of
  "PDF export" that fits the project's no-build-step, no-CDN-script
  constraint.

"Export CSV" is removed from `cards.js`'s `importExport()` block — it now
lives only in the "⋮" menu.

## 3. Swap sides

Two independent features, at two different scopes, that must not be
conflated:

### 3a. Whole-list swap ("Sides" screen)

`app/screens/editlist.js`'s `showEditList` (the "Sides" screen) gains a
**Swap sides** button, separate from the existing label-editing form. It:

- Swaps `frontLabel`↔`backLabel` and `frontLang`↔`backLang` on the list.
- Swaps `front`↔`back` text on every card in the list.
- Swaps each card's progress: the item stored under `<cardId>:f2b` and the
  one stored under `<cardId>:b2f` trade places (SRS state — box, due, seen,
  lapses, lastSeen, level — moves with the skill it was tracking, not with
  the key). This keeps a card's learning history attached to "recognizing
  side A" / "producing side A" regardless of which column A now sits in.

This needs a new pure function, in a new module `app/sides.js` (kept separate
from `app/merge.js`, which owns the progress *merge* rule specifically — side
-swapping is a different concern), that takes a list + its progress items and
returns the swapped versions, plus a `store` method that applies list, cards,
and progress changes together. Confirmed via a native `confirm()` before
applying (whole-list, not easily undone by hand).

### 3b. Single-card swap ("Edit cards")

Each card row in `app/screens/cards.js` gains a swap icon-button next to the
✕ delete button: swaps that one card's `front`/`back` text immediately, no
confirmation (trivially reversible — click again). No bulk/checkbox
selection; this is for fixing the occasional backwards entry, not a bulk
operation — bulk re-orientation is what 3a is for. This does not touch
progress: a single-card swap is a data-entry correction, not a change of the
list's reading direction, so `f2b`/`b2f` keep their existing keys.

## 4. Clearer import affordances

Both "Edit cards" (`cards.js`) and "New list" (`editlist.js`'s
`showNewList`) currently present import as one unlabeled `<details>` block
mixing a paste textarea and a bare file input. Both are restructured into two
clearly headed blocks:

- **"Paste text"** — the existing textarea, with a one-line instruction ("one
  card per line, front and back separated by a comma, semicolon, or tab") and
  a button that parses it with no preview step. In "Edit cards" the button
  reads "Import pasted text" and the behavior is unchanged from today:
  immediate import into the list. In "New list" it reads "Stage pasted text"
  and adds to the draft instead — there is no list to import into yet.
- **"Import file"** — a button opening the shared dialog from §1, with a
  one-line instruction ("CSV, TSV, or text file").

In "Edit cards", commit writes straight to the list (`store.addCards`). In
"New list", commit stages cards into the draft, per §1.

Because "New list" navigates away on save, creating the list also stages
whatever is still sitting in the paste box unstaged — otherwise text pasted
but not staged would be silently discarded. Both of its blocks share one
status line, which therefore reports the draft's running total rather than
the last action's count.

## Testing

- `csv.js`'s extended delimiter detection (semicolon) gets unit tests,
  test-first, alongside its existing tests.
- The new swap-sides pure function (list + progress → swapped list +
  progress) gets unit tests, test-first: label/lang swap, card text swap,
  and progress key swap, including a card with only one direction's progress
  present (the other never studied) and a card with no progress at all.
- The import dialog, menu items, per-card swap button, and PDF page are UI
  and are verified by using them locally, not by an automated suite, per the
  project's testing convention.

## Files touched

New: `app/screens/importdialog.js`, `app/sides.js` (pure swap-sides logic).

Changed: `app/ui.js` (modal helper), `app/csv.js` (delimiter detection),
`app/screens/list.js` (menu items), `app/screens/editlist.js` (Swap sides
button, New list import blocks), `app/screens/cards.js` (per-card swap
button, import blocks, CSV export removed), `app/store.js` (swap-sides
method), `sw.js` (every new file added to `SHELL`, cache version bumped).
