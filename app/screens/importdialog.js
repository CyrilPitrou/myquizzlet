import { el, clear, openDialog } from '../ui.js';
import { previewRows } from '../csv.js';

const ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain';

// Each row owns its own error display and refreshes itself in place on
// edit, so the caller never has to rebuild the row list mid-keystroke.
function rowNode(row, onChange, onRemove) {
  const reason = el('span', { class: 'reason', text: row.error || '' });

  function refresh() {
    wrap.className = row.error ? 'import-row error' : 'import-row';
    reason.textContent = row.error || '';
  }

  // Re-derives the row's error from its *current* text on every edit, so a
  // row can go valid -> invalid as well as invalid -> valid. This replaces
  // an initial diagnosis like "no separator found" with "empty side" the
  // moment the user edits the row — correct, since the original diagnosis
  // no longer describes the row's current text.
  function edit(side) {
    return (event) => {
      row[side] = event.target.value;
      row.error = row.front.trim() && row.back.trim() ? null : 'empty side';
      refresh();
      onChange();
    };
  }

  const frontInput = el('input', { value: row.front, oninput: edit('front') });
  const backInput = el('input', { value: row.back, oninput: edit('back') });
  const removeBtn = el('button', {
    class: 'link', text: '✕', title: 'remove', type: 'button', onclick: onRemove,
  });
  const wrap = el('div', { class: row.error ? 'import-row error' : 'import-row' },
    [frontInput, backInput, reason, removeBtn]);

  return wrap;
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
    commitBtn.textContent = `Import ${n} card${n === 1 ? '' : 's'}`;
    commitBtn.disabled = n === 0;
  }

  function renderRows() {
    clear(rowsWrap);
    rows.forEach((row) => rowsWrap.append(rowNode(
      row,
      updateCommit,
      () => { rows = rows.filter((r) => r !== row); renderRows(); },
    )));
    updateCommit();
    // Once a file is loaded the picker stays — it is the only way back from
    // picking the wrong one — but it has to stop reading as "nothing happened".
    pickButton.textContent = rows.length ? 'Choose a different file…' : 'Choose file…';
  }

  const file = el('input', {
    type: 'file', accept: ACCEPT, hidden: 'hidden',
    onchange: async (event) => {
      const chosen = event.target.files[0];
      event.target.value = ''; // so re-picking the same path still fires change
      if (!chosen) return;
      let text;
      try {
        text = await chosen.text();
      } catch {
        // A file the picker listed but cannot read — one still in the cloud,
        // or moved since. Saying nothing leaves the dialog exactly as it was,
        // which is indistinguishable from a dead button. Any rows already
        // loaded stay put, so a failed second pick costs nothing.
        alert(`Could not read "${chosen.name}". If it is stored online, open it `
          + 'once so it downloads to this device, then try again.');
        return;
      }
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

// The standard way for a screen to offer file import: a headed block whose
// button opens the dialog above. "Edit cards" and "New list" differ only in
// what they do with the committed cards — write them straight to a list, or
// stage them into an unsaved draft — so that difference is the whole of the
// parameter list.
export function importFileBlock(onCommit) {
  return el('div', {}, [
    el('h3', { text: 'Import file' }),
    el('p', { class: 'muted', text: 'CSV, TSV, or text file.' }),
    el('button', {
      class: 'btn', type: 'button', text: 'Import file…',
      onclick: () => openImportDialog({ onCommit }),
    }),
  ]);
}
