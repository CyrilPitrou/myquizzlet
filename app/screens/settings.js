import { el, clear } from '../ui.js';
import { store, settings, saveSettings, REPO, screen, ctx, todayStr } from '../app.js';
import { setStatus, statusLine } from '../status.js';
import { encode } from '../qr.js';
import { APP_URL, TOKEN_PAGE, setupLink, parseSetup, expiryWarning } from '../setup.js';
import { toCsv } from '../csv.js';
import { zip, entryNames } from '../zip.js';
import { isInstalled, canInstall, promptInstall } from '../install.js';

const THEMES = [{ id: 'paper', name: 'Paper' }, { id: 'study', name: 'Study' },
                { id: 'focus', name: 'Focus' }];

export function applyTheme(id) {
  if (id && id !== 'paper') document.documentElement.dataset.theme = id;
  else delete document.documentElement.dataset.theme;
}

function themePicker() {
  const current = settings().theme || 'paper';
  return el('div', { class: 'themes' }, THEMES.map((theme) => el('button', {
    class: `theme${theme.id === current ? ' on' : ''}`,
    onclick: () => {
      saveSettings({ ...settings(), theme: theme.id });
      applyTheme(theme.id);
      ctx.render();
    },
  }, [el('span', { class: `chip ${theme.id}` }), theme.name])));
}

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}

