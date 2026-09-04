import { el } from './ui.js';
import { t } from './i18n.js';

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
