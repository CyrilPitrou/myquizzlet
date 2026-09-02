import { el, $ } from './ui.js';

const STATUS = {
  synced:  { mark: '●', word: 'Everything is on GitHub' },
  pending: { mark: '↑', word: 'Changes waiting to push' },
  offline: { mark: '○', word: 'Offline — will catch up' },
  error:   { mark: '✕', word: 'Sync failed' },
  off:     { mark: '⊘', word: 'No token — read-only' },
};

export let status = { state: 'off', detail: '' };

export function setStatus(state, detail = '') {
  status = { state, detail };
  const dot = $('#sync-dot');
  dot.textContent = STATUS[state].mark;
  dot.className = `dot ${state}`;
  dot.title = detail ? `${STATUS[state].word}: ${detail}` : STATUS[state].word;
  const line = $('#sync-line');
  if (line) line.replaceWith(statusLine());
}

export function statusLine() {
  return el('div', { class: 'statusline', id: 'sync-line' }, [
    el('span', { class: `dot ${status.state}`, text: STATUS[status.state].mark }),
    status.detail ? `${STATUS[status.state].word}: ${status.detail}` : STATUS[status.state].word,
  ]);
}
