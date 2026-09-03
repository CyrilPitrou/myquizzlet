# MyQuizzlet

A personal vocabulary trainer: word lists, flashcards, typed answers, and a
spaced-repetition scheduler that decides what you review and when. Runs in a
browser on the computer and on Android, with the same lists and the same progress
on both. Costs nothing to run.

**App:** https://cyrilpitrou.github.io/myquizzlet

---

## How it works, in one picture

Nothing is installed and no server is running anywhere. There are three copies of
your data:

1. **The app** — static files served by GitHub Pages. You open a URL.
2. **Your working copy** — kept by the browser on that device. Studying touches
   only this, which is why it is instant and works offline.
3. **The durable copy** — JSON files in this repo, on the `data` branch. The app
   pulls from it when it opens and pushes back after you make changes.

You never need to clone this repo to use the app. Clone it only to work on the
code or to hand-edit word lists in a text editor.

---

## First-time setup

Once, from the computer.

### 1. The repo and the site

1. Create a **public** repo `myquizzlet` under the `CyrilPitrou` account and push
   this code to `main`.
2. Create an empty `data` branch: `git switch --orphan data && git commit --allow-empty -m "data" && git push -u origin data`
3. In **Settings → Pages**, set the source to `main` / root. After a minute the
   site is live at `https://cyrilpitrou.github.io/myquizzlet`.

### 2. The token

The app needs permission to write your lists back. Reading needs nothing.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name it `myquizzlet`, expiry as long as offered.
3. **Repository access:** only `CyrilPitrou/myquizzlet`.
4. **Permissions:** *Contents* → **Read and write**. Nothing else.
5. Generate, and copy the token — GitHub shows it exactly once.
6. Open the app → **Settings → Token → Manage token** → paste it → Save.

Repeat step 6 on every device where you want to *add or edit* words, generating
that device's token on the device itself — GitHub's copy button puts it straight
on the clipboard, so there is nothing to type or transfer. A device that only
studies needs no token at all.

Tokens expire, at most a year out. The app records the expiry date you enter
and warns about it, on Home and on the Token page, for the last fortnight; once the
date passes it says so plainly and keeps your changes on the device until you
replace the token.

**Keep in mind:** the token lives in that browser's storage. It can only touch
this one repo, which holds nothing but vocabulary, so the worst case is a
vandalised word list. Never paste it into a file in this repo — if that ever
happens, revoke it on GitHub straight away and make a new one.

### Adding a second device

**Getting the app onto it.** On a device that already works, open **Help →
Adding another device**. It shows one QR code — the app's address, nothing secret.

1. Scan it on the new phone. The app opens in whatever browser that phone uses.
2. Open the app's own **Help → Installing the app**. It lists the route for each
   browser, because they all differ: Chrome shows an **Install this app**
   button, Firefox has **⋮ → Install**, Samsung Internet **≡ → Add page to →
   Home screen**, and an iPhone **Share → Add to Home Screen**.
3. From then on, open it from the home screen.

Only Chrome fires the event that lets a page offer its own install button. In
every other browser the app cannot ask, so the menu is the way in — which is
why the app lists the menus rather than pretending a button will appear.

Firefox for Android goes further and makes a *shortcut* rather than a real
app: it still works offline and behaves the same, but it opens inside Firefox
with the address bar, and it cannot tell the app it was installed. If the
**Install** section keeps appearing there, its **Already installed — hide
this** button settles it, per device. Want the real thing on Android? Install
it once from Chrome; the installed app then runs on its own whichever browser
you use day to day.

A device you only ever study on is now finished. It needs no token at all.

**Giving it a token, the safe way.** On the new device, open **Settings →
Token**, which says it has none, and press **Manage token**. With no token
saved that page links straight to GitHub's token page and says exactly what to
put in it: repository access limited to this one repo, and Contents → Read and
write. The token is made on the phone that will hold it, so it can be revoked on
its own.

**The quick way, if you accept the price.** On the device that already has a
token, the same page has an opt-in **Show token QR** button. It draws a link carrying this device's token; the
other phone's camera opens it, and the app asks before saving anything. Two
things to know before you use it: both devices then share one token, so
revoking it cuts off both, and the token is briefly on screen, so do it where
nobody is looking. The code hides itself again after a minute.

