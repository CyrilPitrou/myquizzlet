import { el, clear, openDialog } from '../ui.js';
import { store } from '../app.js';
import { EMOJIS, createProfile, validateProfileName } from '../profiles.js';
import { t } from '../i18n.js';

export function openProfileDialog({ onSelect, onCancel, canCancel = true, forceCreate = false } = {}) {
  let mode = forceCreate || store.getProfiles().length === 0 ? 'create' : 'list';
  let selectedEmoji = EMOJIS[1]; // default 🐻
  let settled = false;

  const content = el('div', { class: 'profile-dialog-content' });
  const dialog = openDialog([content]);

  dialog.addEventListener('close', () => {
    if (!settled && onCancel) onCancel();
  });

  function render() {
    clear(content);
    if (mode === 'list') {
      renderList();
    } else {
      renderCreate();
    }
  }

  function renderList() {
    const profiles = store.getProfiles();
    const activeId = store.getActiveProfile();

    const title = el('h2', { text: t('profile.choose') });
    const list = el('div', { class: 'profile-list' }, profiles.map((p) => {
      const isActive = p.id === activeId;
      const item = el('button', {
        class: `profile-item${isActive ? ' active' : ''}`,
        type: 'button',
        onclick: () => {
          settled = true;
          store.setActiveProfile(p.id);
          dialog.close();
          if (onSelect) onSelect(p);
        },
      }, [
        el('span', { class: 'profile-emoji', text: p.emoji }),
        el('span', { class: 'profile-name', text: p.name }),
        ...(isActive ? [el('span', { class: 'profile-check', text: '✓' })] : []),
      ]);
      return item;
    }));

    const createBtn = el('button', {
      class: 'btn profile-create-btn',
      type: 'button',
      text: `＋ ${t('profile.new')}`,
      onclick: () => {
        mode = 'create';
        render();
      },
    });

    const actions = el('div', { class: 'dialog-actions' }, [
      ...(canCancel ? [el('button', {
        class: 'btn',
        type: 'button',
        text: t('common.cancel'),
        onclick: () => {
          settled = true;
          dialog.close();
          if (onCancel) onCancel();
        },
      })] : []),
    ]);

    content.append(title, list, createBtn, actions);
  }

  function renderCreate() {
    const title = el('h2', { text: t('profile.new') });
    const errorMsg = el('p', { class: 'warn profile-error', hidden: 'hidden' });

    const nameInput = el('input', {
      type: 'text',
      class: 'profile-name-input',
      maxlength: '20',
      placeholder: t('profile.namePlaceholder'),
      required: 'required',
      autofocus: 'autofocus',
    });

    const emojiButtons = EMOJIS.map((emoji) => el('button', {
      class: `profile-emoji-btn${emoji === selectedEmoji ? ' selected' : ''}`,
      type: 'button',
      text: emoji,
      onclick: () => {
        selectedEmoji = emoji;
        emojiButtons.forEach((btn) => btn.classList.toggle('selected', btn.textContent === emoji));
      },
    }));

    const emojisGrid = el('div', { class: 'profile-emojis' }, emojiButtons);

    const form = el('form', {
      class: 'profile-form',
      onsubmit: (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const err = validateProfileName(name, store.getProfiles());
        if (err === 'duplicate') {
          errorMsg.textContent = t('profile.exists');
          errorMsg.hidden = false;
          return;
        }
        if (err === 'empty') {
          nameInput.focus();
          return;
        }

        const newProfile = createProfile(name, selectedEmoji, store.getProfiles());
        store.saveProfiles([...store.getProfiles(), newProfile]);
        store.setActiveProfile(newProfile.id);
        settled = true;
        dialog.close();
        if (onSelect) onSelect(newProfile);
      },
    }, [
      el('label', { class: 'field' }, [
        el('span', { text: t('profile.name') }),
        nameInput,
      ]),
      el('div', { class: 'field' }, [
        el('span', { text: t('profile.pickIcon') }),
        emojisGrid,
      ]),
      errorMsg,
      el('div', { class: 'dialog-actions' }, [
        el('button', {
          class: 'btn profile-cancel-btn',
          type: 'button',
          text: t('common.cancel'),
          onclick: () => {
            if (store.getProfiles().length > 0) {
              mode = 'list';
              render();
            } else {
              settled = true;
              dialog.close();
              if (onCancel) onCancel();
            }
          },
        }),
        el('button', { class: 'btn primary', type: 'submit', text: t('profile.create') }),
      ]),
    ]);

    content.append(title, form);
    requestAnimationFrame(() => nameInput.focus());
  }

  render();
  return dialog;
}
