import { el, clear, $ } from './ui.js';
import { createStore } from './store.js';
import { parseCards, toCsv } from './csv.js';
import { buildQueue, newItem, nextItem, parseKey } from './srs.js';
import { grade } from './grade.js';
import { createGitHub } from './github.js';
import { createSync } from './sync.js';

const store = createStore(localStorage);

const REPO = 'CyrilPitrou/myquizzlet';
const settings = () => JSON.parse(localStorage.getItem('mq:settings') || '{}');
const saveSettings = (next) => localStorage.setItem('mq:settings', JSON.stringify(next));

function setStatus(state, detail = '') {
  const dot = $('#sync-dot');
  const marks = { synced: '●', pending: '◐', offline: '◌', error: '✕', off: '○' };
  const titles = {
    synced: 'everything is on GitHub', pending: 'changes waiting to push',
    offline: 'offline — will catch up', error: `sync failed: ${detail}`,
    off: 'no token — read-only',
  };
  dot.textContent = marks[state];
  dot.className = `dot ${state}`;
  dot.title = titles[state];
}

let sync = null;
function initSync() {
  const { token } = settings();
  const github = createGitHub({ repo: REPO, branch: 'data', token });
  sync = createSync({
    store, github,
    onStatus: setStatus,
    onConflict: showConflict,
    canPush: Boolean(token),
  });
  sync.syncNow();
}

// Temporary until Task 11 replaces it with a real screen.
function showConflict({ listId, resolve }) {
  console.warn(`conflict on ${listId} — keeping the local copy`);
  resolve('local');
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function dueCount(listId) {
  const list = store.getList(listId);
  const queue = buildQueue({
    list, progress: store.getProgress(listId), directions: ['f2b', 'b2f'],
    today: todayStr(), limit: Infinity, includeNew: true, shuffle: (xs) => xs,
  });
  return new Set(queue.map((key) => parseKey(key).cardId)).size;
}

function go(hash) {
  location.hash = hash;
}

function screen() {
  const node = $('#screen');
  clear(node);
  return node;
}

function showHome() {
  const view = screen();
  const { tokenExpiry } = settings();
  if (tokenExpiry) {
    const days = Math.round((new Date(tokenExpiry) - new Date()) / 86400000);
    if (days <= 14) {
      view.append(el('p', { class: 'warn' }, [
        days < 0 ? 'Your GitHub token has expired — changes are not being saved. '
                 : `Your GitHub token expires in ${days} day(s). `,
        el('a', { href: '#/settings', text: 'Renew it' }),
      ]));
    }
  }
  view.append(el('h2', { text: 'Lists' }));
  const ids = store.listIds();
  if (ids.length === 0) {
    view.append(el('p', { class: 'empty', text: 'No lists yet. Create one below.' }));
  }
  for (const id of ids) {
    const list = store.getList(id);
    const due = dueCount(id);
    view.append(el('div', { class: 'row' }, [
      el('a', { href: `#/list/${id}`, text: list.name }),
      el('span', { class: 'muted', text: `${list.cards.length} cards` }),
      el('span', { class: due ? 'badge' : 'muted', text: due ? `${due} due` : '—' }),
      el('a', { class: 'btn', href: `#/study/${id}`, text: 'Study' }),
    ]));
  }
  const name = el('input', { placeholder: 'New list name', id: 'new-list-name' });
  view.append(el('form', {
    class: 'newlist',
    onsubmit: (e) => {
      e.preventDefault();
      if (!name.value.trim()) return;
      const list = store.createList({ name: name.value.trim() });
      sync?.schedule();
      go(`#/list/${list.id}`);
    },
  }, [name, el('button', { type: 'submit', text: 'Create list' })]));
}

function showList(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: list.name }));

  const front = el('input', { placeholder: 'front (e.g. el pan)' });
  const back = el('input', { placeholder: 'back (e.g. le pain)' });
  view.append(el('form', {
    class: 'addcard',
    onsubmit: (e) => {
      e.preventDefault();
      if (!front.value.trim() || !back.value.trim()) return;
      store.addCards(id, [{ front: front.value.trim(), back: back.value.trim() }]);
      sync?.schedule();
      front.value = '';
      back.value = '';
      render();
      front.focus();
    },
  }, [front, back, el('button', { type: 'submit', text: 'Add' })]));

  const table = el('table', { class: 'cards' });
  for (const card of list.cards) {
    table.append(el('tr', {}, [
      el('td', {}, [editableCell(id, card, 'front')]),
      el('td', {}, [editableCell(id, card, 'back')]),
      el('td', {}, [el('button', {
        class: 'link', text: '✕', title: 'delete',
        onclick: () => { store.deleteCard(id, card.id); sync?.schedule(); render(); },
      })]),
    ]));
  }
  view.append(table);
  view.append(importExport(id));
}

