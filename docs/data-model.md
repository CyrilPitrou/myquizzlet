# Data model

Two kinds of file, deliberately kept apart. Both are plain JSON on the `data`
branch, meant to be read and edited by hand.

## Lists — `data/lists/<id>.json`

```json
{
  "id": "es-food",
  "name": "Spanish – Food",
  "folder": "Languages",
  "frontLabel": "Español",
  "backLabel": "Français",
  "frontLang": "es",
  "backLang": "fr",
  "updatedAt": "2026-09-01T14:03:00Z",
  "cards": [
    { "id": "k3f9", "front": "el pan", "back": "le pain" }
  ]
}
```

- `id` — matches the filename. Lowercase, no spaces.
- `folder` — a plain string, optional, one per list. Flat: no nesting, no
  folders file. A folder exists exactly as long as some list names it — the
  set of folders shown to you is the union of the values in use.
- `frontLabel` / `backLabel` — display names for the two columns, optional.
  They never re-key data: a card's fields are always `front` and `back`,
  whatever the labels say. Falls back to "Front" / "Back" when absent.
- `frontLang` / `backLang` — BCP-47 codes, optional, derived from
  `frontLabel` / `backLabel` by `app/langs.js` when you edit them in the app.
  Used to tune accent handling when grading. (Spoken pronunciation was
  considered and left out: the card model is text-only.)
- `cards[].id` — a short random string, **permanent for the life of the card**.
  Editing the text keeps the id, so progress survives a fixed typo. Changing an
  id silently resets what the app knows about that word.

## Progress — `data/progress/<id>.json`

```json
{
  "listId": "es-food",
  "updatedAt": "2026-09-01T14:03:00Z",
  "items": {
    "k3f9:f2b": { "box": 3, "due": "2026-09-08", "seen": 7, "lapses": 1,
                  "lastSeen": "2026-09-01T14:02:11Z", "level": 1 },
    "k3f9:b2f": { "box": 1, "due": "2026-09-02", "seen": 4, "lapses": 3,
                  "lastSeen": "2026-09-01T14:02:40Z" }
  }
}
```

- Key is `<cardId>:<direction>`. `f2b` = front shown, back expected; `b2f` the
  reverse. **Every card has two independent items**, because recognising a word
  and producing it are different skills that are learned at different speeds.
- `box` — 1 to 5. See `study-algorithm.md`.
- `due` — a date, not a timestamp. Reviews are a daily thing.
- `lastSeen` — a timestamp, and the tiebreaker when merging two devices.
- `seen` / `lapses` — counters, for display and curiosity.
- `level` — `0` or `1`, optional, absent meaning `0`. The training rung: `0`
  is asked as pick-from-four, `1` as typed. Any wrong answer resets it to `0`.
  Training-only; it never affects `box` or `due`. See `study-algorithm.md`.

Items for deleted cards are pruned on the next save. A missing item simply means
a word that has never been studied.

## Why two files

Lists change a few times a week. Progress changes several times a second while
studying. One file would mean either pushing your whole vocabulary after every
answer, or inventing a partial-write scheme. Two files with two rhythms give two
straightforward merge rules instead of one complicated one — see `sync.md`.

## Editing by hand

Safe: adding cards, fixing text, renaming a list, reordering cards.
Unsafe: changing or reusing card ids, and editing progress files (the app owns
them; hand edits will be overwritten or merged unpredictably).

New cards added by hand need an `id`. Any short unique string works.
