import { el } from '../ui.js';
import { store, settings, saveSettings, REPO, screen, ctx, todayStr } from '../app.js';
import { statusLine } from '../status.js';
import { maskToken, expiryWarning } from '../setup.js';
import { toCsv } from '../csv.js';
import { zip, entryNames } from '../zip.js';
import { t } from '../i18n.js';
import { openProfileDialog } from './profiledialog.js';
import { validateProfileName } from '../profiles.js';
import { isProfileLocked } from '../profilelock.js';
import { requestNewProfileLock, requestProfilePassword } from './profilelockdialog.js';

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
// `fallback` is what an absent key means — visual effects are on until you
// turn them off, sound is off until you turn it on.
function toggle(key, label, fallback = false) {
  const on = settings()[key] ?? fallback;
  return el('label', { class: 'opt' }, [
    el('input', { type: 'checkbox',
      ...(on ? { checked: 'checked' } : {}),
      onchange: (event) => saveSettings({ ...settings(), [key]: event.target.checked }) }),
    label,
  ]);
}

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}

function profileSection() {
  const profiles = store.getProfiles();
  const active = profiles.find((profile) => profile.id === store.getActiveProfile());

  const switchProfile = () => openProfileDialog({
    onSelect: () => { ctx.sync?.schedule(); ctx.render(); },
  });

  const changed = () => {
    ctx.sync?.schedule();
    ctx.render();
  };

  const renameProfile = async (profile) => {
    if (isProfileLocked(profile) && !(await requestProfilePassword(profile, {
      title: t('profile.renameTitle', { name: profile.name }),
      body: t('profile.managePassword', { name: profile.name }),
      confirmText: t('profile.continue'),
    }))) return;
    const name = prompt(t('profile.rename'), profile.name);
    if (name === null) return;
    const trimmed = name.trim();
    const error = validateProfileName(trimmed, profiles, profile.id);
    if (error === 'empty' || trimmed === profile.name) return;
    if (error === 'duplicate') return alert(t('profile.exists'));
    store.renameProfile(profile.id, trimmed);
    changed();
  };

  const protectProfile = async (profile) => {
    const lock = await requestNewProfileLock({
      title: t('profile.protectTitle', { name: profile.name }),
      body: t('profile.protectBody', { name: profile.name }),
    });
    if (!lock) return;
    store.setProfileLock(profile.id, lock);
    changed();
  };

  const changeProfilePassword = async (profile) => {
    if (!(await requestProfilePassword(profile, {
      title: t('profile.changePasswordTitle', { name: profile.name }),
      body: t('profile.managePassword', { name: profile.name }),
      confirmText: t('profile.continue'),
    }))) return;
    const lock = await requestNewProfileLock({
      title: t('profile.newPasswordTitle', { name: profile.name }),
      body: t('profile.newPasswordBody'),
      confirmText: t('profile.changePassword'),
    });
    if (!lock) return;
    store.setProfileLock(profile.id, lock);
    changed();
  };

  const deleteProfile = async (profile) => {
    if (!isProfileLocked(profile) || profiles.length <= 1) return;
    if (!(await requestProfilePassword(profile, {
      title: t('profile.deleteTitle', { name: profile.name }),
      body: t('profile.deleteWarning', { name: profile.name }),
      confirmText: t('profile.delete'),
      danger: true,
    }))) return;
    store.deleteProfile(profile.id);
    changed();
  };

  return section(t('profile.title'), [
    el('div', { class: 'row profile-current' }, [
      el('span', { class: 'profile-emoji', text: active?.emoji || '👤' }),
      el('span', { text: active ? active.name : t('profile.noProfile') }),
      el('button', { text: t('profile.switch'), onclick: switchProfile }),
    ]),
    el('details', { class: 'profile-manage' }, [
      el('summary', { text: t('profile.manage') }),
      el('div', { class: 'profile-manage-list' }, profiles.map((profile) => el('div', {
        class: 'row profile-manage-item',
      }, [
        el('span', { class: 'profile-emoji', text: profile.emoji }),
        el('span', { text: profile.name }),
        el('span', {
          class: 'profile-lock-state',
          text: isProfileLocked(profile) ? t('profile.protected') : t('profile.unprotected'),
        }),
        el('button', { text: t('profile.rename'), onclick: () => renameProfile(profile) }),
        ...(isProfileLocked(profile)
          ? [el('button', { text: t('profile.changePassword'),
            onclick: () => changeProfilePassword(profile) })]
          : [el('button', { class: 'primary', text: t('profile.protect'),
            onclick: () => protectProfile(profile) })]),
        el('button', {
          class: 'danger', text: t('profile.delete'),
          ...(profiles.length <= 1 || !isProfileLocked(profile) ? {
            disabled: 'disabled',
            title: profiles.length <= 1
              ? t('profile.lastCannotDelete') : t('profile.protectBeforeDelete'),
          } : {}),
          onclick: () => deleteProfile(profile),
        }),
      ]))),
    ]),
  ]);
}

const csvFiles = (lists) => {
  const names = entryNames(lists.map((list) => ({ title: list.name, id: list.id })));
  return lists.map((list, i) => ({ name: names[i], text: toCsv(list.cards) }));
};

// The status line is the only thing here that says where sync stands; a second
// sentence counting dirty keys could disagree with it, and did. One button: it
// pulls, then pushes what needs pushing. Without a token the pull still works
// and the push is skipped; the Token section below says so.
// A failure explains itself inside statusLine(), not here: setStatus replaces
// that node alone, and an explanation drawn around it would be painted before
// the first sync has even failed and never updated. What is left here is the
// one thing that cannot change while the page is on screen — whether there is
// a token at all — and the way to go and add one.
function syncSection(current) {
  return section(t('settings.sync'), [
    statusLine(),
    ...(!current.token
      ? [el('p', { class: 'muted', text: t('settings.sync.noToken') })] : []),
    el('div', { class: 'row' }, [
      el('button', { text: t('settings.syncNow'), onclick: () => ctx.sync.syncNow().then(ctx.render) }),
      ...(!current.token
        ? [el('a', { class: 'btn primary', href: '#/token', text: t('settings.token.manage') })] : []),
    ]),
  ]);
}

// Everything about the token, and one button in the same place in both states.
// The heading and the button never move; only the lines between them change,
// so there is no hunting for the way in.
//
// It states no opinion on whether changes are reaching GitHub. That is the
// status line's job one section up, and it is the only thing here that knows:
// this section is painted once, and it went on claiming "changes are saved to
// GitHub" directly beneath a sync that had just failed with a dead token.
function tokenSection(current) {
  const warning = expiryWarning(current.tokenExpiry, todayStr());

  return section(t('settings.token'), [
    ...(current.token
      ? [el('dl', { class: 'facts' }, [
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
      toggle('visualEffects', t('settings.visualEffects'), true),
      toggle('audioEffects', t('settings.audioEffects'), false),
      toggle('browseShuffle', t('settings.shuffleOnView'), false),
    ]),
  ]));

  view.append(syncSection(current));
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

  view.append(profileSection());

  view.append(section(t('settings.about'), [
    el('p', {}, [el('a', { href: '#/help', text: t('settings.about.help') })]),
    el('p', { class: 'muted' }, [
      'MyQuizzlet · ',
      el('a', { href: `https://github.com/${REPO}`, target: '_blank', rel: 'noopener', text: t('settings.about.source') }),
    ]),
  ]));
}
