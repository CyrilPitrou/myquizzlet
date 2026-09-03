import { el, $ } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { parseCards } from '../csv.js';
import { importFileBlock } from './importdialog.js';

function editableCell(listId, card, side) {
  return el('input', {
    value: card[side],
    onchange: (event) => {
      store.updateCard(listId, card.id, { [side]: event.target.value.trim() });
      ctx.sync?.schedule();
    },
  });
}

function pasteBlock(listId) {
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
  return el('div', {}, [
    el('h3', { text: 'Paste text' }),
    el('p', { class: 'muted', text: 'One card per line, front and back separated by a '
      + 'comma, semicolon, or tab.' }),
    box,
    el('button', { text: 'Import pasted text', type: 'button', onclick: doImport }),
    status,
  ]);
}

function fileBlock(listId) {
  return importFileBlock((cards) => {
    store.addCards(listId, cards);
    ctx.sync?.schedule();
    ctx.render();
  });
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
      el('td', {}, [el('div', { class: 'rowactions' }, [
        el('button', {
          class: 'link swap', text: '⇄', title: 'swap sides', type: 'button',
          onclick: () => {
            // Clicking here blurs a focused cell first, which commits any in-progress
            // edit to the store without re-rendering — so `card` may be stale. Re-read
            // the current text by (permanent) id rather than trusting the closure.
            // This is a data-entry correction, not a change of reading direction, so
            // unlike the whole-list swap in sides.js it deliberately leaves the card's
            // f2b/b2f progress keys alone.
            const live = store.getList(id).cards.find((c) => c.id === card.id);
            store.updateCard(id, card.id, { front: live.back, back: live.front });
            ctx.sync?.schedule();
            ctx.render();
          },
        }),
        el('button', {
          class: 'link', text: '✕', title: 'delete', type: 'button',
          onclick: () => { store.deleteCard(id, card.id); ctx.sync?.schedule(); ctx.render(); },
        }),
      ])]),
    ]));
  }
  view.append(table);
  view.append(pasteBlock(id));
  view.append(fileBlock(id));
}
