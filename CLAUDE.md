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
   every time. No accounts, no multi-user, no roles, no i18n of the UI, no
   settings that exist "in case". YAGNI hard.
3. **Local-first.** A study session touches only browser storage. Network work
   happens outside the answer loop. The app must be fully usable offline.
4. **Data is plain JSON, editable by hand.** Anything that makes the files
   unreadable or requires the app to fix them up is wrong.

## Layout

```
main branch                          data branch
  index.html                           data/lists/<id>.json
  app/main.js     router + header      data/progress/<id>.json
     app.js        shared singletons: store, settings, go, todayStr,
                    screen, ctx. Screens import from here, never from
                    main.js, so nothing calls back up into the router.
     status.js     sync status indicator
     ui.js         shared DOM helpers
     store.js     browser-side state
     github.js    pull / push
     sync.js      pull/merge/push orchestration
     merge.js     pure. progress merge rule
     srs.js       pure. Leitner scheduling
     grade.js     pure. answer checking
     csv.js       pure. import / export
     langs.js     pure. column label → language code
     stats.js     pure. per-list numbers
     train.js     pure. training batches and rungs
     listform.js  shared list/card editing fields
     screens/     lists list cards view train test folders editlist
                   settings help — one file per screen
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

## Working locally

```sh
python3 -m http.server 8000     # then open http://localhost:8000
npm test                        # vitest, pure modules only
```

Browsers refuse ES modules over `file://`, so the http server is required.

## Testing

Pure modules (`srs`, `grade`, `csv`, `merge`, `langs`, `stats`, `train`) get
real unit tests and are written test-first. Screens are verified by using
them; do not add a headless-browser suite.
