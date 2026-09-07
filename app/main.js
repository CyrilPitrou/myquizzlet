import { $, clear, el, openDialog } from './ui.js';
import { ctx, settings, go, store, REPO } from './app.js';
import { setStatus, repaintStatus } from './status.js';
import { t, lang, setLang } from './i18n.js';
import { createGitHub } from './github.js';
import { createSync } from './sync.js';
import { showLists } from './screens/lists.js';
import { showList } from './screens/list.js';
import { showCards } from './screens/cards.js';
import { showTestSetup, showTestSession } from './screens/test.js';
import { showSettings, applyTheme } from './screens/settings.js';
import { showFolders, showFolder } from './screens/folders.js';
import { showNewList, showEditList } from './screens/editlist.js';
import { showView } from './screens/view.js';
import { showTrainSetup, showTrainSession } from './screens/train.js';
import { showHelp } from './screens/help.js';
import { onInstallChange } from './install.js';
import { showAdopt } from './screens/adopt.js';
import { forgetAdoption } from './adoption.js';
import { showToken } from './screens/token.js';
import { showWishes } from './screens/wishes.js';
import { openProfileDialog } from './screens/profiledialog.js';

function initSync() {
  ctx.sync?.stop();
  const { token } = settings();
  const github = createGitHub({ repo: REPO, branch: 'data', token });
  ctx.sync = createSync({
    store, github,
    onStatus: setStatus,
    onConflict: showConflict,
    canPush: Boolean(token),
  });
  // The first sync of a device pulls every list there is, which takes long
  // enough that the screen painted before it is stale by the time it lands.
  // Repaint when it does, or a phone that has just been given the repo shows
  // an empty Lists screen while the lists sit in storage behind it.
  ctx.sync.syncNow().then(repaintAfterSync);
}

function showConflict({ local, remote, resolve }) {
  let settled = false;
  const choose = (choice) => {
    if (settled) return;
    settled = true;
    dialog.close();
    resolve(choice);
  };
  const version = (heading, list) => el('section', { class: 'sect' }, [
    el('h3', { text: heading }),
    el('p', { text: t('sync.conflict.summary', {
      name: list.name || list.id,
      cards: (list.cards || []).length,
      updated: list.updatedAt || t('sync.conflict.unknownDate'),
    }) }),
    el('details', {}, [
      el('summary', { text: t('sync.conflict.details') }),
      el('pre', { text: JSON.stringify(list, null, 2) }),
    ]),
  ]);
  const dialog = openDialog([
    el('h2', { text: t('sync.conflict.title') }),
    el('p', { class: 'warn', text: t('sync.conflict.hint') }),
    version(t('sync.conflict.local'), local),
    version(t('sync.conflict.remote'), remote),
    el('div', { class: 'dialog-actions' }, [
      el('button', { text: t('sync.conflict.useRemote'), onclick: () => choose('remote') }),
      el('button', { class: 'primary', text: t('sync.conflict.useLocal'), onclick: () => choose('local') }),
    ]),
  ]);
  dialog.classList.add('conflict-dialog');
  // Sync cannot continue without a choice. Escape must not strand its promise.
  dialog.addEventListener('cancel', (event) => event.preventDefault());
}

function paintProfile() {
  const button = $('#profile-btn');
  if (!button) return;
  clear(button);
  const activeId = store.getActiveProfile();
  const profiles = store.getProfiles();
  const active = profiles.find((p) => p.id === activeId);
  if (active) {
    button.append(
      el('span', { class: 'profile-emoji', text: active.emoji }),
      el('span', { class: 'profile-name', text: active.name }),
    );
    button.title = `${t('profile.title')}: ${active.name}`;
    button.setAttribute('aria-label', `${t('profile.title')}: ${active.name}`);
  } else {
    button.append(el('span', { class: 'profile-emoji', text: '👤' }));
    button.title = t('profile.choose');
    button.setAttribute('aria-label', t('profile.choose'));
  }
}

