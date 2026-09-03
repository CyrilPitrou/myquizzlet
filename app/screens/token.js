import { el, clear } from '../ui.js';
import { settings, saveSettings, REPO, screen, ctx, todayStr } from '../app.js';
import { tokenQr } from '../tokenshare.js';
import { TOKEN_PAGE, parseSetup, maskToken, expiryWarning } from '../setup.js';

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}

// Two clicks, because the token is not recoverable from here: whoever wrote it
// down is the only copy left, and on a device sharing another's token there is
// no "make a new one" that does not go back through the other device.
function revokeBox() {
  const box = el('div', { class: 'optin' });

  const forget = () => {
    saveSettings({ ...settings(), token: '', tokenExpiry: null });
    ctx.initSync();
    ctx.render();
  };

  const confirm = () => {
    clear(box);
    box.append(el('h4', { text: 'Really remove it?' }));
    box.append(el('p', { class: 'muted', text: 'This device goes back to studying only, and '
      + 'anything not yet pushed stays here until you give it a token again.' }));
    box.append(el('div', { class: 'row' }, [
      el('button', { class: 'primary', text: 'Yes, remove it', onclick: forget }),
      el('button', { text: 'Keep it', onclick: () => show() }),
    ]));
  };

  const show = () => {
    clear(box);
    box.append(el('h4', { text: 'Remove this token' }));
    box.append(el('p', { class: 'muted' }, ['Removing it here only forgets it on this device. '
      + 'The token itself stays alive on GitHub until you delete it there — ',
      el('a', { target: '_blank', rel: 'noopener',
        href: 'https://github.com/settings/personal-access-tokens',
        text: 'your tokens on GitHub' }),
      '. Do that too if the token has leaked, or if another device is using this same one.']));
    box.append(el('button', { text: 'Revoke token', onclick: confirm }));
  };

  show();
  return box;
}

function addToken(view, current) {
  view.append(section('Make a token on GitHub', [
    el('p', { class: 'muted', text: 'Right now this device can study, but not save changes. '
      + 'It needs a token of its own, or a copy of another device’s.' }),
    el('ol', { class: 'steps' }, [
      el('li', { text: 'On a device that already works, open Settings → Token and tap '
        + '“Show token QR”.' }),
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

  const token = el('input', { type: 'password', placeholder: 'github_pat_… or a setup link' });
  const expiry = el('input', { type: 'date', value: current.tokenExpiry || '' });
  const problem = el('p', { class: 'warn' });

  view.append(section('Save it here', [
    el('label', { class: 'field' }, ['Token, or a setup link from another device', token]),
    el('label', { class: 'field' }, ['Expires on (from the GitHub page)', expiry]),
    problem,
    el('button', {
      class: 'primary', text: 'Save token',
      onclick: () => {
        const typed = token.value.trim();
        if (!typed) {
          problem.textContent = 'Paste the token first.';
          return;
        }
        const found = parseSetup(typed);
        if (!found) {
          problem.textContent = 'That is neither a token nor a setup link.';
          return;
        }
        saveSettings({ ...settings(), token: found.token,
          tokenExpiry: found.expiry || expiry.value || null });
        ctx.initSync();
        ctx.render();
      },
    }),
  ]));
}

function haveToken(view, current) {
  const warning = expiryWarning(current.tokenExpiry, todayStr());

  view.append(section('This device’s token', [
    el('p', { class: 'muted', text: 'Changes made here are saved to GitHub.' }),
    el('dl', { class: 'facts' }, [
      el('dt', { text: 'Repository' }), el('dd', { text: REPO }),
      el('dt', { text: 'Token' }), el('dd', { text: maskToken(current.token) }),
      el('dt', { text: 'Expires' }), el('dd', { text: current.tokenExpiry || 'not recorded' }),
    ]),
    ...(warning ? [el('p', { class: 'warn', text: warning })] : []),
    el('p', { class: 'muted', text: 'Expired or about to? Remove it below, then make a new '
      + 'one on GitHub the same way you made this one.' }),
  ]));

  view.append(section('Another device', [tokenQr(current)]));
  view.append(section('Remove', [revokeBox()]));
}

export function showToken() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/settings', class: 'back', text: '← Settings' }));
  view.append(el('h2', { text: 'Token' }));

  if (current.token) haveToken(view, current);
  else addToken(view, current);
}
