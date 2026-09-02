import { el } from '../ui.js';
import { store, screen, todayStr, settings } from '../app.js';
import { recency } from '../store.js';
import { listStats } from '../stats.js';

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

function tokenWarning() {
  const { tokenExpiry } = settings();
  if (!tokenExpiry) return null;
  const days = Math.round((new Date(tokenExpiry) - new Date()) / 86400000);
  if (days > 14) return null;
  return el('p', { class: 'warn' }, [
    days < 0 ? 'Your GitHub token has expired — changes are not being saved. '
             : `Your GitHub token expires in ${days} day(s). `,
    el('a', { href: '#/settings', text: 'Renew it' }),
  ]);
}

export function showLists() {
  const view = screen();
  const warning = tokenWarning();
  if (warning) view.append(warning);

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