function editableCell(listId, card, side) {
  return el('input', {
    value: card[side],
    onchange: (e) => {
      store.updateCard(listId, card.id, { [side]: e.target.value.trim() });
      sync?.schedule();
    },
  });
}

function importExport(listId) {
  const box = el('textarea', {
    placeholder: 'Paste rows: el pan, le pain — one card per line. Tabs work too.',
    rows: '4',
  });
  const status = el('p', { class: 'muted' });
  const doImport = () => {
    const { cards, errors } = parseCards(box.value);
    if (cards.length) { store.addCards(listId, cards); sync?.schedule(); }
    box.value = '';
    status.textContent = errors.length
      ? `Imported ${cards.length}. Skipped lines: ${errors.map((e) => e.line).join(', ')}.`
      : `Imported ${cards.length}.`;
    render();
    $('#import-status')?.replaceWith(status);
  };
  const file = el('input', {
    type: 'file', accept: '.csv,.txt,text/csv',
    onchange: async (e) => {
      const chosen = e.target.files[0];
      if (!chosen) return;
      box.value = await chosen.text();
      doImport();
    },
  });
  const exportLink = el('button', {
    text: 'Export CSV',
    onclick: () => {
      const list = store.getList(listId);
      const blob = new Blob([toCsv(list.cards)], { type: 'text/csv' });
      const a = el('a', { href: URL.createObjectURL(blob), download: `${listId}.csv` });
      a.click();
      URL.revokeObjectURL(a.href);
    },
  });
  status.id = 'import-status';
  return el('details', { class: 'io' }, [
    el('summary', { text: 'Import / export' }),
    box,
    el('div', { class: 'row' }, [
      el('button', { text: 'Import pasted text', onclick: doImport }),
      file,
      exportLink,
    ]),
    status,
  ]);
}

const setup = { mode: 'write', directions: ['f2b', 'b2f'], limit: 20, includeNew: true, free: false };

function showSetup(listId) {
  const list = store.getList(listId);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: `Study: ${list.name}` }));

  const radio = (name, value, label, checked) => el('label', { class: 'opt' }, [
    el('input', { type: 'radio', name, value, ...(checked ? { checked: 'checked' } : {}) }),
    label,
  ]);

  const modes = el('div', { class: 'opts' }, [
    radio('mode', 'write', 'Write (type the answer)', setup.mode === 'write'),
    radio('mode', 'cards', 'Flashcards', setup.mode === 'cards'),
  ]);
  const dirs = el('div', { class: 'opts' }, [
    radio('dir', 'both', 'Both directions', setup.directions.length === 2),
    radio('dir', 'f2b', `${list.name}: front → back`, setup.directions.join() === 'f2b'),
    radio('dir', 'b2f', 'back → front', setup.directions.join() === 'b2f'),
  ]);
  const limit = el('input', { type: 'number', min: '5', max: '100', step: '5', value: String(setup.limit) });

  view.append(el('h3', { text: 'Mode' }), modes, el('h3', { text: 'Direction' }), dirs,
    el('h3', { text: 'Cards this session' }), limit);

  const free = el('input', { type: 'checkbox', ...(setup.free ? { checked: 'checked' } : {}) });
  view.append(el('label', { class: 'opt' }, [free, 'Free review (everything, does not affect scheduling)']));

  view.append(el('button', {
    class: 'primary', text: 'Start',
    onclick: () => {
      setup.mode = modes.querySelector('input:checked').value;
      const dir = dirs.querySelector('input:checked').value;
      setup.directions = dir === 'both' ? ['f2b', 'b2f'] : [dir];
      setup.limit = Math.min(100, Math.max(5, Number(limit.value) || 20));
      setup.free = free.checked;
      startSession(listId);
    },
  }));
}

let session = null;

function startSession(listId) {
  const list = store.getList(listId);
  const progress = store.getProgress(listId);
  const queue = setup.free
    ? buildQueue({ list, progress: { items: {} }, directions: setup.directions,
                   today: todayStr(), limit: setup.limit, includeNew: true })
    : buildQueue({ list, progress, directions: setup.directions,
                   today: todayStr(), limit: setup.limit, includeNew: setup.includeNew });
  if (queue.length === 0) {
    alert('Nothing due in this list right now. Add cards, or come back tomorrow.');
    return;
  }
  session = { listId, queue, at: 0, right: 0, wrong: 0, free: setup.free };
  go(`#/session/${listId}`);
}

function answer(correct) {
  if (session.free) { session[correct ? 'right' : 'wrong'] += 1; session.at += 1; return render(); }
  const { listId, queue, at } = session;
  const key = queue[at];
  const progress = store.getProgress(listId);
  const previous = progress.items[key] || newItem(todayStr());
  progress.items[key] = nextItem(previous, correct, todayStr(), new Date().toISOString());
  store.saveProgress(progress);
  sync?.schedule();
  session[correct ? 'right' : 'wrong'] += 1;
  session.at += 1;
  render();
}

