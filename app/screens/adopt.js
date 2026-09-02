import { el } from '../ui.js';
import { screen, settings, saveSettings, go, ctx, REPO } from '../app.js';
import { parseSetup, maskToken } from '../setup.js';

// The token is in the fragment, which main.js has already cut the query off
// of, so read it from the address bar directly.
function answered() {
  history.replaceState(null, '', `${location.pathname}${location.search}#/adopt`);
}

export function showAdopt() {
  const view = screen();
  // parseSetup also accepts a bare pasted token, which is right for the
  // Settings field but wrong here: this screen only ever reads a URL
  // fragment, so anything that isn't the setup-link query form — including
  // a bare '#/adopt' with no query at all — must read as "no token", not
  // as a token equal to the fragment text itself.
  const found = location.hash.startsWith('#/adopt?') ? parseSetup(location.hash) : null;

  view.append(el('h2', { text: 'Add this device?' }));

  if (!found) {
    view.append(el('p', { text: 'That link carried no token, so there is nothing to add.' }));
    view.append(el('p', { class: 'muted',
      text: 'Scan the code again, or paste the token by hand in Settings.' }));
    view.append(el('div', { class: 'actions' }, [
      el('a', { class: 'btn primary', href: '#/settings', text: 'Open Settings',
        onclick: answered }),
    ]));
    return;
  }

  const { token, expiry } = found;
  view.append(el('p', { text: 'A link has offered this device a token for saving your changes.' }));

  view.append(el('dl', { class: 'facts' }, [
    el('dt', { text: 'Repository' }), el('dd', { text: REPO }),
    el('dt', { text: 'Token' }), el('dd', { text: maskToken(token) }),
    el('dt', { text: 'Expires' }), el('dd', { text: expiry || 'not recorded' }),
  ]));

  view.append(el('p', { class: 'warn', text: 'Both devices will then use the same token. '
    + 'Revoking it later cuts off both of them, not just one.' }));

  view.append(el('div', { class: 'actions' }, [
    el('button', {
      class: 'primary', text: 'Save it on this device',
      onclick: () => {
        answered();
        saveSettings({ ...settings(), token, tokenExpiry: expiry });
        ctx.initSync();
        go('#/settings');
      },
    }),
    el('button', {
      text: 'No thanks',
      onclick: () => {
        answered();
        go('#/');
      },
    }),
  ]));
}