// One <rect> per dark module inside a viewBox of modules, so the browser
// scales it and nothing has to know about pixels. Deliberately black on white
// in every theme, with the four-module quiet zone the standard asks for: this
// is an image meant for a camera, not a piece of the interface, and a scanner
// pointed at a dark theme is a scanner that fails. Those two colours are set
// here rather than in the stylesheet for exactly that reason.
function qrNode(text, label) {
  const matrix = encode(text);
  const size = matrix.length;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size + 8} ${size + 8}`);
  svg.setAttribute('class', 'qr');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);

  const ground = document.createElementNS(ns, 'rect');
  ground.setAttribute('width', String(size + 8));
  ground.setAttribute('height', String(size + 8));
  ground.setAttribute('fill', '#ffffff');
  svg.append(ground);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix[row][col]) continue;
      const cell = document.createElementNS(ns, 'rect');
      cell.setAttribute('x', String(col + 4));
      cell.setAttribute('y', String(row + 4));
      cell.setAttribute('width', '1');
      cell.setAttribute('height', '1');
      cell.setAttribute('fill', '#000000');
      svg.append(cell);
    }
  }
  return svg;
}

function qrCard(text, caption, label) {
  return el('figure', { class: 'qr-card' }, [qrNode(text, label),
    el('figcaption', { class: 'muted', text: caption })]);
}

const SHOW_FOR = 60_000;

// The token itself, on screen, as a link the other phone's camera can open.
// Boxed off and behind a button because it is the only secret this app ever
// displays, and hidden again on a timer so it does not sit there forgotten.
function tokenQr(current) {
  const box = el('div', { class: 'optin' });

  const reveal = () => {
    const link = setupLink({ token: current.token, expiry: current.tokenExpiry || null });
    // Built before clear(box): encode() can throw on an oversized payload,
    // and if it does the box must be left with its "Show token QR" button
    // still standing, not a bare heading with no way back.
    const card = qrCard(link, 'Opens the app and asks before saving',
      'A QR code carrying this device’s token');
    const timer = setTimeout(() => { if (box.isConnected) show(); }, SHOW_FOR);

    clear(box);
    box.append(el('h4', { text: 'Scan this on the other device' }));
    box.append(card);
    box.append(el('p', { class: 'muted', text: 'The other device will ask you to confirm '
      + 'before it saves anything. This code hides itself again in a minute.' }));
    box.append(el('button', { text: 'Hide it now',
      onclick: () => { clearTimeout(timer); show(); } }));
  };

  const show = () => {
    clear(box);
    box.append(el('h4', { text: 'Or copy this device’s token' }));
    box.append(el('p', { class: 'muted', text: 'Faster, and the honest price: both devices '
      + 'then share one token, so revoking it cuts off both. The token is briefly on '
      + 'screen, so do this where nobody is watching.' }));
    box.append(el('button', { text: 'Show token QR', onclick: reveal }));
  };

  show();
  return box;
}

const csvFiles = (lists) => {
  const names = entryNames(lists.map((list) => ({ title: list.name, id: list.id })));
  return lists.map((list, i) => ({ name: names[i], text: toCsv(list.cards) }));
};

export function showSettings() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'Settings' }));

  // Hidden once the browser says so, once a home-screen launch says so, or
  // once you have said so — the last because a Firefox shortcut says nothing.
  if (!isInstalled() && !current.installHidden) {
    view.append(section('Install', [
      el('p', { class: 'muted', text: 'This is running in a browser tab. Installing gives it a '
        + 'home-screen icon and its own window, and it keeps working with no signal.' }),
      ...(canInstall() ? [el('button', {
        class: 'primary', text: 'Install this app',
        // The offer is spent either way, so redraw if it fails: the button
        // must not sit there promising something it can no longer do.
        onclick: () => promptInstall().catch(() => ctx.render()),
      })] : []),
      el('p', { class: 'muted', text: canInstall()
        ? 'Nothing is downloaded from a store — the app is already here.'
        : 'No button? Only Chrome offers one. Every browser installs from its own menu:' }),
      ...(canInstall() ? [] : [el('ul', { class: 'steps' }, [
        el('li', { text: 'Firefox: ⋮ → Install, or Add to Home screen.' }),
        el('li', { text: 'Chrome: ⋮ → Install app. If the bar shows ✕ and no tabs, the page '
          + 'was opened by a scan — ⋮ → Open in Chrome first, then install there.' }),
        el('li', { text: 'Samsung Internet: ≡ → Add page to → Home screen.' }),
        el('li', { text: 'iPhone: Share → Add to Home Screen.' }),
      ])]),
      el('p', { class: 'muted', text: 'Firefox makes a shortcut rather than a real app: it '
        + 'still works offline, but it opens in Firefox and cannot announce itself as '
        + 'installed. Hide this section by hand once you have done it.' }),
      el('button', {
        text: 'Already installed — hide this',
        onclick: () => {
          saveSettings({ ...settings(), installHidden: true });
          ctx.render();
        },
      }),
    ]));
  }

  if (!current.token) {
    view.append(section('Set up this device', [
      el('p', { class: 'muted', text: 'Right now this device can study, but not save changes. '
        + 'It needs a token of its own, or a copy of another device’s.' }),
      el('ol', { class: 'steps' }, [
        el('li', { text: 'On a device that already works, open Settings and tap “Show token QR”.' }),
        el('li', { text: 'Point this device’s camera at it and open the link.' }),
      ]),
      el('p', { class: 'muted' }, ['No other device set up yet? Make this device its own token — ',
        el('a', { target: '_blank', rel: 'noopener', href: TOKEN_PAGE,
          text: 'open GitHub’s token page' }),
        ' and fill it in like this:']),
      el('ul', { class: 'steps' }, [
        el('li', { text: `Repository access: Only select repositories → ${REPO}.` }),
        el('li', { text: 'Permissions: Repository permissions → Contents → Read and write.' }),
        el('li', { text: 'Expiration: whatever you like — the app warns you a fortnight ahead.' }),
      ]),
      el('p', { class: 'muted', text: 'GitHub shows the token once. Copy it straight into the '
        + 'field below, and put its expiry date in beside it.' }),
    ]));
  }

  view.append(section('Appearance', [
    themePicker(),
    el('p', { class: 'muted', text: 'Stored on this device only — it is a preference, not data, so it never syncs.' }),
  ]));

  view.append(section('Sync', [
    statusLine(),
    el('p', { class: 'muted', text: `${store.dirtyKeys().length} change(s) waiting.` }),
    el('div', { class: 'row' }, [
      el('button', { text: 'Pull now', onclick: () => ctx.sync.pullAll().then(ctx.render).catch((e) => setStatus('error', e.message)) }),
      el('button', { text: 'Push now', onclick: () => ctx.sync.pushDirty().then(ctx.render).catch((e) => setStatus('error', e.message)) }),
      el('button', { text: 'Retry', onclick: () => ctx.sync.syncNow().then(ctx.render) }),
    ]),
  ]));

  const token = el('input', { type: 'password', value: current.token || '',
    placeholder: 'github_pat_… or a setup link' });
  const expiry = el('input', { type: 'date', value: current.tokenExpiry || '' });
  const problem = el('p', { class: 'warn' });
  const warning = expiryWarning(current.tokenExpiry, todayStr());

  view.append(section('GitHub token', [
    el('p', { class: 'muted', text: 'Needed only to save changes. Studying works without one.' }),
    ...(warning ? [el('p', { class: 'warn', text: warning })] : []),
    el('label', { class: 'field' }, ['Token, or a setup link from another device', token]),
    el('label', { class: 'field' }, ['Expires on (from the GitHub page)', expiry]),
    problem,
    el('button', {
      class: 'primary', text: 'Save token',
      onclick: () => {
        const typed = token.value.trim();
        if (!typed) {
          saveSettings({ ...settings(), token: '', tokenExpiry: null });
        } else {
          const found = parseSetup(typed);
          if (!found) {
            problem.textContent = 'That is neither a token nor a setup link.';
            return;
          }
          saveSettings({ ...settings(), token: found.token,
            tokenExpiry: found.expiry || expiry.value || null });
        }
        ctx.initSync();
        ctx.render();
      },
    }),
  ]));

  if (current.token) {
    view.append(section('Add a device', [
      el('p', { class: 'muted', text: 'Point the new device’s camera at this. '
        + 'It is only the app’s address and carries no secret.' }),
      el('div', { class: 'qr-pair' }, [
        qrCard(APP_URL, 'Install it on the new device', 'A QR code of the app’s address'),
      ]),
      el('ol', { class: 'steps' }, [
        el('li', { text: 'Scan it. The app opens in whatever browser that phone uses.' }),
        el('li', { text: 'Open its Settings → Install, which says how to install it in '
          + 'that particular browser.' }),
        el('li', { text: 'Open it from the home screen from now on.' }),
      ]),
      el('p', { class: 'muted', text: 'A device you only study on is now finished — it needs '
        + 'no token at all. To let it save changes too, either give it the code below, or open '
        + 'its Settings, where it will offer to make a token of its own.' }),
      tokenQr(current),
    ]));
  }

  const exported = el('p', { class: 'muted' });

  view.append(section('Export', [
    el('p', { class: 'muted', text: 'Every list as a CSV, in one zip. '
      + 'A plain copy you can keep, read anywhere, or import again.' }),
    el('button', {
      text: 'Export all lists',
      onclick: () => {
        const files = csvFiles(store.listIds().map((id) => store.getList(id)).filter(Boolean));
        if (!files.length) {
          exported.textContent = 'There are no lists to export yet.';
          return;
        }
        const blob = new Blob([zip(files)], { type: 'application/zip' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'myquizzlet.zip' });
        a.click();
        URL.revokeObjectURL(a.href);
        const cards = files.reduce((total, file) => total + (file.text ? file.text.split('\n').length : 0), 0);
        exported.textContent = `${files.length} list${files.length === 1 ? '' : 's'}, `
          + `${cards} card${cards === 1 ? '' : 's'}.`;
      },
    }),
    exported,
  ]));

  view.append(section('About', [
    el('p', {}, [el('a', { href: '#/help', text: 'What Train and Test are for, and what the numbers mean' })]),
    ...(current.installHidden && !isInstalled() ? [el('p', { class: 'muted' }, [
      el('a', {
        href: '#/settings', text: 'Show the install instructions again',
        onclick: () => { saveSettings({ ...settings(), installHidden: false }); ctx.render(); },
      }),
    ])] : []),
    el('p', { class: 'muted' }, [
      'MyQuizzlet · ',
      el('a', { href: `https://github.com/${REPO}`, target: '_blank', rel: 'noopener', text: 'source on GitHub' }),
    ]),
  ]));
}
