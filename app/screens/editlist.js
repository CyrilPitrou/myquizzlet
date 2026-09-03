import { el } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { listForm } from '../listform.js';
import { parseCards } from '../csv.js';
import { importFileBlock } from './importdialog.js';
import { t } from '../i18n.js';

// New list has no storage yet, so both import blocks stage into this
// in-memory array instead of writing straight to a list; showNewList's
// onSave hands it to store.addCards once the list itself is created.
// Returns { node, flush } rather than a bare node: `flush` is the same
// staging logic the "Stage pasted text" button calls, exposed so showNewList
// can also run it at save time. Without that, text left in the box when
// "Create list" is clicked would be silently discarded — the screen
// navigates away and takes the unstaged text with it.
// Both blocks report the draft's running total, not their own last haul: they
// share one status line, so "Staged 3." after pasting 5 and importing 3 would
// describe neither the action nor the draft.
function reportStaged(draftCards, status, errors = []) {
  const total = draftCards.length ? t('editlist.staged', { n: draftCards.length }) : '';
  status.textContent = errors.length
    ? t('editlist.stagedSkipped', { staged: total, lines: errors.map((e) => e.line).join(', ') }).trim()
    : total;
}

function draftPasteBlock(draftCards, status) {
  const box = el('textarea', {
    placeholder: t('editlist.new.paste'),
    rows: '4',
  });
  const flush = () => {
    const { cards, errors } = parseCards(box.value);
    if (cards.length) draftCards.push(...cards);
    box.value = '';
    reportStaged(draftCards, status, errors);
  };
  const node = el('div', {}, [
    el('h3', { text: t('cards.paste.heading') }),
    el('p', { class: 'muted', text: t('cards.paste.hint') }),
    box,
    el('button', { text: t('editlist.stagePaste'), type: 'button', onclick: flush }),
  ]);
  return { node, flush };
}

function draftFileBlock(draftCards, status) {
  return importFileBlock((cards) => {
    draftCards.push(...cards);
    reportStaged(draftCards, status);
  });
}

export function showNewList() {
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: t('common.back.lists') }));
  view.append(el('h2', { text: t('editlist.new.title') }));

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
  const ok = confirm(t('editlist.swap.confirm', {
    name: list.name,
    front: list.frontLabel || t('side.front'),
    back: list.backLabel || t('side.back'),
  }));
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
  view.append(el('h2', { text: t('editlist.sides.title') }));
  // type: 'button' matters — this sits inside the form, and a bare button
  // there would submit it instead of swapping.
  const swap = el('div', { class: 'swapsides' }, [
    el('p', { class: 'muted', text: t('editlist.swap.hint') }),
    el('button', { class: 'btn', type: 'button', text: t('editlist.swap.button'),
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
