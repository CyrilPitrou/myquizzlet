import { el } from '../ui.js';
import { pageHead, newListLink, sortSelect, listSort } from '../pagehead.js';
import { store, screen, todayStr, settings } from '../app.js';
import { recency } from '../store.js';
import { listStats } from '../stats.js';
import { sortLists } from '../listsort.js';
import { expiryWarning } from '../setup.js';
import { t } from '../i18n.js';

function listRow({ list, stats }) {
  return el('a', { class: 'listrow', href: `#/list/${list.id}` }, [
    el('div', {}, [
      el('span', { class: 'listname', text: list.name }),
      el('span', { class: 'listcount', text: ` — ${t('common.cards', { n: stats.cards })}` }),
    ]),
    el('div', { class: 'liststats' }, [
      el('span', { text: list.folder || t('common.unfiled') }),
      stats.due ? el('span', { class: 'badge', text: t('common.due', { n: stats.due }) })
                : el('span', { text: t('common.dash') }),
    ]),
  ]);
}

export function showLists() {
  const view = screen();
  const expiring = expiryWarning(settings().tokenExpiry, todayStr());
  if (expiring) {
    view.append(el('p', { class: 'warn' }, [`${t(expiring.key, expiring.params)} `,
      el('a', { href: '#/token', text: t('lists.replaceToken') })]));
  }

  const entries = store.listIds().map((id) => {
    const list = store.getList(id);
    return {
      list,
      stats: listStats({ list, progress: store.getProgress(id), today: todayStr() }),
      recency: recency({ list, progress: store.getProgress(id) }),
    };
  });

  // Recent is what I touched last and answers a different question from the
  // sort: it stays on recency whatever the chosen order.
  const recent = entries.slice().sort((a, b) => b.recency.localeCompare(a.recency));
  const all = sortLists(entries, listSort());

  const actions = entries.length ? [sortSelect(), newListLink()] : [newListLink()];
  view.append(pageHead(entries.length === 0 ? t('lists.title') : null, actions));

  if (entries.length === 0) {
    view.append(el('p', { class: 'empty' }, [
      `${t('common.noLists')} `, el('a', { href: '#/new', text: t('common.createOne') }), '.',
    ]));
    return;
  }

  if (entries.length > 5) {
    view.append(el('section', { class: 'recent' }, [
      el('h3', { text: t('lists.recent') }),
      ...recent.slice(0, 5).map(listRow),
    ]));
  }

  view.append(el('section', { class: 'all' }, [
    el('h3', { text: entries.length > 5 ? t('lists.all') : t('lists.title') }),
    ...all.map(listRow),
  ]));
}
