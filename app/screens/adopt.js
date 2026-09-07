import { el } from '../ui.js';
import { screen, settings, saveSettings, go, ctx, REPO } from '../app.js';
import { maskToken } from '../setup.js';
import { adoptionFromHash, forgetAdoption } from '../adoption.js';
import { t } from '../i18n.js';

// The token is in the fragment, which main.js has already cut the query off
// of, so read it from the address bar directly. Strip it immediately, once,
// on arrival — not per button — so it never sits in the address bar or in
// history waiting for a nav link or a Back press to bring it back.
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
  const arrivedWithToken = location.hash.startsWith('#/adopt?');
  const found = adoptionFromHash(location.hash);
  if (arrivedWithToken) answered();
  // The token lives in memory now; it need not stay in the URL. Keeping it in
  // memory also makes a sync-triggered repaint show the same question instead
  // of claiming, a moment later, that the link carried no token.

  view.append(el('h2', { text: t('adopt.title') }));

  if (!found) {
    view.append(el('p', { text: t('adopt.noToken') }));
    view.append(el('p', { class: 'muted', text: t('adopt.noToken.hint') }));
    view.append(el('div', { class: 'actions' }, [
      el('a', { class: 'btn primary', href: '#/token', text: t('adopt.openToken') }),
    ]));
    return;
  }

  const { token, expiry } = found;
  view.append(el('p', { text: t('adopt.offer') }));

  view.append(el('dl', { class: 'facts' }, [
    el('dt', { text: t('common.repository') }), el('dd', { text: REPO }),
    el('dt', { text: t('common.token') }), el('dd', { text: maskToken(token) }),
    el('dt', { text: t('common.expires') }), el('dd', { text: expiry || t('common.notRecorded') }),
  ]));

  view.append(el('p', { class: 'warn', text: t('adopt.warn') }));

  view.append(el('div', { class: 'actions' }, [
    el('button', {
      class: 'primary', text: t('adopt.save'),
      onclick: () => {
        saveSettings({ ...settings(), token, tokenExpiry: expiry });
        forgetAdoption();
        ctx.initSync();
        go('#/token');
      },
    }),
    el('button', {
      text: t('adopt.decline'),
      onclick: () => {
        forgetAdoption();
        go('#/');
      },
    }),
  ]));
}
