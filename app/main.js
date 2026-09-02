import { $ } from './ui.js';
import { ctx, settings, go, store, REPO } from './app.js';
import { setStatus } from './status.js';
import { createGitHub } from './github.js';
import { createSync } from './sync.js';
import { showLists } from './screens/lists.js';
import { showList } from './screens/list.js';
import { showTestSetup, showTestSession } from './screens/test.js';
import { showSettings, applyTheme } from './screens/settings.js';
import { showFolders, showFolder } from './screens/folders.js';
import { showNewList, showEditList } from './screens/editlist.js';

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

function render() {
  const [path] = location.hash.split('?');
  $('#topbar').classList.toggle('session', /\/(train|test)\/[^/]+\/go$/.test(path));
  const [, route, arg, sub] = path.split('/');
  if (route === 'list' && arg && sub === 'edit') showEditList(arg);
  else if (route === 'list' && arg) showList(arg);
  else if (route === 'study' && arg) go(`#/test/${arg}`);
  else if (route === 'test' && arg && sub === 'go') showTestSession(arg);
  else if (route === 'test' && arg) showTestSetup(arg);
  else if (route === 'new') showNewList();
  else if (route === 'settings') showSettings();
  else if (route === 'folders') showFolders();
  else if (route === 'folder' && arg) showFolder(decodeURIComponent(arg));
  else showLists();
}

ctx.render = render;
ctx.initSync = initSync;

window.addEventListener('hashchange', render);
applyTheme(settings().theme);
initSync();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
