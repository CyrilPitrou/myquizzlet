import { el } from '../ui.js';
import { store, screen, todayStr, settings } from '../app.js';
import { recency } from '../store.js';
import { listStats } from '../stats.js';
import { expiryWarning } from '../setup.js';

function statsLine(stats) {
  const learned = el('span', {}, [
    'learned ',
    el('span', { class: 'bar' }, [el('span', { style: `width:${stats.learnedPct}%` })]),
    ` ${stats.learnedPct}%`,
  ]);
  const nodes = [learned];
  if (stats.rightPct !== null) nodes.push(el('span', { text: `right ${stats.rightPct}%` }));
  nodes.push(stats.due
    ? el('span', { class: 'badge', text: `${stats.due} due` })
    : el('span', { text: '—' }));
  return nodes;
}

function listRow(id) {
  const list = store.getList(id);
  const stats = listStats({ list, progress: store.getProgress(id), today: todayStr() });
  return el('div', { class: 'listrow' }, [
    el('a', { href: `#/list/${id}`, text: list.name }),
    el('div', { class: 'liststats' }, [
      el('span', { text: list.folder || 'Unfiled' }),
      el('span', { text: `${stats.cards} cards` }),
      ...statsLine(stats),
    ]),
  ]);
}

export function showLists() {
  const view = screen();
  const expiring = expiryWarning(settings().tokenExpiry, todayStr());
  if (expiring) {
    view.append(el('p', { class: 'warn' }, [`${expiring} `,
      el('a', { href: '#/settings', text: 'Replace it' })]));
  }

  const ids = store.listIds().slice().sort((a, b) => {
    const at = recency({ list: store.getList(a), progress: store.getProgress(a) });
    const bt = recency({ list: store.getList(b), progress: store.getProgress(b) });
    return bt.localeCompare(at);   // newest first
  });

  if (ids.length === 0) {
    view.append(el('h2', { text: 'Lists' }));
    view.append(el('p', { class: 'empty' }, [
      'No lists yet. ', el('a', { href: '#/new', text: 'Create one' }), '.',
    ]));
    return;
  }

  if (ids.length > 5) {
    view.append(el('section', { class: 'recent' }, [
      el('h3', { text: 'Recent' }),
      ...ids.slice(0, 5).map(listRow),
    ]));
  }

  view.append(el('section', { class: 'all' }, [
    el('h3', { text: ids.length > 5 ? 'All lists' : 'Lists' }),
    ...ids.map(listRow),
  ]));
}
