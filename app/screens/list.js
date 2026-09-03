import { el, menu } from '../ui.js';
import { store, screen, go, todayStr, ctx } from '../app.js';
import { listStats } from '../stats.js';

function renameList(list) {
  const name = prompt('New title for this list', list.name);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed || trimmed === list.name) return;
  store.renameList(list.id, trimmed);
  ctx.sync?.schedule();
  ctx.render();
}

function moveToFolder(list) {
  const known = store.folders();
  const message = known.length
    ? `Folder for this list.\n\nIn use: ${known.join(', ')}\n\nLeave empty for Unfiled.`
    : 'Folder for this list. Leave empty for Unfiled.';
  const folder = prompt(message, list.folder || '');
  if (folder === null) return;
  store.updateMeta(list.id, { folder: folder.trim() || null });
  ctx.sync?.schedule();
  ctx.render();
}

function deleteList(list) {
  const records = Object.keys(store.getProgress(list.id).items).length;
  const ok = confirm(`Delete "${list.name}"?\n\n${list.cards.length} card(s) and `
    + `${records} progress record(s) go, here and on GitHub. This cannot be undone.`);
  if (!ok) return;
  store.deleteList(list.id);
  ctx.sync?.schedule();
  go('#/');
}

export function showList(id) {
  const list = store.getList(id);
  if (!list) return go('#/');
  const stats = listStats({ list, progress: store.getProgress(id), today: todayStr() });

  const view = screen();
  view.append(el('a', { href: '#/', class: 'back', text: '← Lists' }));
  view.append(el('div', { class: 'listhead' }, [
    el('h2', { text: list.name }),
    menu([
      { label: 'Rename', onclick: () => renameList(list) },
      { label: 'Move to folder', onclick: () => moveToFolder(list) },
      { label: 'Sides', onclick: () => go(`#/list/${id}/edit`) },
      { label: 'Edit cards', onclick: () => go(`#/list/${id}/cards`) },
      { label: 'Delete list', onclick: () => deleteList(list) },
    ]),
  ]));

  view.append(el('div', { class: 'liststats' }, [
    el('span', { text: list.folder || 'Unfiled' }),
    el('span', { text: `${stats.cards} cards` }),
    el('span', { text: `${list.frontLabel || 'Front'} → ${list.backLabel || 'Back'}` }),
  ]));
  view.append(el('div', { class: 'liststats' }, [
    el('span', { class: 'bar' }, [el('span', { style: `width:${stats.learnedPct}%` })]),
    el('span', { text: `${stats.learnedPct}% learned` }),
    stats.rightPct === null ? el('span', { text: 'not studied yet' })
                            : el('span', { text: `${stats.rightPct}% right` }),
    stats.due ? el('span', { class: 'badge', text: `${stats.due} due` })
              : el('span', { text: '—' }),
  ]));

  view.append(el('div', { class: 'actions' }, [
    el('a', { class: 'btn', href: `#/view/${id}`, text: 'View cards' }),
    el('a', { class: 'btn primary', href: `#/train/${id}`, text: 'Train' }),
    el('a', { class: 'btn', href: `#/test/${id}`, text: 'Test' }),
  ]));
}