// The button shows the flag of the language you are in — a status you can
// tap. Its title names the action, so the affordance is not left to the flag.
function paintLang() {
  const button = $('#lang');
  button.textContent = lang() === 'fr' ? '🇫🇷' : '🇬🇧';
  button.title = t('nav.lang');
  button.setAttribute('aria-label', t('nav.lang'));

  const more = $('#more-btn');
  more.title = t('nav.more');
  more.setAttribute('aria-label', t('nav.more'));

  const nav = { '#/new': 'nav.new', '#/folders': 'nav.folders',
                '#/': 'nav.lists', '#/wishes': 'nav.wishes',
                '#/settings': 'nav.settings', '#/help': 'nav.help' };
  for (const [href, key] of Object.entries(nav)) {
    const link = document.querySelector(`#topbar a[href="${href}"]`);
    if (!link) continue;
    link.title = t(key);
    link.setAttribute('aria-label', t(key));
    // A menu item writes into its label span, beside an icon that stays put.
    // A bare icon link has nothing to write into: its name is its title.
    const label = link.querySelector('.lbl');
    if (label) label.textContent = t(key);
    else if (!link.classList.contains('icon')) link.textContent = t(key);
  }
  const switchProfileBtn = $('#menu-switch-profile');
  if (switchProfileBtn) {
    switchProfileBtn.title = t('profile.switch');
    switchProfileBtn.setAttribute('aria-label', t('profile.switch'));
    const label = switchProfileBtn.querySelector('.lbl');
    if (label) label.textContent = t('profile.switch');
  }
  paintProfile();
  repaintStatus();
}

// The overflow menu. Open state lives in the DOM — nothing else needs to know
// about it — and every way out of the menu goes through closeMore().
function closeMore() {
  $('#more-menu').hidden = true;
  $('#more-btn').setAttribute('aria-expanded', 'false');
}

function toggleMore() {
  const menu = $('#more-menu');
  menu.hidden = !menu.hidden;
  $('#more-btn').setAttribute('aria-expanded', String(!menu.hidden));
}

function render() {
  // Following a menu item changes the hash, and the menu it was in must not
  // survive onto the screen it opened.
  closeMore();
  paintLang();
  const [path] = location.hash.split('?');
  $('#topbar').classList.toggle('session', /\/(train|test)\/[^/]+\/go$/.test(path));
  const [, route, arg, sub] = path.split('/');
  if (route !== 'adopt') forgetAdoption();
  if (route === 'list' && arg && sub === 'edit') showEditList(arg);
  else if (route === 'list' && arg && sub === 'cards') showCards(arg);
  else if (route === 'list' && arg) showList(arg);
  else if (route === 'study' && arg) go(`#/test/${arg}`);
  else if (route === 'test' && arg && sub === 'go') showTestSession(arg);
  else if (route === 'test' && arg) showTestSetup(arg);
  else if (route === 'train' && arg && sub === 'go') showTrainSession(arg);
  else if (route === 'train' && arg) showTrainSetup(arg);
  else if (route === 'new') showNewList();
  else if (route === 'view' && arg) showView(arg);
  else if (route === 'adopt') showAdopt();
  else if (route === 'wishes') showWishes();
  else if (route === 'settings') showSettings();
  else if (route === 'token') showToken();
  else if (route === 'help') showHelp();
  else if (route === 'folders') showFolders();
  else if (route === 'folder' && arg) showFolder(decodeURIComponent(arg));
  else showLists();
}

ctx.render = render;
ctx.initSync = initSync;

window.addEventListener('hashchange', render);

// Page load is not a reliable moment to sync on a phone: the app is kept
// alive in the background for days, so it can go that long without ever
// pulling, and an edit made just before the screen locks can outlive the 4s
// push debounce. Coming back to the app, or back online, is the real moment.
// Redraw afterwards so pulled changes are visible — but never mid-session,
// where a redraw would restart the round the user is in the middle of.
const repaintAfterSync = () => {
  if (!/\/(train|test)\/[^/]+\/go$/.test(location.hash.split('?')[0])) render();
};
const resync = () => { ctx.sync?.syncNow().then(repaintAfterSync); };
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resync();
});
window.addEventListener('online', resync);
$('#sync-dot').addEventListener('click', resync);
$('#profile-btn')?.addEventListener('click', () => {
  openProfileDialog({ onSelect: () => { ctx.sync?.schedule(); render(); } });
});
$('#lang').addEventListener('click', () => setLang(lang() === 'fr' ? 'en' : 'fr'));
$('#more-btn').addEventListener('click', (event) => { event.stopPropagation(); toggleMore(); });
$('#menu-switch-profile')?.addEventListener('click', () => {
  closeMore();
  openProfileDialog({ onSelect: () => { ctx.sync?.schedule(); render(); } });
});
// render() closes the menu on every navigation, but choosing the item for the
// screen you are already on changes no hash and so renders nothing.
$('#more-menu').addEventListener('click', closeMore);
document.addEventListener('click', (event) => {
  if (!$('#more-menu').hidden && !$('#more').contains(event.target)) closeMore();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || $('#more-menu').hidden) return;
  closeMore();
  $('#more-btn').focus();
});
// The browser's install offer can arrive while Help is already on screen,
// and installing removes the reason to show the section at all.
onInstallChange(() => { if (location.hash.startsWith('#/help')) render(); });
applyTheme(settings().theme);
initSync();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
