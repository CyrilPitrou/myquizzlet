import { el } from './ui.js';
import { store } from './app.js';
import { langOf } from './langs.js';

const DISPLAY = new Intl.DisplayNames(['en'], { type: 'language' });

function labelField(text, value, placeholder) {
  const input = el('input', { value: value || '', placeholder });
  const hint = el('span', { class: 'muted hint' });
  const update = () => {
    const code = langOf(input.value);
    hint.textContent = code ? `→ ${DISPLAY.of(code)}` : '';
  };
  input.addEventListener('input', update);
  update();
  return { field: el('label', { class: 'field' }, [text, input, hint]), input };
}

// One form for both creating and editing. It never touches cards: renaming a
// side is metadata, and every card id and progress entry must survive it.
//
// sidesOnly restricts the form to the two side-label fields — used when
// editing an existing list's sides only, so Title and Folder (already
// handled by their own menu items) are neither shown nor sent.
export function listForm({ list = null, onSave, sidesOnly = false }) {
  const name = sidesOnly ? null : el('input', {
    value: list ? list.name : '', placeholder: 'Spanish – Food', required: 'required',
  });

  const folders = sidesOnly ? null : el('datalist', { id: 'folder-names' },
    store.folders().map((folder) => el('option', { value: folder })));
  const folder = sidesOnly ? null : el('input', {
    value: (list && list.folder) || '', placeholder: 'Spanish', list: 'folder-names',
  });

  const front = labelField('First side', list && list.frontLabel, 'Spanish');
  const back = labelField('Second side', list && list.backLabel, 'French');

  return el('form', {
    class: 'listform',
    onsubmit: (event) => {
      event.preventDefault();
      const fields = {
        frontLabel: front.input.value.trim() || null,
        backLabel: back.input.value.trim() || null,
        frontLang: langOf(front.input.value),
        backLang: langOf(back.input.value),
      };
      if (!sidesOnly) {
        const trimmed = name.value.trim();
        if (!trimmed) return;
        fields.name = trimmed;
        fields.folder = folder.value.trim() || null;
      }
      onSave(fields);
    },
  }, [
    ...(sidesOnly ? [] : [el('label', { class: 'field' }, ['Title', name]),
                          el('label', { class: 'field' }, ['Folder', folder]), folders]),
    front.field,
    back.field,
    el('p', { class: 'muted', text: 'Name the two sides of a card — '
      + 'Spanish and French, or Date and Event. Leave them blank for Front and Back.' }),
    el('button', { class: 'primary', type: 'submit', text: list ? 'Save' : 'Create list' }),
  ]);
}