function showSession(listId) {
  if (!session || session.listId !== listId) return go(`#/study/${listId}`);
  const list = store.getList(listId);
  const view = screen();

  if (session.at >= session.queue.length) {
    view.append(el('h2', { text: 'Done' }));
    view.append(el('p', { text: `${session.right} right, ${session.wrong} wrong.` }));
    view.append(el('a', { class: 'btn', href: `#/study/${listId}`, text: 'Study more' }));
    view.append(el('a', { class: 'btn', href: '#/', text: 'Back to lists' }));
    session = null;
    return;
  }

  const key = session.queue[session.at];
  const { cardId, direction } = parseKey(key);
  const card = list.cards.find((c) => c.id === cardId);
  if (!card) { session.at += 1; return render(); }
  const prompt = direction === 'f2b' ? card.front : card.back;
  const expected = direction === 'f2b' ? card.back : card.front;

  view.append(el('p', { class: 'muted', text: `${session.at + 1} / ${session.queue.length}` }));
  view.append(el('p', { class: 'prompt', text: prompt }));

  if (setup.mode === 'cards') {
    const reveal = el('button', {
      class: 'primary', text: 'Show answer',
      onclick: () => {
        reveal.replaceWith(el('div', {}, [
          el('p', { class: 'answer', text: expected }),
          el('div', { class: 'row' }, [
            el('button', { text: 'Didn’t know', onclick: () => answer(false) }),
            el('button', { class: 'primary', text: 'Knew it', onclick: () => answer(true) }),
          ]),
        ]));
      },
    });
    view.append(reveal);
    return;
  }

  const input = el('input', { class: 'answer-input', autocapitalize: 'none',
    autocorrect: 'off', spellcheck: 'false', placeholder: 'your answer' });
  const form = el('form', {
    onsubmit: (e) => {
      e.preventDefault();
      const verdict = grade(expected, input.value);
      if (verdict === 'correct') return answer(true);
      showVerdict(form, verdict, expected, input.value);
    },
  }, [input, el('button', { class: 'primary', type: 'submit', text: 'Check' })]);
  view.append(form);
  input.focus();
}

function showVerdict(anchor, verdict, expected, typed) {
  const panel = el('div', { class: `verdict ${verdict}` }, [
    el('p', { text: verdict === 'typo' ? `Almost — it is “${expected}”` : `Answer: ${expected}` }),
    el('p', { class: 'muted', text: `you wrote: ${typed}` }),
    el('div', { class: 'row' }, [
      el('button', { text: 'I was right', onclick: () => answer(true) }),
      el('button', { class: 'primary', text: verdict === 'typo' ? 'Got it' : 'Continue',
        onclick: () => answer(verdict === 'typo') }),
    ]),
  ]);
  anchor.replaceWith(panel);
}

function showSettings() {
  const view = screen();
  const current = settings();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'Settings' }));

  view.append(el('p', {}, [
    'This device needs a token only to save changes. Studying works without one. ',
    el('a', { target: '_blank', rel: 'noopener',
      href: 'https://github.com/settings/personal-access-tokens/new',
      text: 'Create a fine-grained token' }),
    ` — repository access: only ${REPO}; permissions: Contents → Read and write.`,
  ]));

  const token = el('input', { type: 'password', value: current.token || '', placeholder: 'github_pat_…' });
  const expiry = el('input', { type: 'date', value: current.tokenExpiry || '' });
  view.append(el('label', {}, ['Token', token]));
  view.append(el('label', {}, ['Expires on (from the GitHub page)', expiry]));
  view.append(el('button', {
    class: 'primary', text: 'Save',
    onclick: () => {
      saveSettings({ token: token.value.trim(), tokenExpiry: expiry.value || null });
      initSync();
      render();
    },
  }));

  view.append(el('h3', { text: 'Sync' }));
  view.append(el('div', { class: 'row' }, [
    el('button', { text: 'Pull now', onclick: () => sync.pullAll().then(render) }),
    el('button', { text: 'Push now', onclick: () => sync.pushDirty().then(render) }),
    el('button', { text: 'Retry', onclick: () => sync.syncNow().then(render) }),
  ]));
  view.append(el('p', { class: 'muted', text: `${store.dirtyKeys().length} change(s) waiting.` }));
}

function render() {
  const [, route, arg] = location.hash.split('/');
  if (route === 'list' && arg) showList(arg);
  else if (route === 'study' && arg) showSetup(arg);
  else if (route === 'session' && arg) showSession(arg);
  else if (route === 'settings') showSettings();
  else showHome();
}

window.addEventListener('hashchange', render);
initSync();
render();
