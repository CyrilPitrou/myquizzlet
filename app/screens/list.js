import { el, menu } from '../ui.js';
import { store, screen, go, todayStr, ctx } from '../app.js';
import { listStats } from '../stats.js';
import { toCsv } from '../csv.js';
import { openImportDialog } from './importdialog.js';

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

function importFromFile(list) {
  openImportDialog({
    onCommit: (cards) => {
      if (!cards.length) return;
      store.addCards(list.id, cards);
      ctx.sync?.schedule();
      ctx.render();
    },
  });
}

function exportCsv(list) {
  const blob = new Blob([toCsv(list.cards)], { type: 'text/csv' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `${list.id}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function generatePdf(list) {
  const frontLabel = list.frontLabel || 'Front';
  const backLabel = list.backLabel || 'Back';
  const rows = list.cards.map((c) =>
    `<tr><td>${escapeHtml(c.front)}</td><td>${escapeHtml(c.back)}</td></tr>`).join('');
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(list.name)}</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; padding: 1.5rem; color: #1c1917; }
  h1 { font-size: 1.3rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { border: 1px solid #ccc; padding: .4rem .6rem; text-align: left; }
  th { background: #f3f3f3; }
</style>
</head>
<body>
<h1>${escapeHtml(list.name)}</h1>
<table>
  <tr><th>${escapeHtml(frontLabel)}</th><th>${escapeHtml(backLabel)}</th></tr>
  ${rows}
</table>
<script>window.onload = () => window.print();</script>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) {
    alert('Your browser blocked the PDF popup. Allow popups for this site and try again.');
    return;
  }
  win.document.write(html);
  win.document.close();
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
      { label: 'Import from file', onclick: () => importFromFile(list) },
      { label: 'Export as CSV', onclick: () => exportCsv(list) },
      { label: 'Generate PDF', onclick: () => generatePdf(list) },
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
