import { el, clear, $ } from './ui.js';
import { createStore } from './store.js';
import { parseCards, toCsv } from './csv.js';

const store = createStore(localStorage);

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
    view.append(el('div', { class: 'row' }, [
      el('a', { href: `#/list/${id}`, text: list.name }),
      el('span', { class: 'muted', text: `${list.cards.length} cards` }),
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

function render() {
  const [, route, arg] = location.hash.split('/');
  if (route === 'list' && arg) showList(arg);
  else showHome();
}

window.addEventListener('hashchange', render);
render();
