import { el } from './ui.js';
import { t } from './i18n.js';
import { settings, saveSettings, ctx } from './app.js';
import { SORT_VALUES, parseSort } from './listsort.js';

// A screen's title and the actions that belong to it, on one line. Pass a
// null title for a screen that has no heading of its own — Lists goes
// straight into its sections — and the actions still sit against the right
// edge.
export function pageHead(title, actions = []) {
  return el('div', { class: 'pagehead' }, [
    title ? el('h2', { text: title }) : el('span'),
    el('div', { class: 'headactions' }, actions),
  ]);
}

// The + that creates a list. Given a folder, the new list starts out filed
// there: you were looking at that folder when you asked for it.
export function newListLink(folder = null) {
  const href = folder ? `#/new?folder=${encodeURIComponent(folder)}` : '#/new';
  return el('a', {
    class: 'btn icon', href, text: '＋',
    title: t('nav.new'), 'aria-label': t('nav.new'),
  });
}

// Which order the lists are in. Like the theme and the language it is a
// per-device preference, so it sits in the local settings blob and is never
// synced: how I like to look at my lists on the phone is not a fact about
// the lists.
export function listSort() {
  const { key, dir } = parseSort(settings().listSort);
  return `${key}-${dir}`;
}

export function sortSelect() {
  const node = el('select', {
    class: 'sortselect', title: t('sort.label'), 'aria-label': t('sort.label'),
    onchange: (event) => {
      saveSettings({ ...settings(), listSort: event.target.value });
      ctx.render();
    },
  }, SORT_VALUES.map((value) => el('option', { value, text: t(`sort.${value}`) })));
  node.value = listSort();
  return node;
}
