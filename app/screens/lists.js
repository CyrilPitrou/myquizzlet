import { el } from '../ui.js';
import { store, screen, todayStr, settings } from '../app.js';
import { recency } from '../store.js';
import { listStats } from '../stats.js';
import { expiryWarning } from '../setup.js';
import { t } from '../i18n.js';

function statsLine(stats) {
  const learned = el('span', {}, [
    `${t('common.learned')} `,
    el('span', { class: 'bar' }, [el('span', { style: `width:${stats.learnedPct}%` })]),
    ` ${stats.learnedPct}%`,
  ]);
  const nodes = [learned];
  if (stats.rightPct !== null) nodes.push(el('span', { text: t('common.right', { n: stats.rightPct }) }));
  nodes.push(stats.due
    ? el('span', { class: 'badge', text: t('common.due', { n: stats.due }) })
    : el('span', { text: t('common.dash') }));
  return nodes;
}

function listRow(id) {
  const list = store.getList(id);
  const stats = listStats({ list, progress: store.getProgress(id), today: todayStr() });
  return el('div', { class: 'listrow' }, [
    el('a', { href: `#/list/${id}`, text: list.name }),
    el('div', { class: 'liststats' }, [
      el('span', { text: list.folder || t('common.unfiled') }),
      el('span', { text: t('common.cards', { n: stats.cards }) }),
      ...statsLine(stats),
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

  const ids = store.listIds().slice().sort((a, b) => {
    const at = recency({ list: store.getList(a), progress: store.getProgress(a) });
    const bt = recency({ list: store.getList(b), progress: store.getProgress(b) });
    return bt.localeCompare(at);   // newest first
  });

  if (ids.length === 0) {
    view.append(el('h2', { text: t('lists.title') }));
    view.append(el('p', { class: 'empty' }, [
      `${t('common.noLists')} `, el('a', { href: '#/new', text: t('common.createOne') }), '.',
    ]));
    return;
  }

  if (ids.length > 5) {
    view.append(el('section', { class: 'recent' }, [
      el('h3', { text: t('lists.recent') }),
      ...ids.slice(0, 5).map(listRow),
    ]));
  }

  view.append(el('section', { class: 'all' }, [
    el('h3', { text: ids.length > 5 ? t('lists.all') : t('lists.title') }),
    ...ids.map(listRow),
  ]));
}
