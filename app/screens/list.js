import { el, $ } from '../ui.js';
import { parseCards, toCsv } from '../csv.js';
import { store, go, screen, ctx } from '../app.js';

export function showList(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: list.name }));
  view.append(el('div', { class: 'row' }, [
    el('button', { text: 'Rename', onclick: () => renameList(list) }),
    el('button', { class: 'link', text: 'Delete list', onclick: () => deleteList(list) }),
  ]));

  const front = el('input', { placeholder: 'front (e.g. el pan)' });
  const back = el('input', { placeholder: 'back (e.g. le pain)' });
  view.append(el('form', {
    class: 'addcard',
    onsubmit: (e) => {
      e.preventDefault();
      if (!front.value.trim() || !back.value.trim()) return;
      store.addCards(id, [{ front: front.value.trim(), back: back.value.trim() }]);
      ctx.sync?.schedule();
      front.value = '';
      back.value = '';
      ctx.render();
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
        onclick: () => { store.deleteCard(id, card.id); ctx.sync?.schedule(); ctx.render(); },
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
      ctx.sync?.schedule();
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
    if (cards.length) { store.addCards(listId, cards); ctx.sync?.schedule(); }
    box.value = '';
    status.textContent = errors.length
      ? `Imported ${cards.length}. Skipped lines: ${errors.map((e) => e.line).join(', ')}.`
      : `Imported ${cards.length}.`;
    ctx.render();
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

function renameList(list) {
  const name = prompt('New name for this list', list.name);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed || trimmed === list.name) return;
  store.renameList(list.id, trimmed);
  ctx.sync?.schedule();
  ctx.render();
}

function deleteList(list) {
  const records = Object.keys(store.getProgress(list.id).items).length;
  const ok = confirm(`Delete "${list.name}"?\n\n${list.cards.length} card(s) and `
    + `${records} progress record(s) go, here and on GitHub. This cannot be undone.`);
  if (!ok) return;
  store.deleteList(list.id);
  ctx.sync?.schedule();
  go('#/');
}
