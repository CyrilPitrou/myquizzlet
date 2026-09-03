import { el } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { listForm } from '../listform.js';
import { parseCards } from '../csv.js';
import { openImportDialog } from './importdialog.js';

// New list has no storage yet, so both import blocks stage into this
// in-memory array instead of writing straight to a list; showNewList's
// onSave hands it to store.addCards once the list itself is created.
// Returns { node, flush } rather than a bare node: `flush` is the same
// staging logic the "Stage pasted text" button calls, exposed so showNewList
// can also run it at save time. Without that, text left in the box when
// "Create list" is clicked would be silently discarded — the screen
// navigates away and takes the unstaged text with it.
function draftPasteBlock(draftCards, status) {
  const box = el('textarea', {
    placeholder: 'Optional — paste rows: el pan, le pain — one card per line. Tabs work too.',
    rows: '4',
  });
  const flush = () => {
    const { cards, errors } = parseCards(box.value);
    if (cards.length) draftCards.push(...cards);
    box.value = '';
    status.textContent = errors.length
      ? `Staged ${cards.length}. Skipped lines: ${errors.map((e) => e.line).join(', ')}.`
      : cards.length ? `Staged ${cards.length}.` : '';
  };
  const node = el('div', { class: 'io' }, [
    el('h3', { text: 'Paste text' }),
    el('p', { class: 'muted', text: 'One card per line, front and back separated by a '
      + 'comma, semicolon, or tab.' }),
    box,
    el('button', { text: 'Stage pasted text', type: 'button', onclick: flush }),
  ]);
  return { node, flush };
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
  const paste = draftPasteBlock(draftCards, status);

  view.append(listForm({
    onSave: (fields) => {
      // Stage whatever is still sitting in the paste box, even if the user
      // never clicked "Stage pasted text" — this screen navigates away on
      // save, so unstaged text would otherwise be lost with no warning.
      // A no-op when the box is already empty (button was clicked, or
      // nothing was typed).
      paste.flush();
      const list = store.createList(fields);
      if (draftCards.length) store.addCards(list.id, draftCards);
      ctx.sync?.schedule();
      go(`#/list/${list.id}`);
    },
  }));
  view.append(paste.node);
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
  // type: 'button' matters — this sits inside the form, and a bare button
  // there would submit it instead of swapping.
  const swap = el('div', { class: 'swapsides' }, [
    el('p', { class: 'muted', text: 'Entered the two sides the wrong way round? '
      + 'Swapping turns every card in the list around. Each card keeps what you have '
      + 'learned: its history follows the skill it was tracking, not the column.' }),
    el('button', { class: 'btn', type: 'button', text: 'Swap sides',
      onclick: () => confirmSwapSides(list) }),
  ]);

  view.append(listForm({
    list,
    sidesOnly: true,
    beforeSave: swap,
    onSave: (fields) => {
      store.updateMeta(id, fields);
      ctx.sync?.schedule();
      go(`#/list/${id}`);
    },
  }));
}
