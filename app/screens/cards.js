import { el, $ } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { parseCards, toCsv } from '../csv.js';

function editableCell(listId, card, side) {
  return el('input', {
    value: card[side],
    onchange: (event) => {
      store.updateCard(listId, card.id, { [side]: event.target.value.trim() });
      ctx.sync?.schedule();
    },
  });
}

function importExport(listId) {
  const box = el('textarea', {
    placeholder: 'Paste rows: el pan, le pain — one card per line. Tabs work too.',
    rows: '4',
  });
  const status = el('p', { class: 'muted', id: 'import-status' });
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
    onchange: async (event) => {
      const chosen = event.target.files[0];
      if (!chosen) return;
      box.value = await chosen.text();
      doImport();
    },
  });
  const exportButton = el('button', {
    text: 'Export CSV',
    onclick: () => {
      const list = store.getList(listId);
      const blob = new Blob([toCsv(list.cards)], { type: 'text/csv' });
      const a = el('a', { href: URL.createObjectURL(blob), download: `${listId}.csv` });
      a.click();
      URL.revokeObjectURL(a.href);
    },
  });
  return el('details', { class: 'io' }, [
    el('summary', { text: 'Import / export' }),
    box,
    el('div', { class: 'row' }, [
      el('button', { text: 'Import pasted text', onclick: doImport }), file, exportButton,
    ]),
    status,
  ]);
}

export function showCards(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const frontLabel = list.frontLabel || 'Front';
  const backLabel = list.backLabel || 'Back';

  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));
  view.append(el('h2', { text: `${list.cards.length} cards` }));

  const front = el('input', { placeholder: frontLabel.toLowerCase() });
  const back = el('input', { placeholder: backLabel.toLowerCase() });
  view.append(el('form', {
    class: 'addcard',
    onsubmit: (event) => {
      event.preventDefault();
      if (!front.value.trim() || !back.value.trim()) return;
      store.addCards(id, [{ front: front.value.trim(), back: back.value.trim() }]);
      ctx.sync?.schedule();
      front.value = '';
      back.value = '';
      ctx.render();
      $('.addcard input')?.focus();
    },
  }, [front, back, el('button', { type: 'submit', text: 'Add' })]));

  const table = el('table', { class: 'cards' }, [
    el('tr', {}, [el('th', { text: frontLabel }), el('th', { text: backLabel }), el('th', {})]),
  ]);
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
