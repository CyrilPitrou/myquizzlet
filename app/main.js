import { $ } from './ui.js';
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
import { showToken } from './screens/token.js';
import { showWishes } from './screens/wishes.js';

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
  ctx.sync.syncNow();
}

// Temporary until a real conflict screen exists.
function showConflict({ listId, resolve }) {
  console.warn(`conflict on ${listId} — keeping the local copy`);
  resolve('local');
}

// The button shows the flag of the language you are in — a status you can
// tap. Its title names the action, so the affordance is not left to the flag.
function paintLang() {
  const button = $('#lang');
  button.textContent = lang() === 'fr' ? '🇫🇷' : '🇬🇧';
  button.title = t('nav.lang');
  button.setAttribute('aria-label', t('nav.lang'));

  const nav = { '#/new': 'nav.new', '#/folders': 'nav.folders',
                '#/': 'nav.lists', '#/wishes': 'nav.wishes',
                '#/settings': 'nav.settings', '#/help': 'nav.help' };
  for (const [href, key] of Object.entries(nav)) {
    const link = document.querySelector(`#topbar a[href="${href}"]`);
    if (!link) continue;
    link.title = t(key);
    link.setAttribute('aria-label', t(key));
    if (!link.classList.contains('icon')) link.textContent = t(key);
  }
  repaintStatus();
}

function render() {
  paintLang();
  const [path] = location.hash.split('?');
  $('#topbar').classList.toggle('session', /\/(train|test)\/[^/]+\/go$/.test(path));
  const [, route, arg, sub] = path.split('/');
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
const resync = () => {
  ctx.sync?.syncNow().then(() => {
    if (!/\/(train|test)\/[^/]+\/go$/.test(location.hash.split('?')[0])) render();
  });
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resync();
});
window.addEventListener('online', resync);
$('#sync-dot').addEventListener('click', resync);
$('#lang').addEventListener('click', () => setLang(lang() === 'fr' ? 'en' : 'fr'));
// The browser's install offer can arrive while Help is already on screen,
// and installing removes the reason to show the section at all.
onInstallChange(() => { if (location.hash.startsWith('#/help')) render(); });
applyTheme(settings().theme);
initSync();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
