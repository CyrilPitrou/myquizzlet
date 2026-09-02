# Architecture

## Three copies of the data

| Copy | Lives in | Changes when | Job |
|---|---|---|---|
| The app | GitHub Pages, `main` branch | You push code | Serve the HTML/JS |
| Working copy | Browser storage, per device | Every answer, every edit | Make the app instant and offline-capable |
| Durable copy | `data` branch of the repo | A few seconds after edits settle | Be the truth both devices agree on |

A study session touches **only** the working copy. Network work happens outside
the answer loop, never inside it. This is the single most important property of
the design: it is what makes the app usable on a train, and what stops a flaky
connection from ruining a session.

Data sits on a separate `data` branch so that saving a word does not redeploy the
site and does not fill the code history with vocabulary commits.

## Modules

Each is one file with one job.

```
main.js     the router. Reads the hash, calls the matching screen, owns the
            header. The only module that wires the other modules together.
app.js      shared singletons: store, settings, go, todayStr, screen, ctx.
            Screens reach the router and the sync engine through ctx, so no
            screen imports main.js back.
status.js   the sync status indicator.
ui.js       shared DOM helpers: el, menu, swipeable.
store.js    the working copy. The only module that touches browser storage.
github.js   the network. Pull, push, status. Knows nothing about cards.
sync.js     pull/merge/push orchestration.
merge.js    pure. The progress merge rule: newest lastSeen wins, per item.
srs.js      pure. Which items are due, and where an answer moves an item.
grade.js    pure. Is this typed answer right?
csv.js      pure. Text in, cards out, and back.
langs.js    pure. A column label ("Français") to a language code.
stats.js    pure. The numbers on a list: learned %, right %, due.
train.js    pure. Training batches: pickBatch, choices, the two-rung queue.
listform.js the name/folder/label/language fields shared by editlist and
            the CSV import in cards.
screens/    one file per screen — lists, list, cards, view, train, test,
            folders, editlist, settings, help — each exporting a `show*`
            function that renders into `screen()`.
```

The dependency direction is one-way: screens use the pure modules and
`app.js`; `store` uses `github`; the pure modules use nothing. Nothing calls
back upward — a screen never imports `main.js`.

The pure modules hold everything subtle in the app. They take their inputs
as arguments — including today's date, so tests can time-travel — and return
values. That is what makes the test suite both small and worth having.

## Why no framework

The app is a handful of screens with little shared state. A framework would add a build
step, a dependency tree, and a deploy pipeline, in exchange for saving DOM
updates that are a few dozen lines here. The cost lands later, when the toolchain
needs attention for a tool that was supposed to need none. `git push` deploying
directly is a feature worth protecting.

The trade is real: screen code updates the DOM by hand and will not scale
gracefully past a certain size. If `main.js` grows unwieldy, split it by screen
before reaching for a framework.

## Where to add things

- A new study mode → a screen in `screens/`, wired into the router in
  `main.js`, reading the same queue from `srs.js` or the batches from
  `train.js`.
- A new card field → `data-model.md`, `store.js`, the list screen. Nothing else
  should need to know.
- A different scheduler → `srs.js` alone, if its two functions keep their shape.
