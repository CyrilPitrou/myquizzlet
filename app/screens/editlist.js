import { el } from '../ui.js';
import { store, screen, go, ctx } from '../app.js';
import { listForm } from '../listform.js';
import { parseCards } from '../csv.js';

export function showNewList() {
  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('h2', { text: 'New list' }));

  const box = el('textarea', {
    placeholder: 'Optional — paste rows: el pan, le pain — one card per line. Tabs work too.',
    rows: '4',
  });
  const file = el('input', {
    type: 'file', accept: '.csv,.txt,text/csv',
    onchange: async (event) => {
      const chosen = event.target.files[0];
      if (chosen) box.value = await chosen.text();
    },
  });

  view.append(listForm({
    onSave: (fields) => {
      const list = store.createList(fields);
      const { cards } = parseCards(box.value);
      if (cards.length) store.addCards(list.id, cards);
      ctx.sync?.schedule();
      go(`#/list/${list.id}`);
    },
  }));
  view.append(el('details', { class: 'io', open: 'open' }, [
    el('summary', { text: 'Start with some cards' }), box, file,
  ]));
}

export function showEditList(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const view = screen();
  view.append(el('a', { href: `#/list/${id}`, class: 'back', text: `← ${list.name}` }));
  view.append(el('h2', { text: 'Edit list' }));
  view.append(listForm({
    list,
    onSave: (fields) => {
      store.updateMeta(id, fields);
      ctx.sync?.schedule();
      go(`#/list/${id}`);
    },
  }));
}
