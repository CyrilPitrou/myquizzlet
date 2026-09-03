import { el, $ } from './ui.js';
import { t } from './i18n.js';

const MARK = {
  synced: '●', syncing: '↻', pending: '↑',
  offline: '○', error: '✕', off: '⊘',
};

const word = (state) => t(`status.${state}`);

export let status = { state: 'off', detail: '' };

export function setStatus(state, detail = '') {
  status = { state, detail };
  const dot = $('#sync-dot');
  dot.textContent = MARK[state];
  dot.className = `dot ${state}`;
  dot.title = detail ? `${word(state)}: ${detail}` : word(state);
  const line = $('#sync-line');
  if (line) line.replaceWith(statusLine());
}

export function statusLine() {
  return el('div', { class: 'statusline', id: 'sync-line' }, [
    el('span', { class: `dot ${status.state}`, text: MARK[status.state] }),
    status.detail ? `${word(status.state)}: ${status.detail}` : word(status.state),
  ]);
}

// The dot's title is written imperatively, so a language change has to ask
// for it again; render() does that on every paint.
export function repaintStatus() {
  setStatus(status.state, status.detail);
}
