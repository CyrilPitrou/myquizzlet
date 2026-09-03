import { el } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { listForm } from '../listform.js';
import { parseCards } from '../csv.js';
import { openImportDialog } from './importdialog.js';

// New list has no storage yet, so both import blocks stage into this
// in-memory array instead of writing straight to a list; showNewList's
// onSave hands it to store.addCards once the list itself is created.
function draftPasteBlock(draftCards, status) {
  const box = el('textarea', {
    placeholder: 'Optional — paste rows: el pan, le pain — one card per line. Tabs work too.',
    rows: '4',
  });
  const stage = () => {
    const { cards, errors } = parseCards(box.value);
    if (cards.length) draftCards.push(...cards);
    box.value = '';
    status.textContent = errors.length
      ? `Staged ${cards.length}. Skipped lines: ${errors.map((e) => e.line).join(', ')}.`
      : cards.length ? `Staged ${cards.length}.` : '';
  };
  return el('div', { class: 'io' }, [
    el('h3', { text: 'Paste text' }),
    el('p', { class: 'muted', text: 'One card per line, front and back separated by a '
      + 'comma, semicolon, or tab.' }),
    box,
    el('button', { text: 'Stage pasted text', type: 'button', onclick: stage }),
  ]);
}

function draftFileBlock(draftCards, status) {
  return el('div', { class: 'io' }, [
    el('h3', { text: 'Import file' }),
    el('p', { class: 'muted', text: 'CSV, TSV, or text file.' }),
    el('button', {
      class: 'btn', type: 'button', text: 'Import file…',
      onclick: () => openImportDialog({
        onCommit: (cards) => {
          if (!cards.length) return;
          draftCards.push(...cards);
          status.textContent = `Staged ${cards.length}.`;
        },
      }),
    }),
  ]);
}

export function showNewList() {
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'New list' }));

  const draftCards = [];
  const status = el('p', { class: 'muted' });

  view.append(listForm({
    onSave: (fields) => {
      const list = store.createList(fields);
      if (draftCards.length) store.addCards(list.id, draftCards);
      ctx.sync?.schedule();
      go(`#/list/${list.id}`);
    },
  }));
  view.append(draftPasteBlock(draftCards, status));
  view.append(draftFileBlock(draftCards, status));
  view.append(status);
}

function confirmSwapSides(list) {
  const ok = confirm(`Swap sides of "${list.name}"?\n\n`
    + `${list.frontLabel || 'Front'} and ${list.backLabel || 'Back'} trade places on `
    + "every card, and each card's learning history moves with the skill it tracks.");
  if (!ok) return;
  store.swapSides(list.id);
  ctx.sync?.schedule();
  ctx.render();
}

export function showEditList(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));
  view.append(el('h2', { text: 'Sides' }));
  view.append(listForm({
    list,
    sidesOnly: true,
    onSave: (fields) => {
      store.updateMeta(id, fields);
      ctx.sync?.schedule();
      go(`#/list/${id}`);
    },
  }));
  view.append(el('div', { class: 'actions' }, [
    el('button', { class: 'btn', type: 'button', text: 'Swap sides',
      onclick: () => confirmSwapSides(list) }),
  ]));
}
