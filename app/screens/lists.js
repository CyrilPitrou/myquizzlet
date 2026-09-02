import { el } from '../ui.js';
import { recency } from '../store.js';
import { buildQueue, parseKey } from '../srs.js';
import { store, settings, go, todayStr, screen, ctx } from '../app.js';

function dueCount(listId) {
  const list = store.getList(listId);
  const queue = buildQueue({
    list, progress: store.getProgress(listId), directions: ['f2b', 'b2f'],
    today: todayStr(), limit: Infinity, includeNew: true, shuffle: (xs) => xs,
  });
  return new Set(queue.map((key) => parseKey(key).cardId)).size;
}

export function showLists() {
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
  const ids = store.listIds().slice().sort((a, b) => {
    const at = recency({ list: store.getList(a), progress: store.getProgress(a) });
    const bt = recency({ list: store.getList(b), progress: store.getProgress(b) });
    return bt.localeCompare(at);   // newest first
  });
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
      ctx.sync?.schedule();
      go(`#/list/${list.id}`);
    },
  }, [name, el('button', { type: 'submit', text: 'Create list' })]));
}
