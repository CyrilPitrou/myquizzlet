# MyQuizzlet

A personal Quizlet-like vocabulary trainer. Single public GitHub repo that is both
the app host and the database: static files on GitHub Pages, word lists as JSON in
the same repo.

- Repo: `CyrilPitrou/myquizzlet`
- Live: `https://cyrilpitrou.github.io/myquizzlet`
- Design: `devnotes/2026-09-01-myquizzlet-design.md`
- Docs: `docs/`

## Standing constraints

These are deliberate. Do not "improve" past them without asking.

1. **No build step.** Hand-written HTML/CSS/JS, ES modules loaded directly by the
   browser. `git push` is the deploy. npm exists only for running tests; the
   deployed app has zero runtime dependencies. Never add a bundler, a framework,
   or a CDN script tag to the app.
2. **Personal tool.** One user, a few thousand cards. Simplicity beats generality
   every time. No accounts, no multi-user, no roles, no settings that exist
   "in case". YAGNI hard. The one exception is the UI language: the owner
   reads both English and French, so the app is translated — see the i18n
   rule below — but this does not open the door to further generality.
3. **Local-first.** A study session touches only browser storage. Network work
   happens outside the answer loop. The app must be fully usable offline.
4. **Data is plain JSON, editable by hand.** Anything that makes the files
   unreadable or requires the app to fix them up is wrong.

## Layout

```
main branch                          data branch
  index.html                           data/lists/<id>.json
  app/main.js     router + header      data/progress/<id>.json
                                       data/suggestions.json        the 🪄 box — free text, "" when empty
                                       data/suggestions-log.json    what was done about it, newest first
     app.js        shared singletons: store, settings, go, todayStr,
                    screen, ctx. Screens import from here, never from
                    main.js, so nothing calls back up into the router.
     status.js     sync status indicator
     ui.js         shared DOM helpers
     i18n.js      t(), the plural rule, and the language setting
     i18n.en.js   the English dictionary — also the fallback
     i18n.fr.js   the French dictionary — same keys, checked by a test
     fx.js        whether an effect happens, and the animations
     audio.js     synthesised sounds — the note tables and the player
     messages.js  pure. which bucket a result falls in, and a line for it
     messages.en.js / messages.fr.js  the lines, written per language
     store.js     browser-side state
     github.js    pull / push
     sync.js      pull/merge/push orchestration
     merge.js     pure. progress merge rule
     srs.js       pure. Leitner scheduling
     grade.js     pure. answer checking
     csv.js       pure. import / export
     langs.js     pure. column label → language code
     dates.js     pure. an ISO day shown European, 03/09/2026
     listsort.js  pure. the six orders the Lists screen offers
     stats.js     pure. per-list numbers
     train.js     pure. training batches and rungs
     sides.js     pure. whole-list side swap: labels, card text, progress keys
     wishes.js    pure. the suggestion document, seeding, recent entries
     listform.js  shared list/card editing fields
     qrcard.js    a QR code as DOM, shared by the token screen and help
     tokenshare.js the opt-in "show my token as a QR" box, same two screens
     screens/     lists list cards view train test folders editlist
                   settings token help wishes — one file per screen.
                   help.js keeps the layout; help.en.js and help.fr.js
                   hold the prose.
     screens/importdialog.js  shared file-import dialog, opened by list,
                   cards, and editlist
  sw.js           offline cache
  test/*.test.js
```

Data lives on a separate `data` branch so saving a word does not redeploy the
site and does not clutter the code history.

## Rules that are easy to get wrong

- **Lists and progress are separate files with different merge rules.** Lists
  change rarely and conflict is resolved by asking the user. Progress changes
  constantly and merges automatically, per item, newest `lastSeen` wins. Never
  put them in one file; never apply one file's rule to the other.
- **Every card yields two independent progress items**, `<cardId>:f2b` and
  `<cardId>:b2f`. Reading and producing a word are different skills.
- **Card ids are permanent.** Editing a card's text keeps its id and its
  progress. Deleting a card orphans its progress items, which are pruned lazily.
- **Never write a token into a file in this repo.** The token lives only in
  browser storage. If one is ever committed, revoke it on GitHub immediately.
- **Writes to GitHub always carry the file's `sha`.** A rejected write is a
  conflict to resolve, never something to retry with force.
- **Every new module must be added to `SHELL` in `sw.js` and the cache name
  bumped.** Otherwise it is never cached, and the app breaks offline the
  moment the network is gone.
- **A screen never asks whether effects are on.** It calls `fx.js` or
  `audio.js` unconditionally and they no-op. `visualEffects` is on unless
  turned off, `audioEffects` off unless turned on, and the OS
  `prefers-reduced-motion` overrides the switch for travel animations but
  not for the colour flash. No `AudioContext` exists while sound is off.
  Only a wrong answer is flashed: a right one is already marked.
- **The language is per-device and the dictionaries must agree.** `lang`
  lives in `mq:settings` beside `theme` and is never synced. Every key in
  `i18n.en.js` must exist in `i18n.fr.js`; a test enforces it. A key used
  for grouping or in a URL — `Unfiled` in `folders.js` — is not a label:
  translate where it is drawn, never where it is compared.

## Working locally

```sh
python3 -m http.server 8000     # then open http://localhost:8000
npm test                        # vitest, pure modules only
```

Browsers refuse ES modules over `file://`, so the http server is required.

## Suggestions

The 🪄 button in the app writes free text to `data/suggestions.json` on the
`data` branch. Say **"let us review suggestions"** and the `suggestions`
skill (`.claude/skills/suggestions/SKILL.md`) reads it, does the work in a
worktree at `.data/`, records what was done in `data/suggestions-log.json`,
empties the box and pushes.

Additive work — a new list, more cards — proceeds on its own. Anything that
changes an existing card stops and asks, with a source for each proposed
change. Card ids never move, and `data/progress/` is never touched.

A GitHub Action on the `data` branch opens an issue when the box stops being
empty. It is the one workflow in this repo and it builds nothing: it only
reports that a file changed.

## Testing

Pure modules (`srs`, `grade`, `csv`, `merge`, `langs`, `stats`, `train`,
`sides`, `messages`) get real unit tests and are written test-first. Screens
are verified by using them; do not add a headless-browser suite.
