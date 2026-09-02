import { el, clear } from '../ui.js';
import { store, settings, saveSettings, REPO, screen, ctx, todayStr } from '../app.js';
import { setStatus, statusLine } from '../status.js';
import { encode } from '../qr.js';
import { APP_URL, TOKEN_PAGE, setupLink, parseSetup, expiryWarning } from '../setup.js';

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
    const timer = setTimeout(() => { if (box.isConnected) show(); }, SHOW_FOR);

    clear(box);
    box.append(el('h4', { text: 'Scan this on the other device' }));
    box.append(qrCard(link, 'Opens the app and asks before saving',
      'A QR code carrying this device’s token'));
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

export function showSettings() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'Settings' }));

  if (!current.token) {
    view.append(section('Set up this device', [
      el('p', { class: 'muted', text: 'Right now this device can study, but not save changes.' }),
      el('ol', { class: 'steps' }, [
        el('li', { text: 'On a device that already works, open Settings and tap “Show token QR”.' }),
        el('li', { text: 'Point this device’s camera at it and open the link.' }),
      ]),
      el('p', { class: 'muted' }, [
        'No other device set up yet? ',
        el('a', { target: '_blank', rel: 'noopener',
          href: 'https://github.com/settings/personal-access-tokens/new',
          text: 'Create a token on GitHub' }),
        ` instead — repository access: only ${REPO}; permissions: Contents → Read and write.`,
      ]),
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
  const problem = el('p', { class: 'muted' });
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
      el('p', { class: 'muted', text: 'Point the new device’s camera at these. '
        + 'Neither one carries a secret.' }),
      el('div', { class: 'qr-pair' }, [
        qrCard(APP_URL, '1. Open the app', 'A QR code of the app’s address'),
        qrCard(TOKEN_PAGE, '2. Make it a token there',
          'A QR code of GitHub’s token page'),
      ]),
      el('p', { class: 'muted', text: 'The token is then created on the device that '
        + 'will hold it, and can be revoked on its own. A device you only study on '
        + 'needs no token at all — the first code is the whole of its setup.' }),
      tokenQr(current),
    ]));
  }

  view.append(section('About', [
    el('p', {}, [el('a', { href: '#/help', text: 'What Train and Test are for, and what the numbers mean' })]),
    el('p', { class: 'muted' }, [
      'MyQuizzlet · ',
      el('a', { href: `https://github.com/${REPO}`, target: '_blank', rel: 'noopener', text: 'source on GitHub' }),
    ]),
  ]));
}
