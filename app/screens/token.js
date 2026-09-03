import { el, clear } from '../ui.js';
import { settings, saveSettings, REPO, screen, ctx, todayStr } from '../app.js';
import { tokenQr } from '../tokenshare.js';
import { TOKEN_PAGE, parseSetup, maskToken, expiryWarning } from '../setup.js';
import { t } from '../i18n.js';

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
    box.append(el('h4', { text: t('token.remove.confirmTitle') }));
    box.append(el('p', { class: 'muted', text: t('token.remove.confirmHint') }));
    box.append(el('div', { class: 'row' }, [
      el('button', { class: 'primary', text: t('token.remove.yes'), onclick: forget }),
      el('button', { text: t('token.remove.keep'), onclick: () => show() }),
    ]));
  };

  const show = () => {
    clear(box);
    box.append(el('h4', { text: t('token.remove.title') }));
    box.append(el('p', { class: 'muted' }, [t('token.remove.before'),
      el('a', { target: '_blank', rel: 'noopener',
        href: 'https://github.com/settings/personal-access-tokens',
        text: t('token.remove.linkText') }),
      t('token.remove.after')]));
    box.append(el('button', { text: t('token.remove.button'), onclick: confirm }));
  };

  show();
  return box;
}

// Two routes, each under its own heading, scanning first. Both used to sit
// under one "Make a token on GitHub" heading, which made the quick route —
// point this device's camera at one already set up — read as a footnote to
// the long one. On a phone it is the answer, so it goes first and says so.
function addToken(view, current) {
  view.append(el('p', { class: 'muted', text: t('token.add.hint') }));
  view.append(el('p', { class: 'muted', text: t('token.add.twoWays') }));

  view.append(section(t('token.add.scanHeading'), [
    el('p', { class: 'muted', text: t('token.add.scanHint') }),
    el('ol', { class: 'steps' }, [
      el('li', { text: t('token.add.step1') }),
      el('li', { text: t('token.add.step2') }),
    ]),
    el('p', { class: 'muted', text: t('token.add.scanNoCamera') }),
  ]));

  view.append(section(t('token.add.githubHeading'), [
    el('p', { class: 'muted' }, [t('token.add.noOther'),
      el('a', { target: '_blank', rel: 'noopener', href: TOKEN_PAGE,
        text: t('token.add.linkText') }),
      t('token.add.noOtherAfter')]),
    el('ul', { class: 'steps' }, [
      el('li', { text: t('token.add.repoStep', { repo: REPO }) }),
      el('li', { text: t('token.add.permStep') }),
      el('li', { text: t('token.add.expiryStep') }),
    ]),
    el('p', { class: 'muted', text: t('token.add.copyHint') }),
  ]));

  const token = el('input', { type: 'password', placeholder: t('token.save.placeholder') });
  const expiry = el('input', { type: 'date', value: current.tokenExpiry || '' });
  const problem = el('p', { class: 'warn' });

  view.append(section(t('token.save.heading'), [
    el('label', { class: 'field' }, [t('token.save.tokenLabel'), token]),
    el('label', { class: 'field' }, [t('token.save.expiryLabel'), expiry]),
    problem,
    el('button', {
      class: 'primary', text: t('token.save.button'),
      onclick: () => {
        const typed = token.value.trim();
        if (!typed) {
          problem.textContent = t('token.save.missing');
          return;
        }
        const found = parseSetup(typed);
        if (!found) {
          problem.textContent = t('token.save.invalid');
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

  view.append(section(t('token.have.heading'), [
    el('p', { class: 'muted', text: t('token.have.saved') }),
    el('dl', { class: 'facts' }, [
      el('dt', { text: t('common.repository') }), el('dd', { text: REPO }),
      el('dt', { text: t('common.token') }), el('dd', { text: maskToken(current.token) }),
      el('dt', { text: t('common.expires') }), el('dd', { text: current.tokenExpiry || t('common.notRecorded') }),
    ]),
    ...(warning ? [el('p', { class: 'warn', text: t(warning.key, warning.params) })] : []),
    el('p', { class: 'muted', text: t('token.have.hint') }),
  ]));

  view.append(section(t('token.another.heading'), [tokenQr(current)]));
  view.append(section(t('token.remove.section'), [revokeBox()]));
}

export function showToken() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/settings', class: 'back', text: t('token.back') }));
  view.append(el('h2', { text: t('token.title') }));

  if (current.token) haveToken(view, current);
  else addToken(view, current);
}
