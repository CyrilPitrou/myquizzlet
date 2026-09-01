# Data model

Two kinds of file, deliberately kept apart. Both are plain JSON on the `data`
branch, meant to be read and edited by hand.

## Lists — `data/lists/<id>.json`

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

- `id` — matches the filename. Lowercase, no spaces.
- `frontLang` / `backLang` — BCP-47 codes, optional. Used to tune accent
  handling when grading. (Spoken pronunciation was considered and left out: the
  card model is text-only.)
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
                  "lastSeen": "2026-09-01T14:02:11Z" },
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
