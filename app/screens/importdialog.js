import { el, clear, openDialog } from '../ui.js';
import { previewRows } from '../csv.js';

const ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain';

function rowNode(row, onEdit, onRemove) {
  const frontInput = el('input', {
    value: row.front,
    oninput: (event) => { row.front = event.target.value; onEdit(row); },
  });
  const backInput = el('input', {
    value: row.back,
    oninput: (event) => { row.back = event.target.value; onEdit(row); },
  });
  const children = [frontInput, backInput];
  if (row.error) children.push(el('span', { class: 'reason', text: row.error }));
  children.push(el('button', {
    class: 'link', text: '✕', title: 'remove', type: 'button', onclick: onRemove,
  }));
  return el('div', { class: row.error ? 'import-row error' : 'import-row' }, children);
}

// Opens the shared file-import dialog: a styled file picker, then an
// editable preview (one row per line, failed lines flagged but still
// editable), then a commit button. Storage-agnostic — onCommit(cards) is
// called with the current non-error rows and the caller decides what
// "commit" means (write straight to a list, or stage into a draft).
export function openImportDialog({ onCommit }) {
  let rows = [];
  const rowsWrap = el('div', { class: 'import-rows' });
  const commitBtn = el('button', {
    class: 'primary', type: 'button', text: 'Import 0 cards', disabled: 'disabled',
  });

  function updateCommit() {
    const n = rows.filter((r) => !r.error).length;
    commitBtn.textContent = `Import ${n} cards`;
    commitBtn.disabled = n === 0;
  }

  function renderRows() {
    clear(rowsWrap);
    rows.forEach((row, index) => rowsWrap.append(rowNode(
      row,
      () => {
        if (row.error && row.front.trim() && row.back.trim()) { row.error = null; renderRows(); return; }
        updateCommit();
      },
      () => { rows.splice(index, 1); renderRows(); },
    )));
    updateCommit();
  }

  const file = el('input', {
    type: 'file', accept: ACCEPT, hidden: 'hidden',
    onchange: async (event) => {
      const chosen = event.target.files[0];
      if (!chosen) return;
      const text = await chosen.text();
      rows = previewRows(text);
      renderRows();
    },
  });
  const pickButton = el('button', {
    class: 'btn', type: 'button', text: 'Choose file…', onclick: () => file.click(),
  });

  const cancelBtn = el('button', { class: 'btn', type: 'button', text: 'Cancel',
    onclick: () => node.close() });
  commitBtn.addEventListener('click', () => {
    onCommit(rows.filter((r) => !r.error).map((r) => ({ front: r.front.trim(), back: r.back.trim() })));
    node.close();
  });

  const node = openDialog([
    el('h2', { text: 'Import file' }),
    el('p', { class: 'muted', text: 'Cards come from a file with two values per line, '
      + 'separated by comma, semicolon, or tab. A value that contains the delimiter '
      + 'should be wrapped in quotes.' }),
    el('div', { class: 'row' }, [pickButton, file]),
    rowsWrap,
    el('div', { class: 'dialog-actions' }, [cancelBtn, commitBtn]),
  ]);

  return node;
}
