import { el } from '../ui.js';
import { store, settings, saveSettings, REPO, screen, ctx } from '../app.js';
import { setStatus, statusLine } from '../status.js';

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

  const token = el('input', { type: 'password', value: current.token || '', placeholder: 'github_pat_…' });
  const expiry = el('input', { type: 'date', value: current.tokenExpiry || '' });
  view.append(section('GitHub token', [
    el('p', { class: 'muted', text: 'Needed only to save changes. Studying works without one.' }),
    el('label', { class: 'field' }, ['Token', token]),
    el('label', { class: 'field' }, ['Expires on (from the GitHub page)', expiry]),
    el('button', {
      class: 'primary', text: 'Save token',
      onclick: () => {
        saveSettings({ ...settings(), token: token.value.trim(), tokenExpiry: expiry.value || null });
        ctx.initSync();
        ctx.render();
      },
    }),
  ]));

  view.append(section('About', [
    el('p', { class: 'muted' }, [
      'MyQuizzlet · ',
      el('a', { href: `https://github.com/${REPO}`, target: '_blank', rel: 'noopener', text: 'source on GitHub' }),
    ]),
  ]));
}
