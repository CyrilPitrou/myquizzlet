import { el, $ } from './ui.js';
import { t } from './i18n.js';
import { syncProblem } from './syncerror.js';

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
  // Green means there is nothing to do; anything else is a state the owner
  // can push out of, so the dot becomes a button that syncs on the spot.
  const idle = state === 'synced' || state === 'syncing';
  dot.disabled = idle;
  const said = detail ? `${word(state)}: ${detail}` : word(state);
  dot.title = idle ? said : `${said} — ${t('status.retry')}`;
  dot.setAttribute('aria-label', dot.title);
  const line = $('#sync-line');
  if (line) line.replaceWith(statusLine());
}

// The whole of what the Settings page says about sync, because setStatus
// replaces this node and nothing else: an explanation rendered by the screen
// around it would be painted once, before the first sync has even failed, and
// then never updated. That is exactly what happened.
//
// A failure shows a sentence instead of the thrown message, which is a status
// code with a lump of JSON after it. The raw text is not lost — the dot's
// title still carries it.
export function statusLine() {
  const failure = status.state === 'error' ? syncProblem(status.detail) : null;

  return el('div', { class: 'statusline', id: 'sync-line' }, [
    el('div', { class: 'statusrow' }, [
      el('span', { class: `dot ${status.state}`, text: MARK[status.state] }),
      status.detail && !failure ? `${word(status.state)}: ${status.detail}` : word(status.state),
    ]),
    ...(failure ? [el('p', { class: 'warn', text: t(failure.key) })] : []),
    // A rejected or forbidden token is the one failure with somewhere to go.
    ...(failure && failure.token ? [
      el('p', { class: 'muted', text: t('settings.sync.checkToken') }),
      el('p', {}, [el('a', { class: 'btn primary', href: '#/token', text: t('settings.token.manage') })]),
    ] : []),
  ]);
}

// The dot's title is written imperatively, so a language change has to ask
// for it again; render() does that on every paint.
export function repaintStatus() {
  setStatus(status.state, status.detail);
}
