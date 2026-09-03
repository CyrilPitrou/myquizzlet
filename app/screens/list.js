import { el, menu } from '../ui.js';
import { store, screen, go, todayStr, ctx } from '../app.js';
import { listStats } from '../stats.js';
import { toCsv } from '../csv.js';
import { openImportDialog } from './importdialog.js';
import { t } from '../i18n.js';

function renameList(list) {
  const name = prompt(t('list.prompt.rename'), list.name);
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
    ? t('list.prompt.folderKnown', { folders: known.join(', ') })
    : t('list.prompt.folder');
  const folder = prompt(message, list.folder || '');
  if (folder === null) return;
  store.updateMeta(list.id, { folder: folder.trim() || null });
  ctx.sync?.schedule();
  ctx.render();
}

function deleteList(list) {
  const records = Object.keys(store.getProgress(list.id).items).length;
  const ok = confirm(t('list.confirm.delete',
    { name: list.name, cards: list.cards.length, records }));
  if (!ok) return;
  store.deleteList(list.id);
  ctx.sync?.schedule();
  go('#/');
}

function importFromFile(list) {
  openImportDialog({
    onCommit: (cards) => {
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
  const frontLabel = list.frontLabel || t('side.front');
  const backLabel = list.backLabel || t('side.back');
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
    alert(t('list.alert.pdfBlocked'));
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
  view.append(el('a', { href: '#/', class: 'back', text: t('common.back.lists') }));
  view.append(el('div', { class: 'listhead' }, [
    el('h2', {}, [
      list.name,
      el('span', { class: 'listcount', text: ` — ${t('common.cards', { n: stats.cards })}` }),
    ]),
    menu([
      { label: t('list.menu.rename'), onclick: () => renameList(list) },
      { label: t('list.menu.move'), onclick: () => moveToFolder(list) },
      { label: t('list.menu.sides'), onclick: () => go(`#/list/${id}/edit`) },
      { label: t('list.menu.cards'), onclick: () => go(`#/list/${id}/cards`) },
      { label: t('list.menu.import'), onclick: () => importFromFile(list) },
      { label: t('list.menu.exportCsv'), onclick: () => exportCsv(list) },
      { label: t('list.menu.generatePdf'), onclick: () => generatePdf(list) },
      { label: t('list.menu.delete'), onclick: () => deleteList(list) },
    ], t('common.actions')),
  ]));

  view.append(el('div', { class: 'liststats' }, [
    el('span', { text: list.folder || t('common.unfiled') }),
    el('span', { text: `${list.frontLabel || t('side.front')} → ${list.backLabel || t('side.back')}` }),
  ]));
  view.append(el('div', { class: 'liststats' }, [
    el('span', { text: t('common.learnedPct', { n: stats.learnedPct }) }),
    stats.rightPct === null ? el('span', { text: t('common.notStudied') })
                            : el('span', { text: t('common.rightPct', { n: stats.rightPct }) }),
    stats.due ? el('span', { class: 'badge', text: t('common.due', { n: stats.due }) })
              : el('span', { text: t('common.dash') }),
  ]));

  view.append(el('div', { class: 'actions' }, [
    el('a', { class: 'btn', href: `#/view/${id}`, text: t('list.action.view') }),
    el('a', { class: 'btn primary', href: `#/train/${id}`, text: t('list.action.train') }),
    el('a', { class: 'btn', href: `#/test/${id}`, text: t('list.action.test') }),
  ]));
}
