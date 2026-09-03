import { el } from '../ui.js';
import { store, settings, saveSettings, REPO, screen, ctx, todayStr } from '../app.js';
import { setStatus, statusLine } from '../status.js';
import { maskToken, expiryWarning } from '../setup.js';
import { toCsv } from '../csv.js';
import { zip, entryNames } from '../zip.js';

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

const waitingLine = (n) => (n === 0 ? 'Everything here is saved.'
  : `${n} change${n === 1 ? '' : 's'} waiting to be saved.`);

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}

const csvFiles = (lists) => {
  const names = entryNames(lists.map((list) => ({ title: list.name, id: list.id })));
  return lists.map((list, i) => ({ name: names[i], text: toCsv(list.cards) }));
};

// Pull works on a public repo without a token, so these buttons stay whatever
// the token situation is; only pushing needs one, and the Token section below
// says so.
function syncSection() {
  return section('Sync', [
    statusLine(),
    el('p', { class: 'muted', text: waitingLine(store.dirtyKeys().length) }),
    el('div', { class: 'row' }, [
      el('button', { text: 'Pull now', onclick: () => ctx.sync.pullAll().then(ctx.render).catch((e) => setStatus('error', e.message)) }),
      el('button', { text: 'Push now', onclick: () => ctx.sync.pushDirty().then(ctx.render).catch((e) => setStatus('error', e.message)) }),
      el('button', { text: 'Retry', onclick: () => ctx.sync.syncNow().then(ctx.render) }),
    ]),
  ]);
}

// Everything about the token, and one button in the same place in both states.
// The heading and the button never move; only the lines between them change,
// so there is no hunting for the way in.
function tokenSection(current) {
  const warning = expiryWarning(current.tokenExpiry, todayStr());

  return section('Token', [
    ...(current.token
      ? [el('p', { class: 'muted', text: 'Changes on this device are saved to GitHub.' }),
        el('dl', { class: 'facts' }, [
          el('dt', { text: 'Token' }), el('dd', { text: maskToken(current.token) }),
          el('dt', { text: 'Expires' }), el('dd', { text: current.tokenExpiry || 'not recorded' }),
        ]),
        ...(warning ? [el('p', { class: 'warn', text: warning })] : [])]
      : [el('p', { class: 'warn', text: 'Without a token, anything you add or change stays '
          + 'on this device. Studying works fine either way.' })]),
    el('p', {}, [el('a', { class: `btn${current.token ? '' : ' primary'}`,
      href: '#/token', text: 'Manage token' })]),
  ]);
}

export function showSettings() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'Settings' }));

  view.append(section('Appearance', [
    themePicker(),
    el('p', { class: 'muted', text: 'Only on this device. Your other devices keep their own.' }),
  ]));

  view.append(syncSection());
  view.append(tokenSection(current));

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
    el('p', {}, [el('a', { href: '#/help', text: 'What Train and Test are for, installing the app, adding a device' })]),
    el('p', { class: 'muted' }, [
      'MyQuizzlet · ',
      el('a', { href: `https://github.com/${REPO}`, target: '_blank', rel: 'noopener', text: 'source on GitHub' }),
    ]),
  ]));
}
