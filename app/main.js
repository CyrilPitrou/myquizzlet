import { el, clear, $ } from './ui.js';
import { createStore } from './store.js';
import { parseCards, toCsv } from './csv.js';
import { buildQueue, newItem, nextItem, parseKey } from './srs.js';
import { grade } from './grade.js';

const store = createStore(localStorage);

const todayStr = () => new Date().toISOString().slice(0, 10);

function dueCount(listId) {
  const list = store.getList(listId);
  return buildQueue({
    list, progress: store.getProgress(listId), directions: ['f2b', 'b2f'],
    today: todayStr(), limit: Infinity, includeNew: true, shuffle: (xs) => xs,
  }).length;
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
        onclick: () => { store.deleteCard(id, card.id); render(); },
      })]),
    ]));
  }
  view.append(table);
  view.append(importExport(id));
}

function editableCell(listId, card, side) {
  return el('input', {
    value: card[side],
    onchange: (e) => store.updateCard(listId, card.id, { [side]: e.target.value.trim() }),
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
    if (cards.length) store.addCards(listId, cards);
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
      setup.limit = Number(limit.value) || 20;
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
      showVerdict(view, verdict, expected, input.value);
    },
  }, [input, el('button', { class: 'primary', type: 'submit', text: 'Check' })]);
  view.append(form);
  input.focus();
}

function showVerdict(view, verdict, expected, typed) {
  const panel = el('div', { class: `verdict ${verdict}` }, [
    el('p', { text: verdict === 'typo' ? `Almost — it is “${expected}”` : `Answer: ${expected}` }),
    el('p', { class: 'muted', text: `you wrote: ${typed}` }),
    el('div', { class: 'row' }, [
      el('button', { text: 'I was right', onclick: () => answer(true) }),
      el('button', { class: 'primary', text: verdict === 'typo' ? 'Got it' : 'Continue',
        onclick: () => answer(verdict === 'typo') }),
    ]),
  ]);
  view.append(panel);
}

function render() {
  const [, route, arg] = location.hash.split('/');
  if (route === 'list' && arg) showList(arg);
  else if (route === 'study' && arg) showSetup(arg);
  else if (route === 'session' && arg) showSession(arg);
  else showHome();
}

window.addEventListener('hashchange', render);
render();
