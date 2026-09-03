import { el, clear } from '../ui.js';
import { screen, settings, REPO } from '../app.js';
import { createGitHub, ConflictError } from '../github.js';
import { seedWish, recentEntries, suggestionsDoc } from '../wishes.js';
import { t } from '../i18n.js';

const PATH = 'data/suggestions.json';
const LOG_PATH = 'data/suggestions-log.json';

// The list name arrives in the fragment's query. Read it once, then strip it
// from the address bar — same reason adopt.js does: otherwise a re-render or
// a Back press seeds the box a second time.
function takeSeed() {
  const query = location.hash.split('?')[1];
  if (!query) return null;
  const name = new URLSearchParams(query).get('list');
  history.replaceState(null, '', `${location.pathname}${location.search}#/wishes`);
  return name || null;
}

function section(title, nodes) {
  return el('section', { class: 'sect' }, [el('h3', { text: title }), ...nodes]);
}

function recentBox(log) {
  const entries = recentEntries(log);
  if (!entries.length) {
    return section(t('wishes.recent'), [
      el('p', { class: 'muted', text: t('wishes.recent.none') }),
    ]);
  }
  return section(t('wishes.recent'), [
    el('ul', { class: 'steps' }, entries.map((entry) => el('li', {}, [
      el('span', { class: 'muted', text: `${(entry.at || '').slice(0, 10)} — ` }),
      el('span', { text: entry.done || '' }),
    ]))),
  ]);
}

// Everything the screen does after the network answers. `sha` is the version
// this box was filled from; saving carries it, so two people writing at once
// produce a conflict rather than a silent overwrite.
function paint(body, github, seed, doc, sha, log) {
  clear(body);

  const box = el('textarea', { rows: '10', placeholder: t('wishes.placeholder') });
  box.value = seed ? seedWish((doc && doc.text) || '', t('wishes.seed', { name: seed }))
                   : (doc && doc.text) || '';

  const status = el('p', { class: 'muted' });
  const actions = el('div', { class: 'actions' });

  const save = el('button', {
    class: 'primary', text: t('wishes.save'),
    onclick: async () => {
      save.disabled = true;
      status.className = 'muted';
      status.textContent = t('wishes.saving');
      try {
        const written = await github.putFile(
          PATH, suggestionsDoc(box.value, new Date().toISOString()), sha,
          'update suggestions');
        sha = written.sha;
        status.className = 'muted';
        status.textContent = t('wishes.saved');
      } catch (error) {
        status.className = 'warn';
        if (error instanceof ConflictError) {
          status.textContent = t('wishes.conflict');
          actions.append(el('button', {
            text: t('wishes.reload'),
            onclick: () => load(body, github, null),
          }));
        } else {
          status.textContent = error.message;
        }
      } finally {
        save.disabled = false;
      }
    },
  });

  actions.append(save);
  body.append(box, actions, status, recentBox(log));
  if (seed) box.focus();
  if (seed) box.setSelectionRange(box.value.length, box.value.length);
}

async function load(body, github, seed) {
  clear(body);
  body.append(el('p', { class: 'muted', text: t('wishes.loading') }));
  try {
    const [current, log] = await Promise.all([
      github.getFile(PATH),
      github.getFile(LOG_PATH),
    ]);
    paint(body, github, seed,
          current && current.json, current && current.sha,
          log && log.json);
  } catch (error) {
    clear(body);
    body.append(el('p', { class: 'warn', text: error.message }));
  }
}

export function showWishes() {
  const view = screen();
  const seed = takeSeed();

  view.append(el('h2', { text: t('wishes.title') }));
  view.append(el('p', { class: 'muted', text: t('wishes.blurb') }));

  const { token } = settings();
  if (!token) {
    view.append(el('p', { class: 'warn', text: t('wishes.noToken') }));
    view.append(el('div', { class: 'actions' }, [
      el('a', { class: 'btn primary', href: '#/token', text: t('wishes.getToken') }),
    ]));
    return;
  }

  if (!navigator.onLine) {
    view.append(el('p', { class: 'warn', text: t('wishes.offline') }));
    return;
  }

  const body = el('div');
  view.append(body);
  load(body, createGitHub({ repo: REPO, branch: 'data', token }), seed);
}
