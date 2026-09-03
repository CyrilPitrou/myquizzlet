import { el } from '../ui.js';
import { store, settings, saveSettings, REPO, screen, ctx } from '../app.js';
import { setStatus, statusLine } from '../status.js';
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

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}

const csvFiles = (lists) => {
  const names = entryNames(lists.map((list) => ({ title: list.name, id: list.id })));
  return lists.map((list, i) => ({ name: names[i], text: toCsv(list.cards) }));
};

// Pull works on a public repo without a token, so the buttons stay; only
// pushing needs one. Saying that here, where the waiting count is, is the
// point at which it actually matters.
function syncSection(current) {
  return section('Sync', [
    statusLine(),
    el('p', { class: 'muted', text: `${store.dirtyKeys().length} change(s) waiting.` }),
    ...(current.token
      ? [el('p', { class: 'muted' }, ['Saving to GitHub is set up. ',
          el('a', { href: '#/token', text: 'Token' }), '.'])]
      : [el('p', { class: 'warn', text: 'No token on this device, so changes stay here and '
          + 'are never saved. Studying works fine without one.' }),
        el('p', {}, [el('a', { class: 'btn primary', href: '#/token',
          text: 'Set up a token' })])]),
    el('div', { class: 'row' }, [
      el('button', { text: 'Pull now', onclick: () => ctx.sync.pullAll().then(ctx.render).catch((e) => setStatus('error', e.message)) }),
      el('button', { text: 'Push now', onclick: () => ctx.sync.pushDirty().then(ctx.render).catch((e) => setStatus('error', e.message)) }),
      el('button', { text: 'Retry', onclick: () => ctx.sync.syncNow().then(ctx.render) }),
    ]),
  ]);
}

export function showSettings() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'Settings' }));

  view.append(section('Appearance', [
    themePicker(),
    el('p', { class: 'muted', text: 'Stored on this device only — it is a preference, not data, so it never syncs.' }),
  ]));

  view.append(syncSection(current));

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
