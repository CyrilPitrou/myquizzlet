import { el } from '../ui.js';
import { store, settings, saveSettings, REPO, screen, ctx, todayStr } from '../app.js';
import { statusLine } from '../status.js';
import { maskToken, expiryWarning } from '../setup.js';
import { toCsv } from '../csv.js';
import { zip, entryNames } from '../zip.js';
import { t } from '../i18n.js';

const THEMES = [{ id: 'paper', key: 'settings.theme.paper' },
                { id: 'study', key: 'settings.theme.study' },
                { id: 'focus', key: 'settings.theme.focus' }];

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
  }, [el('span', { class: `chip ${theme.id}` }), t(theme.key)])));
}

// One flag per row, each written straight into settings. The browse screen has
// its own Random order checkbox on the same key, so the two always agree.
function toggle(key, label) {
  return el('label', { class: 'opt' }, [
    el('input', { type: 'checkbox',
      ...(settings()[key] ? { checked: 'checked' } : {}),
      onchange: (event) => saveSettings({ ...settings(), [key]: event.target.checked }) }),
    label,
  ]);
}

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}

const csvFiles = (lists) => {
  const names = entryNames(lists.map((list) => ({ title: list.name, id: list.id })));
  return lists.map((list, i) => ({ name: names[i], text: toCsv(list.cards) }));
};

// The status line is the only thing here that says where sync stands; a second
// sentence counting dirty keys could disagree with it, and did. One button: it
// pulls, then pushes what needs pushing. Without a token the pull still works
// and the push is skipped; the Token section below says so.
function syncSection() {
  return section(t('settings.sync'), [
    statusLine(),
    el('div', { class: 'row' }, [
      el('button', { text: t('settings.syncNow'), onclick: () => ctx.sync.syncNow().then(ctx.render) }),
    ]),
  ]);
}

// Everything about the token, and one button in the same place in both states.
// The heading and the button never move; only the lines between them change,
// so there is no hunting for the way in.
function tokenSection(current) {
  const warning = expiryWarning(current.tokenExpiry, todayStr());

  return section(t('settings.token'), [
    ...(current.token
      ? [el('p', { class: 'muted', text: t('settings.token.saved') }),
        el('dl', { class: 'facts' }, [
          el('dt', { text: t('common.token') }), el('dd', { text: maskToken(current.token) }),
          el('dt', { text: t('common.expires') }), el('dd', { text: current.tokenExpiry || t('common.notRecorded') }),
        ]),
        ...(warning ? [el('p', { class: 'warn', text: t(warning.key, warning.params) })] : [])]
      : [el('p', { class: 'warn', text: t('settings.token.none') })]),
    el('p', {}, [el('a', { class: `btn${current.token ? '' : ' primary'}`,
      href: '#/token', text: t('settings.token.manage') })]),
  ]);
}

export function showSettings() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/', class: 'back', text: t('common.back.lists') }));
  view.append(el('h2', { text: t('settings.title') }));

  view.append(section(t('settings.appearance'), [
    themePicker(),
    el('p', { class: 'muted', text: t('settings.appearance.hint') }),
  ]));

  view.append(section(t('settings.options'), [
    el('div', { class: 'opts' }, [
      toggle('visualEffects', t('settings.visualEffects')),
      toggle('audioEffects', t('settings.audioEffects')),
      toggle('browseShuffle', t('settings.shuffleOnView')),
    ]),
  ]));

  view.append(syncSection());
  view.append(tokenSection(current));

  const exported = el('p', { class: 'muted' });

  view.append(section(t('settings.export'), [
    el('p', { class: 'muted', text: t('settings.export.hint') }),
    el('button', {
      text: t('settings.export.button'),
      onclick: () => {
        const files = csvFiles(store.listIds().map((id) => store.getList(id)).filter(Boolean));
        if (!files.length) {
          exported.textContent = t('settings.export.none');
          return;
        }
        const blob = new Blob([zip(files)], { type: 'application/zip' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'myquizzlet.zip' });
        a.click();
        URL.revokeObjectURL(a.href);
        const cards = files.reduce((total, file) => total + (file.text ? file.text.split('\n').length : 0), 0);
        exported.textContent = `${t('common.lists', { n: files.length })}, ${t('common.cards', { n: cards })}.`;
      },
    }),
    exported,
  ]));

  view.append(section(t('settings.about'), [
    el('p', {}, [el('a', { href: '#/help', text: t('settings.about.help') })]),
    el('p', { class: 'muted' }, [
      'MyQuizzlet · ',
      el('a', { href: `https://github.com/${REPO}`, target: '_blank', rel: 'noopener', text: t('settings.about.source') }),
    ]),
  ]));
}
