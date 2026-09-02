import { $, clear } from './ui.js';
import { createStore } from './store.js';

export const REPO = 'CyrilPitrou/myquizzlet';

export const store = createStore(localStorage);

export const settings = () => JSON.parse(localStorage.getItem('mq:settings') || '{}');
export const saveSettings = (next) => localStorage.setItem('mq:settings', JSON.stringify(next));

export const go = (hash) => { location.hash = hash; };
export const todayStr = () => new Date().toISOString().slice(0, 10);

export function screen() {
  const node = $('#screen');
  clear(node);
  return node;
}

// main.js fills these in at start-up. Screens reach the router and the sync
// engine through here, so no screen ever has to import main.js back.
export const ctx = { sync: null, render: () => {} };
