# Sync

## What happens when

- **On open** — pull every list and progress file from the `data` branch, merge
  into the working copy.
- **After a change** — wait a few seconds for edits to settle, then push what
  changed. Never during the answer loop.
- **Offline** — queue the pushes and flush them when the network returns.

Every write sends the `sha` of the version it is replacing. GitHub rejects the
write if that version is no longer current, so a stale device cannot silently
overwrite a fresher one. A rejection is a conflict to resolve — never something
to retry with force.

## Merge rules

They differ per file kind, and this matters.

**Lists.** A conflict means you edited the same list on two devices while at
least one was offline. Rare, and meaningful when it happens. The app shows both
versions and asks which wins. It does not merge card-by-card behind your back —
guessing here would quietly lose real work.

**Progress.** Merged automatically, item by item, keeping whichever record has
the later `lastSeen`. Deterministic, silent, and never interrupts a session. The
worst case is one word coming back a day early.

## The status indicator

| State | Meaning | Action |
|---|---|---|
| Green | Everything is on GitHub | None |
| Amber | Changes waiting to push | None; it happens on its own |
| Grey | Offline, changes queued | None; catches up on reconnect |
| Red | A push failed | Settings → read the message → *Synchronise now* |

Failure must always be visible. A silent sync failure that eats a week of edits
is the worst outcome this design guards against; a red dot and a working retry
are the guard.

## Auth

One fine-grained token, scoped to `CyrilPitrou/myquizzlet`, Contents read+write,
nothing else. Stored in browser storage on each device that edits. Never written
to a file in the repo.

A second device gets a token one of two ways: making its own (two public QR
codes, the app's address and GitHub's token page — neither carries a secret),
or adopting this device's over a link. That link lands on `#/adopt`,
which names the repository, the masked token and the expiry, and saves the
token only if the person there says yes. A shared token is plainly one token:
revoking it cuts off both devices, not just the one you meant. The fragment
(`#...`) of a URL is never sent to a server, so this route does not hand the
token to GitHub Pages — the browser keeps it local, and only the app's own
code, running in that browser, ever reads it.

With no token the app is read-only against the public files — so a study-only
device needs no setup, and a revoked token degrades the app rather than breaking
it.

Red usually means an expired or revoked token. Make a new one, paste it in
Settings; the queued changes then push. Nothing is lost in the meantime, because
the working copy is still in the browser.

## Cache staleness

Files fetched from the Pages URL sit behind a CDN and can be a few minutes old.
When a token is present the app reads through the GitHub API instead, which is
always current and also returns the `sha` needed for safe writes. The stale path
only applies to a token-less, read-only device, where a few minutes does not
matter.
