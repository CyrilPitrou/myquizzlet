import { el } from '../ui.js';
import { pageHead, newListLink, sortSelect, listSort } from '../pagehead.js';
import { store, screen, todayStr } from '../app.js';
import { listStats } from '../stats.js';
import { sortLists } from '../listsort.js';
import { t } from '../i18n.js';

const UNFILED = 'Unfiled';

// Derived, never stored: the folders are whatever the lists say they are.
function grouped() {
  const groups = new Map();
  for (const id of store.listIds()) {
    const list = store.getList(id);
    if (!list) continue;
    const name = list.folder || UNFILED;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(list);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === UNFILED) return 1;          // Unfiled always last
    if (b === UNFILED) return -1;
    return a.localeCompare(b);
  });
}

export function showFolders() {
  const view = screen();
  view.append(el('h2', { text: t('folders.title') }));
  const groups = grouped();
  if (groups.length === 0) {
    view.append(el('p', { class: 'empty' }, [
      `${t('common.noLists')} `, el('a', { href: '#/new', text: t('common.createOne') }), '.',
    ]));
    return;
  }
  for (const [name, lists] of groups) {
    const due = lists.reduce((total, list) => total + listStats({
      list, progress: store.getProgress(list.id), today: todayStr(),
    }).due, 0);
    view.append(el('div', { class: 'row' }, [
      el('a', { href: `#/folder/${encodeURIComponent(name)}`, text: name === UNFILED ? t('common.unfiled') : name }),
      el('span', { class: 'muted', text: t('common.lists', { n: lists.length }) }),
      due ? el('span', { class: 'badge', text: t('common.due', { n: due }) }) : el('span', { class: 'muted', text: t('common.dash') }),
    ]));
  }
}

export function showFolder(name) {
  const view = screen();
  view.append(el('a', { href: '#/folders', class: 'back', text: t('folders.back') }));
  const newIn = name === UNFILED ? null : name;
  const lists = (grouped().find(([folder]) => folder === name) || [name, []])[1];
  // The + here files the new list in the folder you are standing in. The
  // sort control only appears once there is something to sort.
  const actions = lists.length ? [sortSelect(), newListLink(newIn)] : [newListLink(newIn)];
  view.append(pageHead(name === UNFILED ? t('common.unfiled') : name, actions));
  if (lists.length === 0) {
    view.append(el('p', { class: 'empty', text: t('folders.empty') }));
    return;
  }
  const entries = sortLists(lists.map((list) => ({
    list, stats: listStats({ list, progress: store.getProgress(list.id), today: todayStr() }),
  })), listSort());
  for (const { list, stats } of entries) {
    view.append(el('a', { class: 'listrow', href: `#/list/${list.id}` }, [
      el('div', {}, [
        el('span', { class: 'listname', text: list.name }),
        el('span', { class: 'listcount', text: ` — ${t('common.cards', { n: stats.cards })}` }),
      ]),
      el('div', { class: 'liststats' }, [
        el('span', { text: t('common.learnedPct', { n: stats.learnedPct }) }),
        stats.due ? el('span', { class: 'badge', text: t('common.due', { n: stats.due }) })
                  : el('span', { text: t('common.dash') }),
      ]),
    ]));
  }
}
