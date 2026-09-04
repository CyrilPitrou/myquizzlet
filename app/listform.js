import { el } from './ui.js';
import { store } from './app.js';
import { langOf } from './langs.js';
import { t, lang } from './i18n.js';

function labelField(text, value, placeholder) {
  const input = el('input', { value: value || '', placeholder });
  const hint = el('span', { class: 'muted hint' });
  const update = () => {
    const code = langOf(input.value);
    // Built per call, not once at module load: otherwise the hint under a
    // side label stays in whatever language the page started in.
    const display = new Intl.DisplayNames([lang()], { type: 'language' });
    hint.textContent = code ? `→ ${display.of(code)}` : '';
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
//
// beforeSave is an optional node dropped in just above the submit button, for
// an action that belongs to this form's subject but not to its fields. It is
// a slot rather than something the caller appends afterwards, because "above
// the submit button" is a position only this function can promise.
export function listForm({ list = null, onSave, sidesOnly = false, beforeSave = null, folder: filedIn = null }) {
  const name = sidesOnly ? null : el('input', {
    value: list ? list.name : '', placeholder: t('form.title.placeholder'), required: 'required',
  });

  const folders = sidesOnly ? null : el('datalist', { id: 'folder-names' },
    store.folders().map((folder) => el('option', { value: folder })));
  // filedIn is where a new list starts out — the folder the + was tapped in.
  // An existing list's own folder always wins; the field stays editable.
  const folder = sidesOnly ? null : el('input', {
    value: (list && list.folder) || filedIn || '', placeholder: t('form.folder.placeholder'), list: 'folder-names',
  });

  const front = labelField(t('form.firstSide'), list && list.frontLabel, t('form.front.placeholder'));
  const back = labelField(t('form.secondSide'), list && list.backLabel, t('form.back.placeholder'));

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
    ...(sidesOnly ? [] : [el('label', { class: 'field' }, [t('form.title'), name]),
                          el('label', { class: 'field' }, [t('form.folder'), folder]), folders]),
    front.field,
    back.field,
    el('p', { class: 'muted', text: t('form.sidesHint') }),
    ...(beforeSave ? [beforeSave] : []),
    el('button', { class: 'primary', type: 'submit', text: list ? t('form.save') : t('form.create') }),
  ]);
}