The app draws these codes itself and sends nothing to a QR service — a token
must never be handed to one. It reads no codes: your phone's own camera app
opens the link, so the app asks for no camera permission.

No camera to hand? The token field also accepts the whole setup link, pasted.

---

## Install on Android

1. Open the app URL in your browser.
2. **Help → Installing the app**. In Chrome that section has an **Install this app**
   button; in Firefox and the others it tells you which menu item to use.
   A page opened by scanning a QR code inside Chrome cannot install at all —
   **⋮ → Open in Chrome** first, then install there.
3. Launch it from the home screen icon.

Pick **Install** rather than a plain shortcut if Chrome offers both. Install
makes Android build a real package: the app gets its own icon in the app drawer
and the app switcher, opens fullscreen with no address bar, keeps working with no
signal, and is uninstalled like any other app. It is not from the Play Store and
does not need to be.

Long-press the icon for shortcuts straight into *Study due words* or *Add a
word*. A true home-screen widget is not possible for a web app — that needs a
native Android app — and is not planned.

### Adding another device

See **Adding a second device** above — scan one code, install, and a
study-only device is done.

## Install on the computer

Works fine as a normal browser tab. If you would rather have it in the dock:

- **Chrome:** the install icon at the right of the address bar → **Install**.
- **Safari:** File → **Add to Dock**.

Same app either way.

---

## Everyday use

**Make a list.** The **＋** in the header. Give it a title and, optionally, the
two side labels (Spanish, French, or whatever the two sides hold). The
languages are derived from those labels, and used to tune how accents are
handled when grading typed answers.

**Add words.** Three ways, use whichever suits the moment:

- Type them one at a time behind the list screen's **⋮ → Edit cards**. Best
  for the word you met an hour ago.
- Import a CSV: one row per card, first column the front, second the back.
- Edit `data/lists/<name>.json` directly on github.com or in a text editor. The
  app picks up the change on its next pull. Best for bulk work.

**Take a copy.** Settings → **Export all lists** downloads every list as a
CSV, packed into one zip. It is a plain copy for keeping or reading elsewhere;
the lists on GitHub remain the real ones.

**Study.** Home → *Test*. Pick a mode:

- **Flashcards** — see one side, reveal the other, say whether you knew it.
- **Write** — type the answer. Grading forgives case, accents, spacing, a leading
  article, and single-letter typos. If it still marks you wrong when you were
  right, tap **I was right** and it counts as correct.

Each card is learned in both directions independently, because recognising *el
pan* and producing it from *le pain* are genuinely different skills. Expect the
producing direction to lag; that is the app being honest, not broken.

**What comes back when.** Words move through five boxes. Get one right and it
comes back later — after 1, then 3, 7, 16, 35 days. Get it wrong and it drops to
the first box and returns tomorrow. Home shows how many are due.

---

## The sync indicator

A small dot, and it is worth knowing what it means:

| Dot | Meaning | What to do |
|---|---|---|
| Green | Everything is on GitHub | Nothing |
| Amber | Changes waiting to be pushed | Nothing; it goes on its own |
| Grey | Offline, changes queued | Nothing; it catches up when you reconnect |
| Red | A push failed | Open Settings → Sync, read the message, press *Retry* |

Red usually means the token expired or was revoked — remove it on **Settings →
Token → Manage token**, then make a new one and paste it
in. Your work is still safe in the browser meanwhile.

If you edited the same list on both devices while offline, the app shows both
versions and asks which one wins, rather than guessing. Study *progress* never
asks: it merges on its own, and the worst case is one word reviewed twice.

---

## Working on the code

```sh
python3 -m http.server 8000     # then open http://localhost:8000
npm install && npm test         # unit tests
```

The http server is needed because browsers refuse to load ES modules from
`file://`. There is no build step: what is in the repo is what runs, and pushing
to `main` deploys.

See `docs/` for how the pieces fit together, and `CLAUDE.md` for the rules the
code is meant to keep.
